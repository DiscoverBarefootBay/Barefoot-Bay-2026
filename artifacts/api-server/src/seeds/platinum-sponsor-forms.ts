import { pool } from "../db";

const PLATINUM_FORMS = [
  {
    title: "Platinum Junior Sponsor Request",
    slug: "platinum-junior-request",
    description: "Request a Junior Platinum Sponsorship package for your business. Our team will review and contact you.",
  },
  {
    title: "Platinum Senior Sponsor Request",
    slug: "platinum-senior-request",
    description: "Request a Senior Platinum Sponsorship package for your business. Our team will review and contact you.",
  },
];

const FORM_FIELDS = JSON.stringify([
  { id: "business_name", type: "text", label: "Business Name", placeholder: "Enter your business name", required: true },
  { id: "contact_name", type: "text", label: "Contact Name", placeholder: "Your full name", required: true },
  { id: "phone", type: "tel", label: "Phone Number", placeholder: "5551234567", required: true },
  { id: "email", type: "email", label: "Email Address", placeholder: "you@example.com", required: true },
  { id: "website", type: "text", label: "Website", placeholder: "https://yourbusiness.com", required: false, helpText: "Your business website (if applicable)" },
  { id: "notes", type: "textarea", label: "Additional Notes", placeholder: "Tell us about your business and sponsorship goals...", required: false },
]);

export async function seedPlatinumSponsorForms() {
  for (const form of PLATINUM_FORMS) {
    const existing = await pool.query("SELECT id FROM custom_forms WHERE slug = $1", [form.slug]);
    if (existing.rows.length > 0) {
      console.log(`[Seed] Platinum form '${form.slug}' already exists (id=${existing.rows[0].id})`);
      continue;
    }

    await pool.query(
      "INSERT INTO custom_forms (title, slug, description, form_fields, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())",
      [form.title, form.slug, form.description, FORM_FIELDS]
    );
    console.log(`[Seed] Created platinum form: ${form.slug}`);
  }

  await updatePlatinumPageLinks();
  await fixPlatinumPageFormatting();
}

