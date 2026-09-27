export type ChatRecipient = {
  id: number | string;
  name: string;
  fullName?: string | null;
  username?: string | null;
};

export type RecipientSort = 'name-asc' | 'name-desc' | 'username-asc' | 'username-desc';

export function isIndividualRecipient(recipient: ChatRecipient): boolean {
  return /^\d+$/.test(String(recipient.id));
}

export function organizeRecipients(recipients: ChatRecipient[], search: string, sort: RecipientSort) {
  const groups = recipients.filter(recipient => !isIndividualRecipient(recipient));
  const query = search.trim().toLocaleLowerCase();
  const people = recipients
    .filter(isIndividualRecipient)
    .filter(recipient =>
      !query ||
      (recipient.fullName ?? recipient.name).toLocaleLowerCase().includes(query) ||
      (recipient.username ?? '').toLocaleLowerCase().includes(query))
    .sort((a, b) => {
      const byUsername = sort.startsWith('username');
      const value = (recipient: ChatRecipient) =>
        (byUsername ? recipient.username : recipient.fullName) || recipient.name;
      const order = value(a).localeCompare(value(b), undefined, { sensitivity: 'base', numeric: true });
      const stableOrder = order || String(a.id).localeCompare(String(b.id));
      return sort.endsWith('desc') ? -stableOrder : stableOrder;
    });

  return { groups, people };
}