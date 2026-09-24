export type CaseDetail = {
  case: Record<string, any> & { id: string; caseNumber: string; status: string; statusLabel: string; claimantName?: string; adminAssignedId?: number | null; assignedAdminId?: string | null; restoreEligibleAt?: string | null; restoreDeadlineAt?: string | null; legalHold?: boolean };
  submissions: Array<{ id: string; submissionType: string; receivedAt: string; submittedByName: string; formPayload: Record<string, any>; signatureValue?: string; originalDocumentPath?: string; hasDocument: boolean }>;
  targets: Array<{ id: string; contentType: string; contentId: string; originalUrl?: string; status: string; state: string; onHold: boolean; preview: { title?: string; excerpt?: string; url?: string; ownerId?: string } | null; quarantinedFiles: Array<{ id: string; fileBasename: string; status: string }> }>;
  uploaders: Array<{ id: string; username: string; fullName?: string; email?: string; createdAt: string; isBlocked: boolean; priorEvents: Array<Record<string, any>> }>;
  holds: Array<Record<string, any>>;
  notes: Array<{ id: string; authorName: string; body: string; createdAt: string }>;
  timeline: Array<{ id: string; event: string; actorName?: string; actorType: string; createdAt: string; previousValue?: any; newValue?: any; notes?: string }>;
  availableActions: string[];
};