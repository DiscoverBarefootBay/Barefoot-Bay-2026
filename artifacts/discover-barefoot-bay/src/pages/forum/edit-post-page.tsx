import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Save, Loader2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import WysiwygEditorForum from '@/components/shared/wysiwyg-editor-forum';

// Local interfaces
interface ForumPost {
  id: number;
  title: string;
  content: string;
  categoryId: number;
  userId: number;
  customPreview?: string;
  hideDefaultTitle?: boolean;
  createdAt: string;
  updatedAt: string;
  author: {
    id: number;
    username: string;
    avatarUrl: string | null;
  };
}

interface ForumCategory {
  id: number;
  name: string;
  description: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

// Zod schema for form validation
const editPostSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  categoryId: z.string().min(1, 'Category is required'),
  customPreview: z.string().optional(),
  hideDefaultTitle: z.boolean().optional().default(false),
});

type EditPostFormValues = z.infer<typeof editPostSchema>;

export default function EditPostPage() {
  const params = useParams<{ postId: string }>();
  const postId = parseInt(params.postId, 10);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { isAdmin, hasPermission } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [editorContent, setEditorContent] = useState("");
  
  // Fetch forum categories
  const { data: categories, isLoading: categoriesLoading } = useQuery<ForumCategory[]>({
    queryKey: ["/api/forum/categories"],
  });

  // Fetch post details
  const { 
    data: post, 
    isLoading: isLoadingPost 
  } = useQuery<ForumPost>({
    queryKey: [`/api/forum/posts/${postId}`],
    enabled: !isNaN(postId),
  });

  const { register, handleSubmit, formState: { errors }, setValue, watch, reset } = useForm<EditPostFormValues>({
    resolver: zodResolver(editPostSchema),
    defaultValues: {
      title: "",
      content: "",
      categoryId: "",
      customPreview: "",
      hideDefaultTitle: false,
    },
  });

  const queryClient = useQueryClient();

  // Update post mutation
  const updatePostMutation = useMutation({
    mutationFn: async (data: EditPostFormValues) => {
      const response = await fetch(`/api/forum/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          content: editorContent,
          categoryId: parseInt(data.categoryId.toString(), 10),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update post');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Post updated successfully!",
      });
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: [`/api/forum/posts/${postId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/forum/posts"] });
      navigate(`/forum/post/${postId}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Load post data when available
  useEffect(() => {
    if (post) {
      setValue('title', post.title);
      setValue('categoryId', post.categoryId.toString());
      setValue('content', post.content);
      setValue('customPreview', post.customPreview || '');
      setValue('hideDefaultTitle', !!post.hideDefaultTitle);
      setEditorContent(post.content);
      setLoading(false);
    }
  }, [post, setValue]);

  // Set form content when editor content changes
  useEffect(() => {
    setValue('content', editorContent);
  }, [editorContent, setValue]);

  // Check if user can edit this post
  useEffect(() => {
    if (post && user && !loading) {
      // Allow admin users to edit posts - simplified permission check
      const canEdit = isAdmin;
      
      if (!isAdmin) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to edit this post.",
          variant: "destructive",
        });
        navigate('/forum');
      }
    }
  }, [post, user, isAdmin, loading, navigate, toast]);

  const onSubmit = (data: EditPostFormValues) => {
    updatePostMutation.mutate(data);
  };

  if (isNaN(postId)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-6">
              <p className="text-red-500">Invalid post ID</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoadingPost || categoriesLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading post...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-6">
              <p className="text-red-500">Post not found</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate(`/forum/post/${postId}`)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Post
          </Button>
          <h1 className="text-2xl font-bold text-navy">Edit Post</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Edit Story</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-navy">Category</Label>
                  <Select 
                    onValueChange={(value) => setValue('categoryId', value)}
                    defaultValue={post.categoryId.toString()}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.categoryId && (
                    <p className="text-sm text-red-500">{errors.categoryId.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title" className="text-navy">Title</Label>
                  <Input
                    id="title"
                    {...register("title")}
                    placeholder="Enter post title"
                    className="border-navy/20"
                  />
                  {errors.title && (
                    <p className="text-sm text-red-500">{errors.title.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customPreview" className="text-navy">Custom Preview Text</Label>
                <Textarea
                  id="customPreview"
                  {...register("customPreview")}
                  placeholder="Optional: Enter custom preview text for this post (leave empty for auto-generated preview)"
                  className="border-navy/20 min-h-[80px]"
                  rows={3}
                />
                <p className="text-sm text-gray-600">
                  Custom preview text will be shown in post listings instead of auto-generated content preview.
                </p>
              </div>

              <div className="flex items-center gap-2 px-2 h-9 rounded-md border border-navy/20 w-fit">
                <Checkbox
                  id="hide-default-title"
                  checked={!!watch('hideDefaultTitle')}
                  onCheckedChange={(checked) =>
                    setValue('hideDefaultTitle', checked === true)
                  }
                  data-testid="checkbox-hide-default-title"
                />
                <Label
                  htmlFor="hide-default-title"
                  className="text-sm text-navy/80 cursor-pointer select-none"
                >
                  Hide default title
                </Label>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="content" className="text-navy">Content</Label>
                </div>
                
                {/* Hidden field for content validation */}
                <input 
                  type="hidden" 
                  {...register("content")} 
                />
                
                <div className="border border-navy/20 rounded-md overflow-hidden">
                  <Tabs defaultValue="editor" className="w-full">
                    <TabsList className="w-full bg-gray-50 border-b border-navy/10">
                      <TabsTrigger value="editor" className="flex-1">Rich Editor</TabsTrigger>
                      <TabsTrigger value="basic" className="flex-1">Basic Editor</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="editor" className="mt-0">
                      <WysiwygEditorForum
                        editorContent={editorContent} 
                        setEditorContent={setEditorContent} 
                        editorContext={{
                          section: 'forum',
                          slug: `forum-post-${postId}`
                        }}
                      />
                    </TabsContent>
                    
                    <TabsContent value="basic" className="mt-0 p-2">
                      <Textarea
                        id="content-textarea"
                        placeholder="Write your post content here..."
                        className="min-h-[400px] border-navy/20"
                        value={editorContent}
                        onChange={(e) => {
                          setEditorContent(e.target.value);
                          setValue("content", e.target.value);
                        }}
                      />
                    </TabsContent>
                  </Tabs>
                </div>
                
                {errors.content && (
                  <p className="text-sm text-red-500">{errors.content.message}</p>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="bg-coral hover:bg-coral/90 text-white"
                  disabled={updatePostMutation.isPending}
                >
                  {updatePostMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface ForumCategory {
  id: number;
  name: string;
  description: string;
  slug: string;
  icon?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ForumPost {
  id: number;
  title: string;
  content: string;
  categoryId: number;
  authorId: number;
  isSticky: boolean;
  isLocked: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}