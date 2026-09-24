import { Router } from "express";
import { IStorage } from "../storage";
import { requireAuth } from "../auth";
import { z } from "zod/v4";
import { 
  insertForumCategorySchema, 
  insertForumPostSchema, 
  insertForumCommentSchema, 
  insertForumDescriptionSchema,
  insertForumReadStateSchema 
} from "@workspace/db";
import { filterByHiddenIndex, getViewerContext, resolveDetailForViewer, isContentIdPublic, canViewerSee, sendContentUnavailable, filterForViewer } from "../dmca/content-visibility";
import { sendForumPostNotificationEmail, sendForumCommentNotificationEmail, groupNotifiedUsersByEmail } from "../sendgrid-service";
import { LegalHoldError } from "../dmca/legal-hold";
import { assertCanPermanentDelete, PermanentDeletePermissionError } from "../dmca/permanent-delete";

console.log("🚨🚨🚨 FORUM MODULE LOADED - This proves TypeScript file is being executed! 🚨🚨🚨");

export function createForumRouter(storage: IStorage) {
  console.log("🚨 createForumRouter() function called - Router being created now!");

  const router = Router();

  // Get all categories (with unread counts if user is authenticated)
  router.get("/categories", async (req, res) => {
    console.log("🔍 [TEST] Forum router GET /categories is executing - code IS running!");
    try {
      // If user is authenticated, get categories with unread counts
      if (req.user?.id) {
        const categories = await storage.getForumCategoriesWithUnreadCounts(req.user.id);
        res.json(categories);
      } else {
        // If not authenticated, get basic categories without unread counts
        const categories = await storage.getForumCategories();
        res.json(categories);
      }
    } catch (error) {
      console.error("Error fetching forum categories:", error);
      res.status(500).json({ message: "Failed to fetch forum categories" });
    }
  });

  // Get a specific category
  router.get("/categories/:id", async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id, 10);
      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      const category = await storage.getForumCategory(categoryId);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      res.json(category);
    } catch (error) {
      console.error("Error fetching forum category:", error);
      res.status(500).json({ message: "Failed to fetch forum category" });
    }
  });

  // Create a new category (admin only)
  router.post("/categories", requireAuth, async (req, res) => {
    try {
      // Check if user is admin
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Only administrators can create categories" });
      }

      const validatedData = insertForumCategorySchema.parse(req.body);
      const newCategory = await storage.createForumCategory(validatedData);
      res.status(201).json(newCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid category data", errors: error.errors });
      }
      console.error("Error creating forum category:", error);
      res.status(500).json({ message: "Failed to create forum category" });
    }
  });

  // Update a category (admin only)
  router.patch("/categories/:id", requireAuth, async (req, res) => {
    try {
      // Check if user is admin
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Only administrators can update categories" });
      }

      const categoryId = parseInt(req.params.id, 10);
      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      const validatedData = insertForumCategorySchema.partial().parse(req.body);
      const updatedCategory = await storage.updateForumCategory(categoryId, validatedData);
      
      if (!updatedCategory) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      res.json(updatedCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid category data", errors: error.errors });
      }
      console.error("Error updating forum category:", error);
      res.status(500).json({ message: "Failed to update forum category" });
    }
  });

  // Delete a category (admin only)
  router.delete("/categories/:id", requireAuth, async (req, res) => {
    try {
      // Check if user is admin
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Only administrators can delete categories" });
      }

      const categoryId = parseInt(req.params.id, 10);
      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      await storage.deleteForumCategory(categoryId);
      
      res.json({ success: true, message: "Category deleted successfully" });
    } catch (error) {
      console.error("Error deleting forum category:", error);
      res.status(500).json({ message: "Failed to delete forum category" });
    }
  });

  // Get all posts in a category
  router.get("/categories/:id/posts", async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id, 10);
      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      // Get sort parameter from query string (default to 'newest_created')
      const sortBy = (req.query.sort as string) || 'newest_created';

      // If user is authenticated, add read state information with sorting
      if (req.user) {
        const postsWithReadState = await storage.getForumPostsWithReadState(categoryId, req.user.id, sortBy);
        // DMCA/moderation: hidden posts only reach their author (flagged).
        res.json(await filterByHiddenIndex("forum_post", postsWithReadState as any[], await getViewerContext(req)));
      } else {
        // For unauthenticated users, get posts with sorting (no read state)
        const posts = await storage.getForumPosts(categoryId, sortBy);
        res.json(await filterByHiddenIndex("forum_post", posts as any[]));
      }
    } catch (error) {
      console.error("Error fetching posts for category:", error);
      res.status(500).json({ message: "Failed to fetch posts for category" });
    }
  });

  // Get the paginated "Extra!" story feed (all categories, pinned first, newest first)
  router.get("/stories", async (req, res) => {
    try {
      const categoryIdRaw = req.query.categoryId as string | undefined;
      const categoryId = categoryIdRaw ? parseInt(categoryIdRaw, 10) : undefined;
      if (categoryIdRaw && isNaN(categoryId!)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      const limitRaw = req.query.limit as string | undefined;
      const offsetRaw = req.query.offset as string | undefined;
      const limit = limitRaw ? parseInt(limitRaw, 10) : 12;
      const offset = offsetRaw ? parseInt(offsetRaw, 10) : 0;
      if ((limitRaw && isNaN(limit)) || (offsetRaw && isNaN(offset))) {
        return res.status(400).json({ message: "Invalid pagination parameters" });
      }

      const validSorts = ['newest_created', 'oldest_created', 'newest_comment', 'oldest_comment', 'newest_edited', 'oldest_edited'];
      const sortRaw = req.query.sort as string | undefined;
      const sortBy = sortRaw && validSorts.includes(sortRaw) ? sortRaw : 'newest_created';

      const searchRaw = typeof req.query.search === "string" ? req.query.search.trim() : "";
      const search = searchRaw ? searchRaw.slice(0, 100) : undefined;

      const feed = await storage.getForumStoryFeed({
        categoryId,
        limit,
        offset,
        userId: req.user?.id,
        sortBy,
        search
      });

      res.json(feed);
    } catch (error) {
      console.error("Error fetching story feed:", error);
      res.status(500).json({ message: "Failed to fetch story feed" });
    }
  });

  // Get a specific post
  router.get("/posts/:id", async (req, res) => {
    try {
      const postId = parseInt(req.params.id, 10);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const found = await storage.getForumPost(postId);
      if (!found) {
        return res.status(404).json({ message: "Post not found" });
      }
      // DMCA/moderation visibility (generic 404 publicly; flagged for author/dmca.view).
      const post = await resolveDetailForViewer(req, res, found, (found as any).userId, "Post");
      if (!post) return;

      res.json(post);
    } catch (error) {
      console.error("Error fetching forum post:", error);
      res.status(500).json({ message: "Failed to fetch forum post" });
    }
  });

  // Get unread comments count for a specific post
  router.get("/posts/:id/unread-comments", requireAuth, async (req, res) => {
    try {
      const postId = parseInt(req.params.id, 10);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const unreadCount = await storage.getUnreadCommentsCountForPost(postId, req.user.id);
      res.json({ unreadCount });
    } catch (error) {
      console.error("Error fetching unread comments count:", error);
      res.status(500).json({ message: "Failed to fetch unread comments count" });
    }
  });

  // Create a new post
  router.post("/categories/:id/posts", requireAuth, async (req, res) => {
    console.log("🚨🚨🚨 [CRITICAL TEST] POST /categories/:id/posts HANDLER EXECUTING!");
    console.log(`🚨 Request params:`, req.params);
    console.log(`🚨 Request body:`, req.body);
    console.log(`🚨 User:`, req.user);
    try {
      // Check if user is blocked
      if (req.user.isBlocked) {
        return res.status(403).json({ 
          message: "Your account has been blocked. You cannot create new topics.",
          blockReason: req.user.blockReason || "Contact an administrator for more information."
        });
      }

      // Since we've removed the approval process, we no longer need to check isApproved
      // We only need to check if the user is an admin, moderator, or has appropriate role permissions

      const categoryId = parseInt(req.params.id, 10);
      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      // Check if category exists
      const category = await storage.getForumCategory(categoryId);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      // Category-specific permission check: Non-admins can only post in General Discussion (ID: 7)
      if (req.user.role !== "admin" && categoryId !== 7) {
        return res.status(403).json({ 
          message: "You can only create topics in the General Discussion category. Admins can create topics in any category.",
          allowedCategory: "General Discussion"
        });
      }

      // Extract image URLs from content if present
      let mediaUrls = Array.isArray(req.body.mediaUrls) ? [...req.body.mediaUrls] : [];
      
      // Extract all image URLs from the content HTML
      if (req.body.content) {
        console.log("Scanning content for media URLs in new post...");
        const contentImgRegex = /<img[^>]+src="([^">]+)"/g;
        let match;
        while ((match = contentImgRegex.exec(req.body.content)) !== null) {
          const imgSrc = match[1];
          if (imgSrc && (
            imgSrc.startsWith('/uploads/') || 
            imgSrc.startsWith('/attached_assets/') || 
            imgSrc.startsWith('/forum-media/') ||
            imgSrc.startsWith('/content-media/')
          ) && !mediaUrls.includes(imgSrc)) {
            console.log(`Found image URL in content: ${imgSrc}`);
            mediaUrls.push(imgSrc);
          }
        }
      }

      const postData = {
        ...req.body,
        categoryId,
        userId: req.user.id, // Use userId to match the schema
        mediaUrls // Add the updated mediaUrls array
      };

      console.log("Creating post with mediaUrls:", mediaUrls);
      const validatedData = insertForumPostSchema.parse(postData);
      const newPost = await storage.createForumPost(validatedData);

      // Automatically subscribe the post author to receive comment notifications
      try {
        await storage.upsertForumSubscription(newPost.id, req.user.id);
        console.log(`[Forum] ✅ Auto-subscribed post author (user ${req.user.id}) to post ${newPost.id}`);
      } catch (subscriptionError) {
        console.error(`[Forum] ⚠️ Failed to auto-subscribe post author:`, subscriptionError);
        // Don't fail the post creation if subscription fails
      }

      // Send email notifications based on notifyPreference
      const notifyPreference = req.body.notifyPreference || "none";
      console.log(`[Forum] Post created with notify preference: ${notifyPreference}`);

      if (notifyPreference !== "none") {
        console.log(`[Forum] Sending email notifications (preference: ${notifyPreference})...`);
        
        // Get all users with email addresses
        const allUsers = await storage.getUsers();
        console.log(`[Forum] Total users in database: ${allUsers.length}`);
        let recipientEmails: string[] = [];
        let notifiedUsers: { username: string; email: string }[] = [];

        if (notifyPreference === "justme") {
          // Send only to the post author (if they haven't unsubscribed)
          const author = allUsers.find(u => u.id === req.user.id);
          if (author && author.emailNotificationsEnabled !== false && author.email && author.email.trim().length > 0 && author.email.includes('@')) {
            recipientEmails = [author.email.trim()];
            notifiedUsers = [{ username: author.username, email: author.email.trim() }];
            console.log(`[Forum] Notifying just the author: ${author.email}`);
          } else {
            console.log(`[Forum] ⚠️ Post author has no valid email or has unsubscribed`);
          }
        } else if (notifyPreference === "admins") {
          // Send to all admin users who haven't unsubscribed
          const adminUsers = allUsers.filter(user => 
            user.role === "admin" && user.emailNotificationsEnabled !== false
          );
          console.log(`[Forum] Found ${adminUsers.length} admin users (excluding unsubscribed)`);
          
          // Filter for valid email addresses and collect user details
          const validAdminUsers = adminUsers.filter(user => {
            const hasEmail = user.email && user.email.trim().length > 0;
            if (!hasEmail) {
              console.log(`[Forum] ⚠️ Admin user ${user.id} (${user.username}) has no valid email address`);
            }
            return hasEmail;
          }).filter(user => {
            const isValid = user.email.includes('@');
            if (!isValid) {
              console.log(`[Forum] ⚠️ Invalid email format: ${user.email}`);
            }
            return isValid;
          });
          
          recipientEmails = validAdminUsers.map(user => user.email.trim());
          notifiedUsers = validAdminUsers.map(user => ({ 
            username: user.username, 
            email: user.email.trim() 
          }));
          
          console.log(`[Forum] Notifying ${recipientEmails.length} admin users with valid emails`);
          console.log(`[Forum] Admin recipient emails: ${recipientEmails.join(', ')}`);
        } else if (notifyPreference === "everyone") {
          // Send to all users who haven't unsubscribed (including the post author)
          const eligibleUsers = allUsers.filter(user => 
            user.emailNotificationsEnabled !== false
          );
          console.log(`[Forum] Found ${eligibleUsers.length} users (including author, excluding unsubscribed)`);
          
          // Filter for valid email addresses and collect user details
          const validUsers = eligibleUsers.filter(user => {
            const hasEmail = user.email && user.email.trim().length > 0;
            return hasEmail;
          }).filter(user => user.email.includes('@'));
          
          recipientEmails = validUsers.map(user => user.email.trim());
          notifiedUsers = validUsers.map(user => ({ 
            username: user.username, 
            email: user.email.trim() 
          }));
          
          console.log(`[Forum] Notifying ${recipientEmails.length} users (everyone) with valid emails`);
        }

        if (recipientEmails.length > 0) {
          // Group users that share a mailbox so the reported counts reflect
          // unique mailboxes contacted, while still surfacing every user record
          // covered by each mailbox to the admin alert.
          const uniqueNotifiedUsers = groupNotifiedUsersByEmail(notifiedUsers);
          const uniqueMailboxCount = uniqueNotifiedUsers.length;

          // Send notifications and WAIT for completion to verify success
          console.log(`[Forum] Starting email send process for ${uniqueMailboxCount} unique mailbox(es) (from ${recipientEmails.length} user record(s))...`);
          try {
            const emailSuccess = await sendForumPostNotificationEmail(
              {
                id: newPost.id,
                title: newPost.title,
                content: newPost.content
              },
              category.name,
              req.user.fullName || req.user.username,
              recipientEmails
            );
            
            if (emailSuccess) {
              console.log(`[Forum] ✅ Email notifications sent successfully`);
              // Include success message in response ONLY if emails actually sent
              let notificationMessage = '';
              if (notifyPreference === 'justme') {
                notificationMessage = 'Email notification sent to you';
              } else if (notifyPreference === 'admins') {
                notificationMessage = `Email notifications sent to ${uniqueMailboxCount} admin user${uniqueMailboxCount !== 1 ? 's' : ''}`;
              } else {
                notificationMessage = `Email notifications sent to ${uniqueMailboxCount} user${uniqueMailboxCount !== 1 ? 's' : ''}`;
              }
              
              return res.status(201).json({
                ...newPost,
                notificationMessage,
                notifiedUsers: uniqueNotifiedUsers
              });
            } else {
              console.error('[Forum] ❌ Email notifications failed - no emails were sent');
              // Return post without notification message (emails failed)
              return res.status(201).json(newPost);
            }
          } catch (error) {
            console.error('[Forum] ❌ Error sending email notifications:', error);
            // Return post without notification message (exception occurred)
            return res.status(201).json(newPost);
          }
        } else {
          console.log('[Forum] ⚠️ No users with valid email addresses to notify');
        }
      } else {
        console.log('[Forum] Email notifications disabled (notify preference: none)');
      }

      res.status(201).json(newPost);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid post data", errors: error.errors });
      }
      console.error("Error creating forum post:", error);
      res.status(500).json({ message: "Failed to create forum post" });
    }
  });

  // Update a post (both PATCH and PUT for compatibility)
  const updatePostHandler = async (req: any, res: any) => {
    try {
      const postId = parseInt(req.params.id, 10);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      // Enhanced debug logging for edit requests
      console.log("Edit forum post request received:", {
        postId,
        userId: req.user?.id,
        role: req.user?.role,
        isAuthenticated: req.isAuthenticated(),
        sessionID: req.sessionID,
        hasSession: !!req.session,
        headers: {
          origin: req.headers.origin,
          referer: req.headers.referer,
          cookie: req.headers.cookie ? "Present" : "None"
        }
      });

      // Get the post to check ownership
      const post = await storage.getForumPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Check if user is the author or admin
      if (post.userId !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ message: "You don't have permission to update this post" });
      }

      // Create an array to track unique URLs
      const mediaUrlSet = new Set<string>();
      
      // Add media URLs from request body if they exist
      if (Array.isArray(req.body.mediaUrls)) {
        req.body.mediaUrls.forEach(url => mediaUrlSet.add(url));
      }
      
      // Add existing media URLs from the post
      if (post.mediaUrls && Array.isArray(post.mediaUrls)) {
        post.mediaUrls.forEach(url => mediaUrlSet.add(url));
      }
      
      // Extract all image URLs from the content HTML
      if (req.body.content) {
        console.log("Scanning content for media URLs...");
        const contentImgRegex = /<img[^>]+src="([^">]+)"/g;
        let match;
        while ((match = contentImgRegex.exec(req.body.content)) !== null) {
          const imgSrc = match[1];
          if (imgSrc && (
            imgSrc.startsWith('/uploads/') || 
            imgSrc.startsWith('/attached_assets/') || 
            imgSrc.startsWith('/forum-media/') ||
            imgSrc.startsWith('/content-media/')
          )) {
            console.log(`Found image URL in content: ${imgSrc}`);
            mediaUrlSet.add(imgSrc);
          }
        }
      }
      
      // Convert set back to array
      const mediaUrls = Array.from(mediaUrlSet);

      // Ensure userId field is correctly populated
      // The schema expects userId but the client may be using authorId
      const updateData = {
        ...req.body,
        mediaUrls, // Add the updated mediaUrls array
        userId: post.userId // Ensure userId is preserved from the original post
      };

      // Editorial fields (pin, updated flag, featured image, and the associated
      // timestamp) are admin-only — always strip them from non-admin payloads
      // before any further processing so clients cannot bypass editorial controls.
      if (req.user.role !== "admin") {
        delete updateData.isPinned;
        delete updateData.isEditoriallyUpdated;
        delete updateData.featuredImage;
      }
      
      // Debug logs to help diagnose issues
      console.log("Original post data:", JSON.stringify({
        id: post.id,
        title: post.title,
        userId: post.userId
      }));
      console.log("Updating post with data:", JSON.stringify({
        id: postId,
        title: updateData.title,
        mediaUrls: mediaUrls.length,
        categoryId: updateData.categoryId,
        userId: updateData.userId
      }));
      
      let updatedPost;
      try {
        const validatedData = insertForumPostSchema.partial().parse(updateData);
        console.log("Validation successful. Data:", JSON.stringify(validatedData));
        updatedPost = await storage.updateForumPost(postId, validatedData);
      } catch (validationError) {
        console.error("Validation error:", validationError);
        throw validationError;
      }
      
      res.json(updatedPost);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid post data", errors: error.errors });
      }
      console.error("Error updating forum post:", error);
      res.status(500).json({ message: "Failed to update forum post" });
    }
  };

  // Register both PATCH and PUT routes for post updates
  router.patch("/posts/:id", requireAuth, updatePostHandler);
  router.put("/posts/:id", requireAuth, updatePostHandler);

  // Delete a post
  router.delete("/posts/:id", requireAuth, async (req, res) => {
    try {
      const postId = parseInt(req.params.id, 10);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      // Get the post to check ownership
      const post = await storage.getForumPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Check if user is the author or admin
      if (post.userId !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ message: "You don't have permission to delete this post" });
      }
      await assertCanPermanentDelete(req, post.userId);

      await storage.deleteForumPost(postId);
      
      res.json({ success: true, message: "Post deleted successfully" });
    } catch (error) {
      if (error instanceof PermanentDeletePermissionError) return res.status(403).json({ message: error.message });
      if (error instanceof LegalHoldError) return res.status(423).json({ error: "legal_hold", message: error.message });
      console.error("Error deleting forum post:", error);
      res.status(500).json({ message: "Failed to delete forum post" });
    }
  });

  // Get comments for a post
  router.get("/posts/:id/comments", async (req, res) => {
    try {
      const postId = parseInt(req.params.id, 10);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      // Comments on a hidden post are hidden with it.
      const viewer = await getViewerContext(req);
      const parentPost = await storage.getForumPost(postId);
      if (parentPost && !canViewerSee(parentPost, viewer, (parentPost as any).userId)) return sendContentUnavailable(res, "Post");
      const comments = await storage.getForumComments(postId);
      
      // Ensure we always return an array, even if comments is undefined
      let commentsArray = filterForViewer(Array.isArray(comments) ? comments : [], viewer, (c: any) => c.authorId);
      
      // CRITICAL: Verify all comments belong to this post (defensive check)
      const validComments = commentsArray.filter(comment => comment.postId === postId);
      if (validComments.length !== commentsArray.length) {
        console.error(`⚠️ WARNING: Found ${commentsArray.length - validComments.length} comments with wrong postId! Expected ${postId}`);
        commentsArray = validComments;
      }
      
      // Support polling with 'after' timestamp for live chat functionality
      const afterTimestamp = req.query.after;
      if (afterTimestamp) {
        const afterDate = new Date(afterTimestamp as string);
        if (!isNaN(afterDate.getTime())) {
          commentsArray = commentsArray.filter(comment => 
            new Date(comment.createdAt) > afterDate
          );
        }
      }
      
      console.log(`✅ Retrieved ${commentsArray.length} comments for post ${postId}${afterTimestamp ? ` after ${afterTimestamp}` : ''}`);
      
      res.json(commentsArray);
    } catch (error) {
      console.error("Error fetching comments for post:", error);
      res.status(500).json({ message: "Failed to fetch comments for post" });
    }
  });

  // Add a comment to a post
  router.post("/posts/:id/comments", requireAuth, async (req, res) => {
    const postId = parseInt(req.params.id, 10);
    console.log(`📧 [COMMENT POST START] User ${req.user?.id} (${req.user?.username}) attempting to comment on post ${postId}`);
    
    try {
      // Check if user is blocked
      if (req.user.isBlocked) {
        console.log(`📧 [EARLY RETURN] User ${req.user.id} is blocked - comment rejected for post ${postId}`);
        return res.status(403).json({ 
          message: "Your account has been blocked. You cannot leave comments.",
          blockReason: req.user.blockReason || "Contact an administrator for more information."
        });
      }

      // Check feature flag permission for comments
      const hasCommentPermission = await storage.checkUserHasFeaturePermission(req.user.role, 'comments');
      if (!hasCommentPermission) {
        console.log(`📧 [EARLY RETURN] User ${req.user.id} lacks comment permission - rejected for post ${postId}`);
        return res.status(403).json({ 
          message: "You do not have permission to post comments. Only admins, moderators, and paid users can comment.",
          featureRequired: "comments"
        });
      }

      if (isNaN(postId)) {
        console.log(`📧 [EARLY RETURN] Invalid post ID: ${req.params.id}`);
        return res.status(400).json({ message: "Invalid post ID" });
      }

      // Check if post exists
      const post = await storage.getForumPost(postId);
      if (!post) {
        console.log(`📧 [EARLY RETURN] Post ${postId} not found - comment rejected`);
        return res.status(404).json({ message: "Post not found" });
      }

      // Also strip any HTML tags from the content
      const commentData = {
        ...req.body,
        // Clean any HTML tags from the content if present
        content: req.body.content ? req.body.content.replace(/<\/?[^>]+(>|$)/g, "") : req.body.content,
        postId,
        authorId: req.user.id,  // Now using authorId to match the updated schema
      };

      console.log(`📝 Creating comment for post ${postId} by user ${req.user.username} (ID: ${req.user.id})`);
      console.log(`📝 Comment data:`, commentData);
      const validatedData = insertForumCommentSchema.parse(commentData);
      const newComment = await storage.createForumComment(validatedData);
      
      // CRITICAL: Verify the comment was created with correct postId
      if (newComment.postId !== postId) {
        console.error(`🚨 CRITICAL BUG: Comment created with postId ${newComment.postId} but should be ${postId}!`);
      } else {
        console.log(`✅ Comment ${newComment.id} successfully created for post ${postId}`);
      }
      
      // Automatically subscribe the commenter to receive future comment notifications
      try {
        await storage.upsertForumSubscription(postId, req.user.id);
        console.log(`📧 ✅ Auto-subscribed commenter (user ${req.user.id}) to post ${postId}`);
      } catch (subscriptionError) {
        console.error(`📧 ⚠️ Failed to auto-subscribe commenter:`, subscriptionError);
        // Don't fail the comment creation if subscription fails
      }
      
      // Send email notifications to subscribers in the background (don't block response)
      (async () => {
        try {
          // Guard against missing req.user (should not happen with requireAuth, but defensive)
          if (!req.user || !req.user.id) {
            console.error(`📧 ❌ [CRITICAL] req.user is undefined in notification background task - cannot proceed`);
            return;
          }
          
          const commenterUserId = req.user.id;
          const commenterUsername = req.user.username || 'Unknown';
          const commenterFullName = req.user.fullName || null;
          
          console.log(`📧 [NOTIFICATION FLOW START] Comment ${newComment.id} on post ${postId} by user ${commenterUserId} (${commenterUsername})`);
          
          // Get active subscribers for this post
          console.log(`📧 [STEP 1] Calling storage.getActiveSubscriptionsForPost(${postId})...`);
          const subscribers = await storage.getActiveSubscriptionsForPost(postId);
          console.log(`📧 [STEP 2] Found ${subscribers.length} active subscribers for post ${postId}`);
          
          if (subscribers.length > 0) {
            console.log(`📧 [STEP 2 DETAILS] Subscriber user IDs: [${subscribers.map(s => s.userId).join(', ')}]`);
            console.log(`📧 [STEP 2 DETAILS] Subscriber emails: [${subscribers.map(s => s.email).join(', ')}]`);
          } else {
            console.warn(`📧 ⚠️ [WARNING] Zero subscribers found for post ${postId}! This may indicate a data issue.`);
          }
          
          // Filter out the commenter (they shouldn't receive notification for their own comment)
          const recipientEmails = subscribers
            .filter(sub => sub.userId !== commenterUserId)
            .map(sub => sub.email);
          
          console.log(`📧 [STEP 3] After filtering out commenter (user ${commenterUserId}), ${recipientEmails.length} recipients remain`);
          
          if (recipientEmails.length > 0) {
            console.log(`📧 [STEP 4] Calling sendForumCommentNotificationEmail with ${recipientEmails.length} recipients...`);
            const result = await sendForumCommentNotificationEmail(
              { id: newComment.id, content: newComment.content },
              { id: post.id, title: post.title },
              { username: commenterUsername, fullName: commenterFullName },
              recipientEmails
            );
            
            console.log(`📧 [STEP 5] ✅ Email notification result: ${result.sentCount}/${result.totalCount} sent successfully`);
            if (result.sentCount < result.totalCount) {
              console.warn(`📧 ⚠️ [WARNING] Some emails failed to send: ${result.totalCount - result.sentCount} failures`);
            }
          } else {
            console.warn(`📧 ⚠️ [WARNING] No subscribers to notify after filtering (commenter excluded or no subscribers exist for post ${postId})`);
          }
          
          console.log(`📧 [NOTIFICATION FLOW END] Background notification process completed for comment ${newComment.id}`);
        } catch (notificationError) {
          // Log but don't fail the comment creation if notifications fail
          console.error(`📧 ❌ [ERROR] Failed to send email notifications for comment ${newComment.id}:`, notificationError);
          console.error(`📧 ❌ [ERROR STACK]:`, notificationError instanceof Error ? notificationError.stack : 'No stack trace');
        } finally {
          console.log(`📧 [FINALLY] Notification background task reached finally block for comment ${newComment.id}`);
        }
      })().catch(err => {
        // Catch any unhandled rejections from the async IIFE
        console.error(`📧 ❌ [CRITICAL] Unhandled rejection in notification background task:`, err);
      });
      
      res.status(201).json(newComment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid comment data", errors: error.errors });
      }
      console.error("Error creating forum comment:", error);
      res.status(500).json({ message: "Failed to create forum comment" });
    }
  });

  // Update a comment
  router.patch("/comments/:id", requireAuth, async (req, res) => {
    try {
      const commentId = parseInt(req.params.id, 10);
      if (isNaN(commentId)) {
        return res.status(400).json({ message: "Invalid comment ID" });
      }

      // Get the comment to check ownership
      const comment = await storage.getForumComment(commentId);
      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }

      // Check if user is the author or admin
      if (comment.authorId !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ message: "You don't have permission to update this comment" });
      }

      // Clean any HTML tags from the content before validation
      const cleanedData = { 
        ...req.body,
        content: req.body.content ? req.body.content.replace(/<\/?[^>]+(>|$)/g, "") : req.body.content 
      };
      const validatedData = insertForumCommentSchema.partial().parse(cleanedData);
      const updatedComment = await storage.updateForumComment(commentId, validatedData);
      
      res.json(updatedComment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid comment data", errors: error.errors });
      }
      console.error("Error updating forum comment:", error);
      res.status(500).json({ message: "Failed to update forum comment" });
    }
  });

  // Delete a comment
  router.delete("/comments/:id", requireAuth, async (req, res, next) => {
    try {
      if (req.params.id === "all") return next();
      const commentId = parseInt(req.params.id, 10);
      if (isNaN(commentId)) {
        return res.status(400).json({ message: "Invalid comment ID" });
      }

      // Get the comment to check ownership
      const comment = await storage.getForumComment(commentId);
      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }

      // Check if user is the author, post author, or admin
      const post = await storage.getForumPost(comment.postId);
      if (comment.authorId !== req.user.id && post?.userId !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ message: "You don't have permission to delete this comment" });
      }
      if (req.user.role === "admin") await assertCanPermanentDelete(req, comment.authorId);

      await storage.deleteForumComment(commentId);
      
      res.json({ success: true, message: "Comment deleted successfully" });
    } catch (error) {
      if (error instanceof PermanentDeletePermissionError) return res.status(403).json({ message: error.message });
      if (error instanceof LegalHoldError) return res.status(423).json({ error: "legal_hold", message: error.message });
      console.error("Error deleting forum comment:", error);
      res.status(500).json({ message: "Failed to delete forum comment" });
    }
  });

  // Mark all posts and comments in a category as read
  router.post("/categories/:categoryId/mark-all-read", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId, 10);
      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      const userId = req.user.id;

      // Mark all posts and their comments as read
      const result = await storage.markAllCategoryPostsAsRead(userId, categoryId);
      
      res.json({ 
        success: true, 
        message: `Marked ${result.count} items as read`,
        markedCount: result.count
      });
    } catch (error) {
      console.error("Error marking category as read:", error);
      res.status(500).json({ message: "Failed to mark category as read" });
    }
  });

  // Delete all forum content (admin only)
  router.delete("/all", requireAuth, async (req, res) => {
    try {
      // Check if user is admin
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Only administrators can delete all forum content" });
      }
      await assertCanPermanentDelete(req);

      const result = await storage.deleteAllForumContent();
      
      res.json({ 
        success: true, 
        message: "All forum content deleted successfully", 
        deletedCounts: result 
      });
    } catch (error) {
      if (error instanceof PermanentDeletePermissionError) return res.status(403).json({ message: error.message });
      console.error("Error deleting all forum content:", error);
      res.status(500).json({ message: "Failed to delete all forum content" });
    }
  });
  
  // Delete all forum comments only (admin only)
  router.delete("/comments/all", requireAuth, async (req, res) => {
    try {
      // Check if user is admin
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Only administrators can delete all forum comments" });
      }
      await assertCanPermanentDelete(req);

      const result = await storage.deleteAllForumComments();
      
      res.json({ 
        success: true, 
        message: "All forum comments deleted successfully", 
        deletedCounts: result 
      });
    } catch (error) {
      if (error instanceof PermanentDeletePermissionError) return res.status(403).json({ message: error.message });
      console.error("Error deleting all forum comments:", error);
      res.status(500).json({ message: "Failed to delete all forum comments" });
    }
  });

  // Get the forum description
  router.get("/description", async (req, res) => {
    try {
      const description = await storage.getForumDescription();
      res.json(description || { content: "", id: 0 });
    } catch (error) {
      console.error("Error fetching forum description:", error);
      res.status(500).json({ message: "Failed to fetch forum description" });
    }
  });

  // Create or update the forum description (admin only)
  router.post("/description", requireAuth, async (req, res) => {
    try {
      // Check if user is admin
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Only administrators can update forum description" });
      }

      const validatedData = insertForumDescriptionSchema.parse(req.body);
      
      // Try to get existing description first
      const existingDescription = await storage.getForumDescription();
      
      let result;
      if (existingDescription) {
        // Update existing description
        result = await storage.updateForumDescription(existingDescription.id, validatedData);
      } else {
        // Create new description
        result = await storage.createForumDescription(validatedData);
      }
      
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid description data", errors: error.errors });
      }
      console.error("Error creating/updating forum description:", error);
      res.status(500).json({ message: "Failed to create/update forum description" });
    }
  });

  // Mark a thread as read for the current user
  router.post("/posts/:postId/mark-read", requireAuth, async (req, res) => {
    try {
      const postId = parseInt(req.params.postId, 10);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const userId = req.user.id;
      
      // Get the latest comment ID for this post to mark as last read
      const latestComment = await storage.getLatestCommentForPost(postId);
      
      const readStateData = {
        userId,
        postId,
        lastReadCommentId: latestComment?.id || null,
      };

      const result = await storage.upsertForumReadState(readStateData);
      res.json({ success: true, readState: result });
    } catch (error) {
      console.error("Error marking post as read:", error);
      res.status(500).json({ message: "Failed to mark post as read" });
    }
  });

  // Mark all comments in a specific post as read
  router.post("/posts/:id/mark-all-read", requireAuth, async (req, res) => {
    try {
      const postId = parseInt(req.params.id, 10);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const userId = req.user.id;
      
      // Get the latest comment for this post to mark everything as read
      const latestComment = await storage.getLatestCommentForPost(postId);
      
      const readStateData = {
        userId,
        postId,
        lastReadCommentId: latestComment?.id || null,
      };

      const result = await storage.upsertForumReadState(readStateData);
      
      res.json({ 
        success: true, 
        message: "All comments marked as read",
        readState: result
      });
    } catch (error) {
      console.error("Error marking all post comments as read:", error);
      res.status(500).json({ message: "Failed to mark all post comments as read" });
    }
  });

  // Mark all threads in a category as read for the current user
  router.post("/categories/:categoryId/mark-all-read", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId, 10);
      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      const userId = req.user.id;
      const result = await storage.markAllCategoryPostsAsRead(userId, categoryId);
      
      res.json({ 
        success: true, 
        message: `Marked ${result.count} threads as read`,
        updatedCount: result.count 
      });
    } catch (error) {
      console.error("Error marking category posts as read:", error);
      res.status(500).json({ message: "Failed to mark category posts as read" });
    }
  });

  // Mark all forum threads as read for the current user
  router.post("/mark-all-read", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const result = await storage.markAllForumPostsAsRead(userId);
      
      res.json({ 
        success: true, 
        message: `Marked ${result.count} threads as read`,
        updatedCount: result.count 
      });
    } catch (error) {
      console.error("Error marking all forum posts as read:", error);
      res.status(500).json({ message: "Failed to mark all forum posts as read" });
    }
  });

  // Get unread status for posts in a category
  router.get("/categories/:categoryId/unread-status", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId, 10);
      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      const userId = req.user.id;
      const unreadStatus = await storage.getUnreadStatusForCategory(userId, categoryId);
      
      res.json(unreadStatus);
    } catch (error) {
      console.error("Error fetching unread status:", error);
      res.status(500).json({ message: "Failed to fetch unread status" });
    }
  });

  // Get unread comment count for a specific post
  router.get("/posts/:id/unread-comments", requireAuth, async (req, res) => {
    try {
      const postId = parseInt(req.params.id, 10);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const userId = req.user.id;
      const unreadCount = await storage.getUnreadCommentsCountForPost(postId, userId);
      
      res.json({ unreadCount });
    } catch (error) {
      console.error("Error fetching unread comments count:", error);
      res.status(500).json({ message: "Failed to fetch unread comments count" });
    }
  });

  // Get total unread forum content count across all categories
  router.get("/unread-count", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const totalUnreadCount = await storage.getTotalForumUnreadCount(userId);
      
      res.json({ unreadCount: totalUnreadCount });
    } catch (error) {
      console.error("Error fetching total forum unread count:", error);
      res.status(500).json({ message: "Failed to fetch total forum unread count" });
    }
  });

  // Get unread count specifically for Weather Updates forum (category 4)
  router.get("/categories/4/unread-count", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const categoryId = 4; // Weather Updates category
      
      // Get unread status for Weather Updates category
      const unreadStatuses = await storage.getUnreadStatusForCategory(userId, categoryId);
      const unreadCount = unreadStatuses.filter(status => status.isUnread).length;
      
      console.log(`Weather Updates unread count for user ${userId}: ${unreadCount} out of ${unreadStatuses.length} posts`);
      
      res.json({ unreadCount });
    } catch (error) {
      console.error("Error fetching Weather Updates unread count:", error);
      res.status(500).json({ message: "Failed to fetch Weather Updates unread count" });
    }
  });

  // Unsubscribe from a forum post
  router.post("/posts/:id/unsubscribe", requireAuth, async (req, res) => {
    try {
      const postId = parseInt(req.params.id, 10);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const userId = req.user.id;
      
      // Check if post exists
      const post = await storage.getForumPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Mark the subscription as unsubscribed
      const result = await storage.markUnsubscribed(postId, userId);
      
      if (result) {
        console.log(`User ${userId} unsubscribed from post ${postId}`);
        res.json({ 
          message: "Successfully unsubscribed from post notifications",
          success: true 
        });
      } else {
        // No subscription found - that's okay, user wasn't subscribed
        console.log(`User ${userId} tried to unsubscribe from post ${postId} but had no subscription`);
        res.json({ 
          message: "You were not subscribed to this post",
          success: true 
        });
      }
    } catch (error) {
      console.error("Error unsubscribing from post:", error);
      res.status(500).json({ message: "Failed to unsubscribe from post" });
    }
  });

  // Get subscription status for a post
  router.get("/posts/:id/subscription", requireAuth, async (req, res) => {
    try {
      const postId = parseInt(req.params.id, 10);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const userId = req.user.id;
      
      // Get all active subscriptions for the post and check if user is in the list
      const subscribers = await storage.getActiveSubscriptionsForPost(postId);
      const isSubscribed = subscribers.some(sub => sub.userId === userId);
      
      res.json({ isSubscribed });
    } catch (error) {
      console.error("Error checking subscription status:", error);
      res.status(500).json({ message: "Failed to check subscription status" });
    }
  });

  // Subscribe to a forum post
  router.post("/posts/:id/subscribe", requireAuth, async (req, res) => {
    try {
      const postId = parseInt(req.params.id, 10);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const userId = req.user.id;
      
      // Check if post exists
      const post = await storage.getForumPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Subscribe the user (or re-subscribe if they were unsubscribed)
      await storage.upsertForumSubscription(postId, userId);
      
      console.log(`User ${userId} subscribed to post ${postId}`);
      res.json({ 
        message: "Successfully subscribed to post notifications",
        success: true 
      });
    } catch (error) {
      console.error("Error subscribing to post:", error);
      res.status(500).json({ message: "Failed to subscribe to post" });
    }
  });

  // Get reactions for a forum post (with user details)
  router.get("/posts/:id/reactions", async (req, res) => {
    try {
      const postId = parseInt(req.params.id, 10);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const reactions = await storage.getForumReactions(postId);
      
      // Enhance reactions with user data
      const reactionsWithUsers = await Promise.all(
        reactions.map(async (reaction) => {
          const user = await storage.getUser(reaction.userId);
          return {
            ...reaction,
            user: user ? {
              id: user.id,
              username: user.username,
              avatarUrl: user.avatarUrl,
              isResident: user.isResident,
              role: user.role,
              subscriptionStatus: user.subscriptionStatus,
              hasMembershipBadge: user.hasMembershipBadge,
              createdAt: user.createdAt
            } : undefined
          };
        })
      );
      
      console.log(`Retrieved ${reactionsWithUsers.length} reactions for post ${postId}`);
      res.json(reactionsWithUsers);
    } catch (error) {
      console.error("Error fetching reactions for post:", error);
      res.status(500).json({ message: "Failed to fetch reactions for post" });
    }
  });

  // Add/toggle a reaction (like) for a forum post
  router.post("/posts/:id/reactions", requireAuth, async (req, res) => {
    try {
      const postId = parseInt(req.params.id, 10);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      // Check user permissions
      const hasAdminRole = req.user.role === 'admin';
      const isBlocked = req.user.isBlocked === true;
      
      if (!hasAdminRole && isBlocked) {
        return res.status(403).json({ 
          message: "You don't have permission to react to forum posts" 
        });
      }

      const { type } = req.body;
      if (!type || !['like'].includes(type)) {
        return res.status(400).json({ message: "Invalid reaction type" });
      }

      // Check if post exists
      const post = await storage.getForumPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Check if reaction already exists (for toggle behavior)
      const existingReaction = await storage.getForumReactionByUser(req.user.id, postId);

      if (existingReaction) {
        // If reaction exists, delete it (toggle behavior)
        await storage.deleteForumReaction(existingReaction.id);
        res.json({ success: true, message: "Reaction removed" });
      } else {
        // Create new reaction
        const newReaction = await storage.createForumReaction({
          postId,
          userId: req.user.id,
          reactionType: type
        });

        res.status(201).json(newReaction);
      }
    } catch (error) {
      console.error("Error processing forum reaction:", error);
      res.status(500).json({ message: "Failed to process forum reaction" });
    }
  });

  return router;
}