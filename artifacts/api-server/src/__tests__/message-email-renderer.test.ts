import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderMessageEmailContent } from '../message-email-renderer';

const input = {
  subject: 'A subject',
  messageContent: 'First line\r\nSecond line\r\n\r\n\r\n\r\nThird paragraph',
  senderName: 'Jamie',
  recipientName: 'Alex',
  displayNames: [] as string[],
  baseUrl: 'https://barefootbay.com',
};

describe('message email rendering', () => {
  it('keeps single line breaks without doubling them, and collapses excessive paragraph gaps', () => {
    const result = renderMessageEmailContent(input);
    assert.match(result.bodyHtml, /First line<br \/>Second line<\/p><p style="margin:0 0 0 0;[^"]*">Third paragraph<\/p>/);
    assert.doesNotMatch(result.bodyHtml, /white-space:pre-wrap|<br \/><br \/>/);
    assert.match(result.text, /Subject: A subject\n\nFirst line\nSecond line\n\nThird paragraph\n\n---/);
    assert.doesNotMatch(result.text, /\r|\n{3,}/);
  });

  it('treats whitespace-only lines as paragraph gaps and does not invent gaps for a single newline', () => {
    const result = renderMessageEmailContent({ ...input, messageContent: 'one\n  \n \n two\nthree ' });
    assert.equal(result.text.includes('one\n\n two\nthree'), true);
    assert.match(result.bodyHtml, /one<\/p><p [^>]*> two<br \/>three<\/p>/);
  });

  it('escapes every user-provided HTML field and normalizes labels in headers and text', () => {
    const result = renderMessageEmailContent({
      ...input,
      subject: '<b>"News" & updates</b>\nextra',
      senderName: 'J<script>\r\nDoe',
      recipientName: 'Al & <ex>',
      messageContent: '<img src="x"> & it\'s "fine"',
      displayNames: ['<invoice> & "report".pdf'],
      isReply: true,
    });
    assert.equal(result.emailSubject, 'J<script> Doe replied to your message: <b>"News" & updates</b> extra');
    assert.match(result.titleHtml, /&lt;b&gt;&quot;News&quot; &amp; updates&lt;\/b&gt;/);
    assert.equal(result.greetingHtml, 'Hi Al &amp; &lt;ex&gt;,');
    assert.equal(result.senderHtml, 'J&lt;script&gt; Doe');
    assert.match(result.subjectHtml, /&lt;b&gt;&quot;News&quot; &amp; updates&lt;\/b&gt; extra/);
    assert.equal(result.bodyHtml.includes('&lt;img src=&quot;x&quot;&gt; &amp; it&#39;s &quot;fine&quot;'), true);
    assert.deepEqual(result.attachmentNamesHtml, ['&lt;invoice&gt; &amp; &quot;report&quot;.pdf']);
    assert.match(result.text, /Attachments \(1\): <invoice> & "report".pdf\n\n---/);
  });

  it('keeps reply and optional attachment sections consistent', () => {
    const result = renderMessageEmailContent({ ...input, recipientName: undefined, isReply: true });
    assert.equal(result.greetingHtml, 'Hello,');
    assert.equal(result.emailSubject, 'Jamie replied to your message: A subject');
    assert.doesNotMatch(result.text, /Attachments/);
  });
});