async function fixPlatinumPageFormatting() {
  const PAGE_SLUG = "advertise-platinum-sponsor-packages-limited-availability";
  const result = await pool.query("SELECT id, content FROM page_contents WHERE slug = $1", [PAGE_SLUG]);

  if (result.rows.length === 0) return;

  let content: string = result.rows[0].content;
  const pageId = result.rows[0].id;
  let updated = false;

  if (content.includes('content:"\\\\2713"')) {
    content = content.split('content:"\\\\2713"').join('content:"✓"');
    updated = true;
    console.log(`[Seed] Fixed checkmark encoding in platinum page`);
  }

  if (content.includes('.plat-best-value{display:inline-block;')) {
    content = content.replace(
      /\.plat-best-value\{display:inline-block;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:\.08em;color:#4B5563;background:linear-gradient\(135deg,#F3F4F6,#E5E7EB\);border:1px solid #D1D5DB;padding:6px 10px;border-radius:999px;box-shadow:0 1px 3px rgba\(107,114,128,\.1\);margin-bottom:4px/,
      '.plat-best-value{position:absolute;top:-14px;left:20px;z-index:10;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#4B5563;background:linear-gradient(135deg,#F3F4F6,#E5E7EB);border:1px solid #D1D5DB;padding:6px 14px;border-radius:999px;box-shadow:0 2px 6px rgba(107,114,128,.15)'
    );
    updated = true;
    console.log(`[Seed] Fixed Best Value badge positioning`);
  }

  if (content.includes('z-index:2;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#4B5563;background:linear-gradient(135deg,#F3F4F6,#E5E7EB);border:1px solid #D1D5DB;padding:6px 14px')) {
    content = content.replace(
      'z-index:2;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#4B5563;background:linear-gradient(135deg,#F3F4F6,#E5E7EB);border:1px solid #D1D5DB;padding:6px 14px',
      'z-index:10;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#4B5563;background:linear-gradient(135deg,#F3F4F6,#E5E7EB);border:1px solid #D1D5DB;padding:6px 14px'
    );
    updated = true;
    console.log(`[Seed] Upgraded Best Value badge z-index to 10`);
  }

  if (content.includes('.plat-card--featured{border:') && !content.includes('.plat-card--featured{overflow:visible;')) {
    content = content.replace(
      '.plat-card--featured{border:2px solid #9CA3AF',
      '.plat-card--featured{overflow:visible;z-index:1;border:2px solid #9CA3AF'
    );
    updated = true;
    console.log(`[Seed] Added overflow:visible and z-index:1 to featured card`);
  }

  if (content.includes('.plat-card--featured{overflow:visible;border:') && !content.includes('.plat-card--featured{overflow:visible;z-index:1;')) {
    content = content.replace(
      '.plat-card--featured{overflow:visible;border:2px solid #9CA3AF',
      '.plat-card--featured{overflow:visible;z-index:1;border:2px solid #9CA3AF'
    );
    updated = true;
    console.log(`[Seed] Added z-index:1 to featured card`);
  }

  if (content.includes('class="plat-card plat-card--featured" style="overflow:hidden"')) {
    content = content.split('class="plat-card plat-card--featured" style="overflow:hidden"').join('class="plat-card plat-card--featured"');
    updated = true;
    console.log(`[Seed] Removed inline overflow:hidden from featured card HTML`);
  }

  if (content.includes('.plat-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}') && !content.includes('padding-top:18px')) {
    content = content.replace(
      '.plat-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}',
      '.plat-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;padding-top:18px}'
    );
    updated = true;
    console.log(`[Seed] Added padding-top to plat-grid for badge clearance`);
  }

  if (content.includes('opacity:.6;background:linear-gradient(90deg,#D1D5DB') && !content.includes('.plat-card:hover .plat-shimmer{')) {
    content = content.replace(
      '.plat-shimmer{position:absolute;top:0;left:0;right:0;height:3px;border-radius:20px 20px 0 0;opacity:.6',
      '.plat-shimmer{position:absolute;top:0;left:0;right:0;height:3px;border-radius:20px 20px 0 0;opacity:0;transition:opacity .3s ease'
    );
    content = content.replace(
      '.plat-shimmer-bottom{position:absolute;bottom:0;left:0;right:0;height:2px;border-radius:0 0 20px 20px;opacity:.4',
      '.plat-shimmer-bottom{position:absolute;bottom:0;left:0;right:0;height:2px;border-radius:0 0 20px 20px;opacity:0;transition:opacity .3s ease'
    );
    content = content.replace(
      '.plat-card:hover{box-shadow:0 10px 36px rgba(107,114,128,.16),0 3px 8px rgba(0,0,0,.06);transform:translateY(-3px);border-color:#9CA3AF}',
      '.plat-card:hover{box-shadow:0 10px 36px rgba(107,114,128,.16),0 3px 8px rgba(0,0,0,.06);transform:translateY(-3px);border-color:#9CA3AF}.plat-card:hover .plat-shimmer{opacity:1;animation:plat-shimmer-sweep 1.5s ease-in-out infinite}.plat-card:hover .plat-shimmer-bottom{opacity:.8;animation:plat-shimmer-sweep 2s ease-in-out infinite}'
    );
    content = content.replace(
      '.plat-card--featured:hover{box-shadow:0 14px 42px rgba(107,114,128,.20),0 4px 10px rgba(0,0,0,.07);transform:translateY(-4px);border-color:#6B7280}',
      '.plat-card--featured:hover{box-shadow:0 14px 42px rgba(107,114,128,.20),0 4px 10px rgba(0,0,0,.07);transform:translateY(-4px);border-color:#6B7280;z-index:2}.plat-card--featured:hover .plat-shimmer{opacity:1;animation:plat-shimmer-sweep 1.2s ease-in-out infinite}.plat-card--featured:hover .plat-shimmer-bottom{opacity:.9;animation:plat-shimmer-sweep 1.6s ease-in-out infinite}'
    );
    updated = true;
    console.log(`[Seed] Fixed shimmer hover animation`);
  }

  if (content.includes('.plat-card--featured:hover{box-shadow:0 14px 42px rgba(107,114,128,.20),0 4px 10px rgba(0,0,0,.07);transform:translateY(-4px);border-color:#6B7280;animation:plat-pulse-glow 2s ease-in-out infinite}')) {
    content = content.replace(
      '.plat-card--featured:hover{box-shadow:0 14px 42px rgba(107,114,128,.20),0 4px 10px rgba(0,0,0,.07);transform:translateY(-4px);border-color:#6B7280;animation:plat-pulse-glow 2s ease-in-out infinite}',
      '.plat-card--featured:hover{box-shadow:0 14px 42px rgba(107,114,128,.20),0 4px 10px rgba(0,0,0,.07);transform:translateY(-4px);border-color:#6B7280;z-index:2}'
    );
    updated = true;
    console.log(`[Seed] Removed conflicting hover animation, added z-index:2 to featured card hover`);
  }

  if (updated) {
    await pool.query("UPDATE page_contents SET content = $1, updated_at = NOW() WHERE id = $2", [content, pageId]);
  }
}

async function updatePlatinumPageLinks() {
  const PAGE_SLUG = "advertise-platinum-sponsor-packages-limited-availability";
  const result = await pool.query("SELECT id, content FROM page_contents WHERE slug = $1", [PAGE_SLUG]);

  if (result.rows.length === 0) {
    console.log(`[Seed] Platinum packages page not found (slug: ${PAGE_SLUG}), skipping link update`);
    return;
  }

  let content: string = result.rows[0].content;
  const pageId = result.rows[0].id;
  let updated = false;

  if (content.includes('href="#request-platinum"')) {
    const firstIdx = content.indexOf('href="#request-platinum"');
    const secondIdx = content.indexOf('href="#request-platinum"', firstIdx + 1);
    const placeholder = 'href="#request-platinum"';

    if (secondIdx >= 0) {
      content = content.substring(0, secondIdx) + 'href="/forms/platinum-senior-request"' + content.substring(secondIdx + placeholder.length);
    }
    if (firstIdx >= 0) {
      content = content.substring(0, firstIdx) + 'href="/forms/platinum-junior-request"' + content.substring(firstIdx + placeholder.length);
    }
    updated = true;
  }

  if (content.includes('href="mailto:team@barefootbay.com')) {
    const mailtoMatch = content.match(/href="mailto:team@barefootbay\.com[^"]*"/);
    if (mailtoMatch) {
      content = content.replace(mailtoMatch[0], 'href="/forms/platinum-senior-request"');
      updated = true;
    }
  }

  if (updated) {
    await pool.query("UPDATE page_contents SET content = $1, updated_at = NOW() WHERE id = $2", [content, pageId]);
    console.log(`[Seed] Updated platinum packages page (id=${pageId}) with form links`);
  } else {
    console.log(`[Seed] Platinum packages page links already updated or no matching placeholders`);
  }
}
