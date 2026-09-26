-- Owner-run production update for https://barefootbay.com/dmca
-- Source: attached lawyer CLIENT DRAFT. The sections are marked Pending counsel review.
-- If counsel has approved this exact wording for final publication, change all seven
-- pendingCounselReview values to false before running. This file does not run itself.
-- Run the whole statement in Database > Production > My Data > Edit > SQL runner.
-- Expect one result row: APPLIED, target_id 1, section_count 7.
-- Re-running writes another audit entry and updates the timestamp; do not run twice needlessly.
WITH previous AS (
  SELECT jsonb_build_object(
    'agent_name', agent_name, 'agent_organization', agent_organization,
    'agent_address', agent_address, 'agent_phone', agent_phone,
    'agent_email', agent_email, 'policy_sections', policy_sections
  ) AS value FROM dmca_settings WHERE id = 1
), policy AS (
  SELECT jsonb_build_array(
    jsonb_build_object('key', 'policy', 'title', 'DMCA Notice & Takedown Policy',
      'body', $section_0$Tattler Media, LLC operates www.tattlermedia.com and www.barefootbay.com (the “Sites”) and qualifies as a “Service Provider” within the meaning of 17 U.S.C. § 512(k)(1) of the Digital Millennium Copyright Act (“DMCA”). Accordingly, it is entitled to certain protections from claims of copyright infringement under the DMCA, commonly referred to as the “safe harbor” provisions. We respect the intellectual property of others, and we ask our users to do the same. Thus, we observe and comply with the DMCA, and have adopted the following Notice and Takedown Policy relating to claims of copyright infringement by our users.$section_0$, 'pendingCounselReview', true),
    jsonb_build_object('key', 'designated_agent', 'title', 'How to Submit a Notice of Claimed Infringement',
      'body', $section_1$If you believe that your work has been copied and published on the Sites in a way that infringes on your copyrights, please provide our Designated Agent (identified below) with the following information:

- An electronic or physical signature of the copyright owner or the person authorized to act on behalf of the owner of the copyright;
- A description of the copyrighted work that you claim has been infringed;
- A description of where the material that you claim is infringing is located on the Sites (preferably including specific URLs associated with the material);
- Your address, telephone number, and email address;
- A statement by you that you have a good faith belief that the disputed use is not authorized by the copyright owner, its agent, or the law; and
- A statement by you, made under penalty of perjury, that the above information in your notification is accurate and that you are the copyright owner or are authorized to act on the copyright owner’s behalf.

You may send your Notice of Claimed Infringement (“Notice”) to:

Lawrence G. Walters, Esq.
Walters Law Group
195 W. Pine Ave.
Longwood, FL 32750-4104
Fax: (407)-774-6151
Email: notice[at]DMCAnotice[dot]com

Please do not send other inquiries or information to our Designated Agent. Absent prior express permission, our Designated Agent is not authorized to accept or waive service of formal legal process, and any agency relationship beyond that required to accept valid DMCA Notices is expressly disclaimed.

Further information regarding notification and takedown requirements can be found in the DMCA, here: https://www.law.cornell.edu/uscode/text/17/512

Abuse Notification: Abusing the DMCA Notice procedures set forth above, or misrepresenting facts in a DMCA Notice or counter-notification, can result in legal liability for damages, court costs, and attorneys’ fees under federal law. See 17 U.S.C. § 512(f). These Notice and Takedown Procedures only apply to claims of copyright infringement by copyright holders and their agents – not to any other kind of abuse, infringement, or legal claim. We will investigate and take action against anyone abusing the DMCA notification or counter-notification procedure. Please ensure that you meet all legal qualifications before submitting a DMCA Notice to our Designated Agent.$section_1$, 'pendingCounselReview', true),
    jsonb_build_object('key', 'submit_notice', 'title', 'How We Respond to Take Down Notices',
      'body', $section_2$The following “notification and takedown” procedures apply upon receipt of any notification of claimed copyright infringement. We reserve the right at any time to disable access to or remove any material or activity accessible on the Sites that is claimed to be infringing or from which infringing activity is apparent based on facts or circumstances. It is our firm policy to terminate the account of repeat copyright infringers, when appropriate, and we will act expeditiously to remove access to all material that infringes on another’s copyright, according to the procedure set forth in 17 U.S. C. § 512 of the DMCA. Our DMCA Notice Procedures are set forth in the preceding paragraphs. If the Notice does not comply with § 512 of the DMCA but does comply with three notification elements according to § 512 of the DMCA, we will attempt to contact or take other reasonable steps to contact the complaining party to help that party comply with the notification requirements. When the Designated Agent receives a valid Notice, we will expeditiously remove and/or disable access to the infringing material and shall notify the affected user. Then, the affected user may submit a counter-notification to the Designated Agent containing a statement made under penalty of perjury that the user has a good faith belief that the material was removed because of misidentification of the material. After the Designated Agent receives the counter-notification, it will replace the material at issue within ten to fourteen (10-14) business days after receipt of the counter-notification unless the Designated Agent receives notice that a court action has been filed by the complaining party seeking an injunction against the infringing activity.$section_2$, 'pendingCounselReview', true),
    jsonb_build_object('key', 'submit_counter_notice', 'title', 'How to Submit a Counter-Notification',
      'body', $section_3$If a user is affected by a DMCA removal and believes that the allegedly infringing material has been removed as a result of mistake or misidentification, the user is permitted to submit a counter-notification pursuant to § 512(g)(2)-(3) of the DMCA. A counter-notification is the proper method for a user to dispute the removal or disabling of material pursuant to a Notice. The information that a user provides in a counter-notification must be accurate and truthful, and the user will be liable for any misrepresentations which may cause any claims to be brought against us relating to the actions taken in response to the counter-notification.

To submit a counter-notification, please provide our Designated Agent the following information:

- A specific description of the material that was removed or disabled pursuant to the Notice;
- A description of where the material was located on the Sites before such material was removed and/or disabled (preferably including specific URLs associated with the material);
- A statement reflecting the user’s belief that the removal or disabling of the material was done erroneously. For convenience, the following language may be used:

“I swear, under penalty of perjury, that I have a good faith belief that the referenced material was removed or disabled by the service provider as a result of mistake or misidentification of the material to be removed or disabled.”

- The user’s physical address, telephone number, and email address; and,
- A statement that the user consents to the jurisdiction of the federal district court in and for the judicial district where the user is located, or if the user is outside of the United States, for any judicial district in which the service provider may be found, and that the user will accept service of process from the person who provided the Notice, or that person’s agent.

Written counter-notification containing the above information must be signed and sent to:

Lawrence G. Walters, Esq.
Walters Law Group
195 W. Pine Ave.
Longwood, FL 32750-4104
Fax: (407)-774-6151
Email: Notice[at]DMCANotice[dot]com

Please do not send other inquiries or information to our Designated Agent. Absent prior express permission, our Designated Agent is not authorized to accept or waive service of formal legal process, and any agency relationship beyond that required to accept valid DMCA Notices is expressly disclaimed.

After receiving a DMCA counter-notification, our Designated Agent will forward it to us, and we will then provide any counter-notification to the claimant who first sent the original Notice identifying the allegedly infringing content.

Thereafter, within ten to fourteen (10-14) business days of our receipt of a counter-notification, we will replace or cease disabling access to the disputed material provided that we or our Designated Agent have not received notice that the original claimant has filed an action seeking a court order to restrain the user from engaging in infringing activity relating to the material on our system or network.$section_3$, 'pendingCounselReview', true),
    jsonb_build_object('key', 'repeat_infringer', 'title', 'English Language/Accessibility',
      'body', $section_4$All DMCA notices and counter-notifications must be written in the English language and readily accessible. Any attempted notifications written in foreign languages or using foreign characters will be deemed non-compliant and disregarded. All DMCA notices and counter-notifications transmitted by email must contain the required information in the body of the email or in an attachment that can be opened with standard office software. Emails that require access to links, downloading of software, or use of verification procedures to view the substance of the message will not be processed.$section_4$, 'pendingCounselReview', true),
    jsonb_build_object('key', 'after_notice', 'title', 'Modifications',
      'body', $section_5$We reserve the right to modify, alter, or add to this policy, and all affected persons should regularly check back to stay current on any such changes.$section_5$, 'pendingCounselReview', true),
    jsonb_build_object('key', 'after_counter_notice', 'title', 'Customer Service Requests',
      'body', $section_6$Please note that the Designated Agent is an attorney with a private law firm and is not associated with us in any other capacity. Customer service inquiries, payment questions, and cancellation requests will not receive a response. All such communications must be directed to our customer service department.

© Walters Law Group (2026). All rights reserved.$section_6$, 'pendingCounselReview', true)
  ) AS sections
), saved AS (
  INSERT INTO dmca_settings
    (id, agent_name, agent_organization, agent_address, agent_phone,
     agent_email, policy_sections, updated_at)
  SELECT 1, 'Lawrence G. Walters, Esq.', 'Walters Law Group',
    E'195 W. Pine Ave.\nLongwood, FL 32750-4104',
    '407.975.9150', 'notice@DMCAnotice.com', sections, now()
  FROM policy
  ON CONFLICT (id) DO UPDATE SET
    agent_name = EXCLUDED.agent_name,
    agent_organization = EXCLUDED.agent_organization,
    agent_address = EXCLUDED.agent_address,
    agent_phone = EXCLUDED.agent_phone,
    agent_email = EXCLUDED.agent_email,
    policy_sections = EXCLUDED.policy_sections,
    updated_at = now()
  RETURNING id, policy_sections
), audited AS (
  INSERT INTO dmca_audit_log
    (event, actor_type, target_type, target_id, previous_value, new_value, notes)
  SELECT 'settings_updated', 'system', 'dmca_settings', saved.id,
    (SELECT value FROM previous),
    jsonb_build_object('policy_sections', saved.policy_sections),
    'Owner-applied lawyer CLIENT DRAFT to public DMCA policy'
  FROM saved
  RETURNING target_id
)
SELECT 'APPLIED' AS result, audited.target_id,
  jsonb_array_length(saved.policy_sections) AS section_count
FROM audited JOIN saved ON saved.id = audited.target_id;
