const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]!));

const shell = (heading: string, content: string) =>
  `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#222;max-width:680px;margin:auto"><h2 style="color:#174f3b">${escapeHtml(heading)}</h2>${content}</div>`;

const formatReceived = (d: Date) =>
  `${d.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "long", timeStyle: "long" })} (${d.toISOString()})`;

export function claimantNoticeEmail(input: {
  caseNumber: string; receivedAt: Date; name: string; workTitle: string; urls: string[];
  company?: string | null; email?: string | null; phone?: string | null; address?: string | null;
  role?: string | null; copyrightOwnerName?: string | null; workDescription?: string | null;
  referenceUrl?: string | null; signature?: string | null;
  statusUrl: string; agent: { name: string | null; organization: string | null; email: string | null; phone: string | null; address: string | null };
}) {
  const received = formatReceived(input.receivedAt);
  const roleLabel = input.role === "agent"
    ? `Authorized agent acting for ${input.copyrightOwnerName || "the copyright owner"}`
    : input.role === "owner" ? "Copyright owner" : null;
  const summary: [string, string | null | undefined][] = [
    ["Name", input.name],
    ["Company / organization", input.company],
    ["Email", input.email],
    ["Phone", input.phone],
    ["Mailing address", input.address],
    ["Submitting as", roleLabel],
    ["Copyrighted work", input.workTitle],
    ["Description of the work", input.workDescription],
    ["Original / reference URL", input.referenceUrl],
    ["Electronic signature", input.signature],
  ];
  const present = summary.filter(([, v]) => v != null && String(v).trim() !== "") as [string, string][];
  const urlsText = input.urls.map((u) => `- ${u}`).join("\n");
  const agentText = [input.agent.name, input.agent.organization, input.agent.address, input.agent.phone, input.agent.email].filter(Boolean).join("\n");
  const text = [
    "We received your copyright (DMCA) notice. A staff member will review it; nothing is removed automatically.",
    "",
    `Case number: ${input.caseNumber}`,
    `Date received: ${received}`,
    `Status: Received — review required`,
    "",
    "Summary of your submission:",
    ...present.map(([k, v]) => `${k}: ${v}`),
    "Reported Barefoot Bay URLs:",
    urlsText,
    "",
    `Check your case status (keep this link private): ${input.statusUrl}`,
    "",
    "Designated Agent:",
    agentText || "Contact details are being finalized.",
  ].join("\n");
  const rows = present.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;vertical-align:top;color:#555;white-space:nowrap"><strong>${escapeHtml(k)}</strong></td><td style="padding:4px 0;white-space:pre-line">${escapeHtml(v)}</td></tr>`).join("");
  const list = input.urls.map((u) => `<li>${escapeHtml(u)}</li>`).join("");
  const html = shell("Copyright notice received",
    `<p>We received your copyright (DMCA) notice. A staff member will review it; nothing is removed automatically.</p>`
    + `<p><strong>Case number:</strong> ${escapeHtml(input.caseNumber)}<br><strong>Date received:</strong> ${escapeHtml(received)}<br><strong>Status:</strong> Received — review required</p>`
    + `<h3 style="color:#174f3b">Summary of your submission</h3><table style="border-collapse:collapse">${rows}</table>`
    + `<p><strong>Reported Barefoot Bay URLs</strong></p><ul>${list}</ul>`
    + `<p><a href="${escapeHtml(input.statusUrl)}">Check your case status</a> (keep this link private)</p>`
    + `<h3 style="color:#174f3b">Designated Agent</h3><p>${escapeHtml(agentText || "Contact details are being finalized.").replace(/\n/g, "<br>")}</p>`);
  return { subject: `Copyright notice received — ${input.caseNumber}`, text, html };
}

export function adminNoticeEmail(input: {
  caseNumber: string; claimantName: string; claimantEmail: string; urlCount: number;
  completeness: Record<string, unknown>; adminUrl: string;
}) {
  const summary = `allPresent=${String(input.completeness.allPresent)}, matched=${String(input.completeness.matchedCount)}, unmatched=${String(input.completeness.unmatchedCount)}`;
  const text = `New DMCA notice ${input.caseNumber}\nClaimant: ${input.claimantName} <${input.claimantEmail}>\nURLs: ${input.urlCount}\nCompleteness: ${summary}\nReview: ${input.adminUrl}`;
  return {
    subject: `New DMCA notice — ${input.caseNumber}`,
    text,
    html: shell("New DMCA notice", `<p><strong>Case:</strong> ${escapeHtml(input.caseNumber)}<br><strong>Claimant:</strong> ${escapeHtml(input.claimantName)} &lt;${escapeHtml(input.claimantEmail)}&gt;<br><strong>URLs:</strong> ${escapeHtml(input.urlCount)}<br><strong>Completeness:</strong> ${escapeHtml(summary)}</p><p><a href="${escapeHtml(input.adminUrl)}">Open admin dashboard</a></p>`),
  };
}