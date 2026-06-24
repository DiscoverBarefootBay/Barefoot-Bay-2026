import { Router, Request, Response } from 'express';
import { db } from '../storage';
import { formSubmissions, customForms } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * Handle contact form submissions
 * This endpoint processes submissions from the Contact Us form
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Retrieve the form data from the request
    const { inquiryType, name, email, subject, message, ...additionalData } = req.body;
    
    // Validate required fields
    if (!inquiryType || !email || !subject || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    // Check if we have a contact form in the database
    const contactForm = await db.query.customForms.findFirst({
      where: eq(customForms.slug, "contact-us")
    });
    
    // If contact form doesn't exist, create it
    let formId: number;
    if (!contactForm) {
      // Create a new contact form
      const result = await db.insert(customForms).values({
        title: "Contact Us Form",
        description: "Form for handling contact inquiries",
        formFields: [
          { name: "inquiryType", label: "Inquiry Type", type: "select", required: true },
          { name: "name", label: "Name", type: "text", required: true },
          { name: "email", label: "Email", type: "email", required: true },
          { name: "subject", label: "Subject", type: "text", required: true },
          { name: "message", label: "Message", type: "textarea", required: true }
        ],
        slug: "contact-us",
        requiresTermsAcceptance: false,
      }).returning({ id: customForms.id });
      
      formId = result[0].id;
    } else {
      formId = contactForm.id;
    }
    
    // Store the form submission
    await db.insert(formSubmissions).values({
      formId,
      submitterEmail: email,
      userId: req.user?.id, // If user is logged in
      formData: {
        inquiryType,
        name,
        email,
        subject,
        message,
        ...additionalData
      },
      ipAddress: req.ip,
    });
    
    res.json({ success: true, message: "Form submitted successfully" });
  } catch (error) {
    console.error("Error submitting contact form:", error);
    res.status(500).json({ error: "Failed to submit the form" });
  }
});

export default router;