import { Router } from "express";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import { z } from "zod";
import { sendPlatinumSponsorRequestEmail } from "../sendgrid-service";
import { pool } from "../db";

const router = Router();

// Validation schemas
const FormFieldSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'email', 'textarea', 'select', 'radio', 'checkbox', 'date', 'file']),
  label: z.string(),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  required: z.boolean().optional().default(false),
  options: z.array(z.string()).optional()
});

const CreateFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  formFields: z.array(FormFieldSchema).min(1, "At least one field is required"),
  isActive: z.boolean().optional().default(true)
});

const UpdateFormSchema = CreateFormSchema.partial();

// GET /api/forms - List all forms
router.get("/", requireAuth, async (req, res) => {
  try {
    console.log("[Forms API] GET /api/forms - Fetching all forms");
    const forms = await storage.getCustomForms();
    console.log(`[Forms API] Found ${forms.length} forms`);
    res.json(forms);
  } catch (error) {
    console.error("[Forms API] Error fetching forms:", error);
    res.status(500).json({ 
      error: "Failed to fetch forms", 
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET /api/forms/:id - Get form by ID
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const formId = parseInt(req.params.id, 10);
    console.log(`[Forms API] GET /api/forms/${formId} - Fetching form by ID`);
    
    if (isNaN(formId)) {
      return res.status(400).json({ error: "Invalid form ID" });
    }

    const form = await storage.getCustomForm(formId);
    if (!form) {
      return res.status(404).json({ error: "Form not found" });
    }

    console.log(`[Forms API] Found form: ${form.title}`);
    res.json(form);
  } catch (error) {
    console.error("[Forms API] Error fetching form:", error);
    res.status(500).json({ 
      error: "Failed to fetch form", 
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET /api/forms/by-slug/:slug - Get form by slug (public access for form rendering)
router.get("/by-slug/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;
    console.log(`[Forms API] GET /api/forms/by-slug/${slug} - Fetching form by slug`);
    
    const form = await storage.getCustomFormBySlug(slug);
    if (!form) {
      return res.status(404).json({ error: "Form not found" });
    }

    console.log(`[Forms API] Found form: ${form.title}`);
    res.json(form);
  } catch (error) {
    console.error("[Forms API] Error fetching form by slug:", error);
    res.status(500).json({ 
      error: "Failed to fetch form", 
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /api/forms - Create new form
router.post("/", requireAuth, async (req, res) => {
  try {
    console.log("[Forms API] POST /api/forms - Creating new form");
    console.log("[Forms API] Request body:", JSON.stringify(req.body, null, 2));
    
    // Validate request body
    const validationResult = CreateFormSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.log("[Forms API] Validation failed:", validationResult.error.errors);
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validationResult.error.errors 
      });
    }

    const formData = validationResult.data;
    
    // Check if slug already exists
    const existingForm = await storage.getCustomFormBySlug(formData.slug);
    if (existingForm) {
      return res.status(409).json({ 
        error: "A form with this slug already exists",
        slug: formData.slug
      });
    }

    // Get current user ID from session
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Create the form
    console.log(`[Forms API] Creating form with title: ${formData.title}`);
    const newForm = await storage.createCustomForm({
      ...formData,
      requiresTermsAcceptance: formData.requiresTermsAcceptance || false,
      createdBy: userId
    });

    console.log(`[Forms API] Successfully created form with ID: ${newForm.id}`);
    res.status(201).json(newForm);
  } catch (error) {
    console.error("[Forms API] Error creating form:", error);
    res.status(500).json({ 
      error: "Failed to create form", 
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// PATCH /api/forms/:id - Update existing form
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const formId = parseInt(req.params.id, 10);
    console.log(`[Forms API] PATCH /api/forms/${formId} - Updating form`);
    
    if (isNaN(formId)) {
      return res.status(400).json({ error: "Invalid form ID" });
    }

    // Validate request body
    const validationResult = UpdateFormSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.log("[Forms API] Validation failed:", validationResult.error.errors);
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validationResult.error.errors 
      });
    }

    const updateData = validationResult.data;
    
    // Check if form exists
    const existingForm = await storage.getCustomForm(formId);
    if (!existingForm) {
      return res.status(404).json({ error: "Form not found" });
    }

    // If updating slug, check for conflicts
    if (updateData.slug && updateData.slug !== existingForm.slug) {
      const conflictingForm = await storage.getCustomFormBySlug(updateData.slug);
      if (conflictingForm && conflictingForm.id !== formId) {
        return res.status(409).json({ 
          error: "A form with this slug already exists",
          slug: updateData.slug
        });
      }
    }

    // Update the form
    console.log(`[Forms API] Updating form ${formId} with data:`, updateData);
    const updatedForm = await storage.updateCustomForm(formId, updateData);

    console.log(`[Forms API] Successfully updated form ${formId}`);
    res.json(updatedForm);
  } catch (error) {
    console.error("[Forms API] Error updating form:", error);
    res.status(500).json({ 
      error: "Failed to update form", 
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// DELETE /api/forms/:id - Delete form
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const formId = parseInt(req.params.id, 10);
    console.log(`[Forms API] DELETE /api/forms/${formId} - Deleting form`);
    
    if (isNaN(formId)) {
      return res.status(400).json({ error: "Invalid form ID" });
    }

    // Check if form exists
    const existingForm = await storage.getCustomForm(formId);
    if (!existingForm) {
      return res.status(404).json({ error: "Form not found" });
    }

    // Delete the form
    await storage.deleteCustomForm(formId);

    console.log(`[Forms API] Successfully deleted form ${formId}`);
    res.json({ message: "Form deleted successfully" });
  } catch (error) {
    console.error("[Forms API] Error deleting form:", error);
    res.status(500).json({ 
      error: "Failed to delete form", 
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /api/forms/:id/submit - Submit form data
router.post("/:id/submit", async (req, res) => {
  try {
    const formId = parseInt(req.params.id, 10);
    console.log(`[Forms API] POST /api/forms/${formId}/submit - Form submission`);
    console.log(`[Forms API] Request body:`, JSON.stringify(req.body, null, 2));
    console.log(`[Forms API] Session user ID:`, (req.session as any)?.userId);
    
    if (isNaN(formId)) {
      return res.status(400).json({ error: "Invalid form ID" });
    }

    // Check if form exists
    const form = await storage.getCustomForm(formId);
    if (!form) {
      return res.status(404).json({ error: "Form not found" });
    }

    // Store the submission
    const submissionData = {
      formId,
      formData: req.body.formData || req.body,
      userId: (req.session as any)?.userId,
      termsAccepted: req.body.termsAccepted || false,
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown'
    };
    console.log(`[Forms API] Submitting with data:`, JSON.stringify(submissionData, null, 2));
    const submission = await storage.createFormSubmission(submissionData);

    console.log(`[Forms API] Successfully stored submission ${submission.id} for form ${formId}`);

    const isPlatinumForm = form.slug?.includes('platinum');
    if (isPlatinumForm) {
      const formDataPayload = req.body.formData || req.body;
      const businessName = formDataPayload.business_name || formDataPayload.businessName || 'Unknown Business';

      console.log(`[Forms API] Platinum form detected (slug: ${form.slug}), sending notifications for submission ${submission.id}`);

      try {
        const adminResult = await pool.query(
          `SELECT id FROM users WHERE role = 'admin' ORDER BY id`
        );

        if (adminResult.rows.length === 0) {
          console.warn('[Forms API] No admin users found, skipping in-app message for platinum request');
        } else {
          const adminIds = adminResult.rows.map((r: { id: number }) => r.id);
          const senderId = adminIds[0];

          const messageContent = `A new Platinum Sponsorship request has been submitted.\n\nForm: ${form.title}\nBusiness: ${businessName}\nContact: ${formDataPayload.contact_name || formDataPayload.contactName || 'N/A'}\nEmail: ${formDataPayload.email || 'N/A'}\nPhone: ${formDataPayload.phone || 'N/A'}\nWebsite: ${formDataPayload.website || 'N/A'}\nNotes: ${formDataPayload.notes || 'None'}\n\nView this submission in the Forms Management section.`;

          const msgResult = await pool.query(
            `INSERT INTO messages (subject, content, sender_id, message_type, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
            [`Platinum Sponsor Request: ${businessName}`, messageContent, senderId, 'system']
          );
          const messageId = msgResult.rows[0].id;

          for (const adminId of adminIds) {
            await pool.query(
              `INSERT INTO message_recipients (message_id, recipient_id, status, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())`,
              [messageId, adminId, 'sent']
            );
          }

          console.log(`[Forms API] In-app message ${messageId} sent to ${adminIds.length} admin user(s): [${adminIds.join(', ')}]`);
        }
      } catch (msgErr) {
        console.error('[Forms API] ERROR: Failed to send in-app message for platinum request:', msgErr instanceof Error ? msgErr.stack : msgErr);
      }

      try {
        const emailSent = await sendPlatinumSponsorRequestEmail(form.title, formDataPayload);
        if (emailSent) {
          console.log('[Forms API] Platinum sponsor request email successfully sent to team@barefootbay.com');
        } else {
          console.error('[Forms API] ERROR: sendPlatinumSponsorRequestEmail returned false — email may not have been delivered');
        }
      } catch (emailErr) {
        console.error('[Forms API] ERROR: Failed to send platinum request email:', emailErr instanceof Error ? emailErr.stack : emailErr);
      }
    }

    res.status(201).json({ 
      message: "Form submitted successfully",
      submissionId: submission.id
    });
  } catch (error) {
    console.error("[Forms API] Error submitting form:", error);
    res.status(500).json({ 
      error: "Failed to submit form", 
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;