export interface MessageTemplate {
  id: string;
  name: string;
  description?: string;
  subject: string;
  content: string;
  targetType: 'specific' | 'dynamic';
  targetRecipient?: string;
  targetQuery?: string;
}

// Templates available in the system
export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: 'sponsorship_renewal',
    name: '7-Day Sponsorship Renewal Reminder',
    description: 'Reminder for users with expiring sponsorships within a week',
    subject: 'Reminder: Renew Your Sponsorship Benefits',
    content: `Hi {{firstName}},

We noticed your sponsorship benefits are set to expire on {{expirationDate}}. 

To maintain your access to exclusive features and support the platform, please renew your sponsorship by visiting your Account Page.

Thank you for being part of our community!

— The Admin Team`,
    targetType: 'dynamic',
    targetQuery: 'sponsorship_expiring_7days'
  },
  {
    id: 'welcome_new_users',
    name: 'Welcome Message for New Users',
    description: 'Welcome message for all newly registered users',
    subject: 'Welcome to Barefoot Bay Community!',
    content: `Hello {{firstName}},

Welcome to the Barefoot Bay Community platform! We're thrilled to have you join us.

Here are a few things you can do to get started:
• Complete your profile in the Account settings
• Explore the community forums to meet other members
• Check out upcoming events in the Calendar section
• Browse local businesses and services in our Vendors area

If you have any questions or need assistance, please don't hesitate to reach out to our admin team.

We hope you enjoy being part of our community!

Best regards,
The Barefoot Bay Community Team`,
    targetType: 'dynamic',
    targetQuery: 'newly_registered_users'
  },
  {
    id: 'welcome_paid',
    name: 'Welcome Message for New Paid Users',
    description: 'Welcome message for newly paid users',
    subject: 'Welcome to Your Premium Sponsorship!',
    content: `Hello {{firstName}},

Thank you for becoming a premium sponsor of Barefoot Bay Community!

Your sponsorship helps us maintain and improve this platform for everyone. You now have access to exclusive features and content.

If you have any questions about your sponsorship benefits, please don't hesitate to contact us.

Best regards,
The Barefoot Bay Community Team`,
    targetType: 'dynamic',
    targetQuery: 'new_paid_users'
  },
  {
    id: 'badge_holder_upgrade',
    name: 'Badge Holder Upgrade Offer',
    description: 'Upgrade offer for badge holders',
    subject: 'Special Offer for Badge Holders',
    content: `Hello {{firstName}},

As a valued badge holder in our community, we're offering you a special discount on premium sponsorship!

Upgrade today and get access to all premium features while supporting our community platform.

Visit your account page to learn more about this exclusive offer.

Best regards,
The Barefoot Bay Community Team`,
    targetType: 'dynamic',
    targetQuery: 'badge_holders'
  },
  {
    id: 'bug_report',
    name: 'Bug Report',
    description: 'Template for bug reports submitted via contact form',
    subject: 'Bug Report: {{subject}}',
    content: `Bug Report submitted by: {{firstName}}

Description:
{{message}}

---
This message was automatically generated from a Contact Us form submission.
Please reply directly to this message to communicate with the user about this bug report.`,
    targetType: 'specific',
    targetRecipient: 'admin'
  },
  {
    id: 'feature_request',
    name: 'Feature Request',
    description: 'Template for feature requests submitted via contact form',
    subject: 'Feature Request: {{subject}}',
    content: `Feature Request submitted by: {{firstName}}

Description:
{{message}}

---
This message was automatically generated from a Contact Us form submission.
Please reply directly to this message to communicate with the user about this feature request.`,
    targetType: 'specific',
    targetRecipient: 'admin'
  },
  {
    id: 'other_feedback',
    name: 'Other Feedback',
    description: 'Template for other feedback submitted via contact form',
    subject: 'Feedback: {{subject}}',
    content: `Feedback submitted by: {{firstName}}

Description:
{{message}}

---
This message was automatically generated from a Contact Us form submission.
Please reply directly to this message to communicate with the user about their feedback.`,
    targetType: 'specific',
    targetRecipient: 'admin'
  },
  {
    id: 'custom',
    name: 'Custom (No Template)',
    description: 'Start with a blank message',
    subject: '',
    content: '',
    targetType: 'specific'
  }
];