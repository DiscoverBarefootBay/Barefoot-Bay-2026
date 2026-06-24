// Global declarations for TypeScript

declare global {
  namespace NodeJS {
    interface Global {
      lastPasswordResetLink?: {
        email: string;
        token: string;
        expiresAt: Date;
      };
      lastEmailPreviewUrl?: Array<{
        to: string;
        subject: string;
        previewUrl: string;
        sentAt: Date;
      }>;
    }
  }
}

export {};