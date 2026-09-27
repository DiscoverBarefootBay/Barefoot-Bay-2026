import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { organizeRecipients, type ChatRecipient } from '../components/chat/recipient-options';

const recipients: ChatRecipient[] = [
  { id: 'all', name: 'All Users' },
  { id: 'admin', name: 'All Admins' },
  { id: '12', name: 'Zoë Reyes (apple)', fullName: 'Zoë Reyes', username: 'apple' },
  { id: '13', name: 'Amy Smith (zebra)', fullName: 'Amy Smith', username: 'zebra' },
  { id: '14', name: 'Ben Lee (BEACH44)', fullName: 'Ben Lee', username: 'BEACH44' },
];

describe('chat recipient search and sort', () => {
  it('matches full names or usernames regardless of case without searching groups', () => {
    assert.deepEqual(organizeRecipients(recipients, ' ZOË ', 'name-asc').people.map(r => r.id), ['12']);
    assert.deepEqual(organizeRecipients(recipients, 'beach44', 'name-asc').people.map(r => r.id), ['14']);
    assert.deepEqual(organizeRecipients(recipients, 'all users', 'name-asc').people, []);
    assert.deepEqual(organizeRecipients(recipients, 'no one', 'name-asc').groups.map(r => r.id), ['all', 'admin']);
  });

  it('sorts people by either field in both directions without moving group options', () => {
    const ids = (sort: Parameters<typeof organizeRecipients>[2]) =>
      organizeRecipients(recipients, '', sort).people.map(r => r.id);
    assert.deepEqual(ids('name-asc'), ['13', '14', '12']);
    assert.deepEqual(ids('name-desc'), ['12', '14', '13']);
    assert.deepEqual(ids('username-asc'), ['12', '14', '13']);
    assert.deepEqual(ids('username-desc'), ['13', '14', '12']);
    assert.deepEqual(recipients.map(r => r.id), ['all', 'admin', '12', '13', '14'], 'the source list is not mutated');
  });

  it('keeps the selected recipient in the dropdown even when filtered out', () => {
    const composer = readFileSync(new URL('../components/chat/EnhancedMessageComposer.tsx', import.meta.url), 'utf8');
    assert.match(composer, /selectedIsFiltered && \(/);
    assert.match(composer, /<option value=\{recipient\}>\{selectedEntry\.name\}<\/option>/);
    assert.match(composer, /<optgroup label="Groups">/);
    assert.match(composer, /<optgroup label="People">/);
    assert.match(composer, /role="status">No people match your search/);
    assert.match(composer, /formData\.append\('recipient', recipient\)/);
    assert.match(composer, /disabled=\{targetedUsers\.count > 0\}/);
  });
});