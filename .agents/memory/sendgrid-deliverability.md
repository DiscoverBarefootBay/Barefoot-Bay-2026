---
name: SendGrid deliverability (DKIM/DMARC) vs the Replit connector
description: Why barefootbay.com mail can land in spam, and what the SendGrid connector does/doesn't control.
---

# SendGrid deliverability vs the Replit connector

**The Replit SendGrid connector only supplies the API key + `from_email`. It does NOT
configure domain authentication (DKIM/SPF) or touch DNS.** Migrating from the SendGrid
web portal to the connector cannot, by itself, "fix" or "break" DKIM — that lives in the
SendGrid account's domain-authentication settings + the domain's DNS records, independent
of which API key sends the mail.

**Why mail goes to Spam even when SendGrid reports "delivered":** SendGrid "delivered"
only means the receiving server accepted it. Gmail/Outlook still spam-folder mail whose
visible From domain isn't authenticated. For inbox placement you need DKIM and/or SPF that
*align* with the From domain (barefootbay.com), plus a DMARC record.

**The trap that actually bit barefootbay.com:** the SendGrid account had a domain-auth
entry SendGrid *cached* as `valid:true`, but the required CNAMEs were no longer published
in live DNS (verify with an independent resolver, e.g. Google DoH `dns.google/resolve`, not
SendGrid's cached `valid` flag). With the DKIM CNAMEs missing, mail isn't signed as
barefootbay.com and the return-path falls back to `sendgrid.net`, so neither DKIM nor SPF
aligns → DMARC effectively fails → Spam. SPF already had `include:sendgrid.net`; DMARC was
present but `p=none`.

**How to diagnose (read-only, via connector API key):** `GET /v3/whitelabel/domains` lists
domain-auth entries and the exact CNAME host→data each expects; then resolve those names
against a public resolver to see if they're actually published. Check
`GET /v3/verified_senders` for single-sender fallbacks. Check suppression lists
(`/v3/suppression/{bounces,blocks,spam_reports,invalid_emails}/{email}`) and per-message
delivery via the Email Activity API (`GET /v3/messages?query=to_email="..."`, add-on is
active on this account) to tell "didn't send" apart from "delivered but in spam".

**Fix is DNS, not code:** publish the SendGrid CNAMEs at the domain's DNS host (barefootbay.com
DNS is hosted at tierra.net per its SPF `include:_spf.tierra.net`), then re-validate the
domain in SendGrid and set it default; delete stale invalid domain-auth entries. The agent
cannot publish registrar DNS — that's an owner action.

**Sender address:** all outgoing mail is forced to `team@barefootbay.com` inside `sendEmail`
(constant `FROM_EMAIL`); callers' `from` is ignored, so it can't drift.
