export interface DmcaPolicySection {
  key: string;
  title: string;
  body: string;
  pendingCounselReview: boolean;
}

const PENDING = "[PLACEHOLDER — PENDING COUNSEL REVIEW. This wording is not final and will be replaced with counsel-approved text.]";

const placeholder = (key: string, title: string, detail: string): DmcaPolicySection => ({
  key,
  title,
  body: `${PENDING}\n\n${detail}`,
  pendingCounselReview: true,
});

export const DEFAULT_DMCA_POLICY_SECTIONS: readonly DmcaPolicySection[] = [
  placeholder("policy", "Copyright/DMCA Policy", [
    "Discover Barefoot Bay respects the intellectual property rights of others and expects its users to do the same. We respond to notices of alleged copyright infringement that comply with the Digital Millennium Copyright Act (\"DMCA\"), 17 U.S.C. § 512.",
    "If you believe material available on this site infringes a copyright you own or are authorized to enforce, you may send a written notice to our Designated Agent as described below. Every notice is reviewed by a person; nothing is removed automatically.",
    "Under 17 U.S.C. § 512(f), any person who knowingly materially misrepresents that material or activity is infringing, or that it was removed or disabled by mistake or misidentification, may be liable for damages, including costs and attorneys' fees.",
  ].join("\n\n")),
  placeholder("designated_agent", "Designated Agent", "Notices of claimed infringement should be directed to our Designated Agent at the contact information below. The Designated Agent only accepts copyright notices and counter-notices; other inquiries sent to this contact may not receive a response."),
  placeholder("submit_notice", "How to submit a copyright notice", [
    "The easiest way to submit a notice is our online notice form. You may also send a written notice to the Designated Agent by mail or email. To be effective under 17 U.S.C. § 512(c)(3), your notice must include substantially the following:",
    "- A physical or electronic signature of a person authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.",
    "- Identification of the copyrighted work claimed to have been infringed (or, if multiple works are covered by a single notice, a representative list).",
    "- Identification of the material that is claimed to be infringing and information reasonably sufficient to permit us to locate it, such as the specific Barefoot Bay URL(s).",
    "- Information reasonably sufficient to permit us to contact you, such as your name, mailing address, telephone number and email address.",
    "- A statement that you have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.",
    "- A statement that the information in the notification is accurate, and under penalty of perjury, that you are authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.",
    "Notices that do not substantially include these elements may not be acted upon; we may contact you for the missing information.",
  ].join("\n")),
  placeholder("submit_counter_notice", "How to submit a counter-notice", [
    "If material you posted was removed or disabled because of a copyright notice and you believe this was a mistake or misidentification, you may send a counter-notice to the Designated Agent. Under 17 U.S.C. § 512(g)(3), a counter-notice must include substantially the following:",
    "- Your physical or electronic signature.",
    "- Identification of the material that was removed or disabled and the location at which it appeared before it was removed or disabled.",
    "- A statement under penalty of perjury that you have a good faith belief that the material was removed or disabled as a result of mistake or misidentification of the material to be removed or disabled.",
    "- Your name, address and telephone number, and a statement that you consent to the jurisdiction of the Federal District Court for the judicial district in which your address is located (or, if your address is outside the United States, any judicial district in which the service provider may be found), and that you will accept service of process from the person who provided the original notice or an agent of that person.",
    "Uploaders whose content was disabled are notified with instructions for submitting a counter-notice.",
  ].join("\n")),
  placeholder("repeat_infringer", "Repeat-infringer policy", [
    "In appropriate circumstances, Discover Barefoot Bay will disable and/or terminate the accounts of users who are repeat infringers, as required by 17 U.S.C. § 512(i).",
    "A user may be considered a repeat infringer when they are the subject of multiple valid copyright notices within a defined period. Notices that are withdrawn, rejected, or successfully countered do not count toward this policy. Each account decision is made by a person after review.",
  ].join("\n\n")),
  placeholder("after_notice", "What happens after a notice", [
    "- You receive a confirmation email with your case number, the date received, a summary of your submission, and a private link where you can check the case status.",
    "- A staff member reviews the notice for the required elements. Software only checks which elements appear to be present; it never decides whether infringement occurred.",
    "- If information is missing, we may contact you and the case status will show \"Needs information\".",
    "- If the notice is accepted, the identified material is expeditiously removed or access to it is disabled, and the uploader is notified and given an opportunity to submit a counter-notice.",
    "- If the notice is not accepted, the case is closed.",
  ].join("\n")),
  placeholder("after_counter_notice", "What happens after a counter-notice", [
    "- A staff member reviews the counter-notice for the required elements.",
    "- If the counter-notice is complete, we promptly send a copy to the person who submitted the original notice, informing them that we will restore the removed material or cease disabling access to it in 10 business days.",
    "- Unless our Designated Agent first receives notice that the original claimant has filed an action seeking a court order to restrain the uploader from engaging in infringing activity relating to the material, the material may be restored not less than 10, nor more than 14, business days following receipt of the counter-notice (17 U.S.C. § 512(g)(2)(C)).",
    "- If notice of a court action is received, the material stays disabled.",
  ].join("\n")),
];

export const DMCA_POLICY_KEYS = DEFAULT_DMCA_POLICY_SECTIONS.map((section) => section.key);

export function mergePolicySections(value: unknown): DmcaPolicySection[] {
  const stored = new Map<string, Partial<DmcaPolicySection>>();
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === "object" && typeof (item as any).key === "string") stored.set((item as any).key, item as any);
    }
  }
  return DEFAULT_DMCA_POLICY_SECTIONS.map((fallback) => {
    const item = stored.get(fallback.key);
    return item ? {
      key: fallback.key,
      title: typeof item.title === "string" ? item.title : fallback.title,
      body: typeof item.body === "string" ? item.body : fallback.body,
      pendingCounselReview: typeof item.pendingCounselReview === "boolean" ? item.pendingCounselReview : fallback.pendingCounselReview,
    } : { ...fallback };
  });
}