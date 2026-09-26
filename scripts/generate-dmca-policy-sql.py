"""Generate the owner-run production DMCA policy SQL from counsel's Word draft.

Run from the repository root:
    python scripts/generate-dmca-policy-sql.py
This does not connect to either database.
"""

from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET


SOURCE = Path("attached_assets/Tattler_Media_DMCA_Policy_CLIENT_DRAFT_1790463789528.docx")
CONTACT = Path("attached_assets/Pasted-Walters-Law-Group-195-W-Pine-Avenue-Longwood-FL-32750-4_1790464034375.txt")
OUTPUT = Path("scripts/dmca-policy-production.sql")
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
W = "{" + NS["w"] + "}"
HEADINGS = [
    ("policy", "DMCA Notice & Takedown Policy"),
    ("designated_agent", "How to Submit a Notice of Claimed Infringement"),
    ("submit_notice", "How We Respond to Take Down Notices"),
    ("submit_counter_notice", "How to Submit a Counter-Notification"),
    ("repeat_infringer", "English Language/Accessibility"),
    ("after_notice", "Modifications"),
    ("after_counter_notice", "Customer Service Requests"),
]


def paragraph_text(paragraph):
    return "".join(node.text or "" for node in paragraph.findall(".//w:t", NS)).strip()


def sql_string(value):
    return "'" + value.replace("'", "''") + "'"


def document_sections():
    with ZipFile(SOURCE) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    paragraphs = root.findall(".//w:body/w:p", NS)
    texts = [paragraph_text(p) for p in paragraphs]
    positions = []
    for _, title in HEADINGS:
        matches = [i for i, text in enumerate(texts) if text == title]
        if len(matches) != 1:
            raise ValueError(f"Expected one heading {title!r}, found {len(matches)}")
        positions.append(matches[0])
    if positions != sorted(positions):
        raise ValueError("The document's policy headings are out of order")

    sections = []
    contact_starts = ("Lawrence G. Walters, Esq.", "Walters Law Group", "195 W. Pine Ave.",
                      "Longwood, FL 32750-4104", "Fax: (407)-774-6151")
    for n, (key, title) in enumerate(HEADINGS):
        end = positions[n + 1] if n + 1 < len(positions) else len(paragraphs)
        parts = []
        previous_kind = None
        for paragraph in paragraphs[positions[n] + 1:end]:
            text = paragraph_text(paragraph)
            if not text:
                continue
            style = paragraph.find("./w:pPr/w:pStyle", NS)
            kind = "list" if style is not None and style.get(W + "val") == "ListParagraph" else "normal"
            if text in contact_starts or text.startswith("Email: "):
                kind = "contact"
            if kind == "list":
                text = "- " + text
            separator = "\n" if kind == previous_kind and kind in ("list", "contact") else "\n\n"
            parts.append((separator if parts else "") + text)
            previous_kind = kind
        body = "".join(parts)
        if len(body) < 25 or "$section_" in body:
            raise ValueError(f"Section {title!r} is unexpectedly short or contains a SQL delimiter")
        sections.append((key, title, body))
    if not sections[-1][2].endswith("© Walters Law Group (2026). All rights reserved."):
        raise ValueError("The document's copyright notice was not included")
    return sections


def main():
    contact = CONTACT.read_text()
    if "407.975.9150 (phone)" not in contact or "407.774.6151 (fax)" not in contact:
        raise ValueError("The supplied phone and fax contact details changed")
    sections = document_sections()
    objects = []
    for n, (key, title, body) in enumerate(sections):
        delimiter = f"$section_{n}$"
        objects.append(
            "    jsonb_build_object("
            f"'key', {sql_string(key)}, 'title', {sql_string(title)},\n"
            f"      'body', {delimiter}{body}{delimiter}, 'pendingCounselReview', true)"
        )
    values = ",\n".join(objects)
    sql = f"""-- Owner-run production update for https://barefootbay.com/dmca
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
{values}
  ) AS sections
), saved AS (
  INSERT INTO dmca_settings
    (id, agent_name, agent_organization, agent_address, agent_phone,
     agent_email, policy_sections, updated_at)
  SELECT 1, 'Lawrence G. Walters, Esq.', 'Walters Law Group',
    E'195 W. Pine Ave.\\nLongwood, FL 32750-4104',
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
"""
    OUTPUT.write_text(sql)
    print(f"Generated {OUTPUT} ({len(sql)} characters, {len(sections)} sections)")


if __name__ == "__main__":
    main()