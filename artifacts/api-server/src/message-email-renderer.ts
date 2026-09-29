/** Pure rendering for the user-supplied portions of a message notification email. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Whitespace-only lines are blank lines; three or more consecutive newlines
// are just one paragraph boundary. A single newline remains a line break.
function normalizeBody(value: string): string {
  return value.replace(/\r\n?/g, '\n')
    .split('\n').map(line => line.trimEnd()).join('\n')
    .replace(/\n[ \t]*(?=\n)/g, '\n')
    .trim()
    .replace(/\n{3,}/g, '\n\n');
}

// Headings and names should not be able to inject additional text lines.
function normalizeLabel(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function renderMessageEmailContent({
  subject, messageContent, senderName, recipientName, isReply, displayNames, baseUrl
}: {
  subject: string;
  messageContent: string;
  senderName: string;
  recipientName?: string;
  isReply?: boolean;
  displayNames: string[];
  baseUrl: string;
}) {
  const safeSender = normalizeLabel(senderName);
  const safeSubject = normalizeLabel(subject);
  const greeting = recipientName ? `Hi ${normalizeLabel(recipientName)},` : 'Hello,';
  const introVerb = isReply ? 'replied to your message' : 'sent you a message';
  const emailSubject = `${safeSender} ${introVerb}: ${safeSubject}`;
  const body = normalizeBody(messageContent);
  const names = displayNames.map(normalizeLabel);
  const paragraphs = body ? body.split('\n\n') : [];
  const bodyHtml = paragraphs.map((paragraph, index) =>
    `<p style="margin:0 0 ${index === paragraphs.length - 1 ? '0' : '12px'} 0;font-size:14px;line-height:22px;color:#374151;word-wrap:break-word;">${paragraph.split('\n').map(escapeHtml).join('<br />')}</p>`
  ).join('');

  const text = [
    greeting,
    `${safeSender} has ${introVerb}.`,
    `Subject: ${safeSubject}`,
    body,
    ...(names.length ? [`Attachments (${names.length}): ${names.join(', ')}`] : []),
    '---',
    `View your messages and reply: ${baseUrl}/messages`,
    `To stop receiving email notifications, visit: ${baseUrl}/unsubscribe`
  ].join('\n\n');

  return {
    emailSubject,
    titleHtml: escapeHtml(emailSubject),
    text,
    bodyHtml,
    greetingHtml: escapeHtml(greeting),
    senderHtml: escapeHtml(safeSender),
    subjectHtml: escapeHtml(safeSubject),
    attachmentNamesHtml: names.map(escapeHtml),
  };
}