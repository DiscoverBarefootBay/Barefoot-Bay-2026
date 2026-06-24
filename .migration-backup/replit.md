# Barefoot Bay Community Platform

## Overview
The Barefoot Bay Community Platform is a comprehensive web application designed as a central hub for a residential community. Its primary purpose is to facilitate engagement through various features such as event management, forum discussions, a vendor directory, and real estate listings. The platform aims to enhance community interaction, provide valuable resources to residents, and offer capabilities for content generation and localized services.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The platform employs a modern web stack with a focus on a robust, scalable, and maintainable architecture.

**Frontend:**
-   **Framework:** React.js with TypeScript for a component-based and type-safe user interface.
-   **Styling:** Tailwind CSS for responsive design.
-   **Build Tool:** Vite for fast development and optimized builds.
-   **Data Management:** TanStack Query for data fetching and caching.
-   **Forms:** React Hook Form for efficient form management.
-   **Rich Text Editing:** TinyMCE for content creation.

**Backend:**
-   **Framework:** Express.js powers the RESTful API.
-   **Database Interaction:** Drizzle ORM is used to interact with a PostgreSQL database.
-   **Real-time Communication:** WebSockets enable real-time features.
-   **Authentication:** Session-based authentication with role-based access control.
-   **File Uploads:** Multer handles media file uploads.

**Data Storage:**
-   **Primary Data:** PostgreSQL database.
-   **Media Files:** Replit Object Storage, organized into specific buckets (e.g., CALENDAR, FORUM, REAL_ESTATE).
-   **Media System:** A dual-path system supports both development (local filesystem) and production (Object Storage) environments.

**Key Features & Technical Implementations:**
-   **Event Management:** Calendar with categorization (entertainment, government, social, promotional, bulletin, platinum_sponsor), media support, recurring events, and CSV import. All parent recurring events include website URLs linking to their social club pages at `/more/social/[slug]`. Email notifications for events include consistent branding and unsubscribe options. Website URLs are managed through a hybrid system combining automatic title normalization matching with manual overrides stored in the `event_slug_overrides` table for edge cases.
-   **Platinum Sponsors:** A premium sponsorship tier displayed as wide landscape banners below the homepage carousel. Created as events with the `platinum_sponsor` category with up to 3-month duration. Includes sponsor-specific fields: `sponsorTagline`, `sponsorPhone`, `sponsorWebsiteUrl`, `sponsorVendorPageSlug`. Banners show Phone/Website/Vendor Page action buttons. Active sponsors (within start/end date range) auto-display; max 3 at a time. API endpoint: `GET /api/events/platinum-sponsors`.
-   **Forum System:** Category-based discussions, threaded conversations, media embedding, reaction system, and real-time notifications. New user onboarding automatically marks existing content as read to prevent notification overload. Email notifications for admin-created posts are sent to all users.
-   **Vendor Directory:** Rich content profiles with contact details and image galleries.
-   **Real Estate Marketplace:** Property listings with media and Square API integration for payments.
-   **Media Management:** Unified service for all media types, with intelligent image components and path resolution.
-   **Forms:** Dynamic forms can be inserted into content, with a robust renderer for display and a backend for submissions. Visual editor integration for forms ensures persistence across editor modes. Standalone form pages available at `/forms/:slug` for direct linking. Platinum Sponsor request forms (`platinum-junior-request`, `platinum-senior-request`) trigger in-app messages to Rob Allan (user ID 21) and SendGrid email to team@barefootbay.com on submission.
-   **Admin Tools:** Dashboard for tracking SendGrid email statistics and activity (delivered, opens, clicks, bounces, individual message tracking).
-   **Calendar Email Auto-Scheduler:** Admin panel on `/admin/calendar-management` allows setting a daily auto-send time (Florida/Eastern Time) for 1-day calendar notifications. Config stored in `calendar_email_schedule` table. Features: enable/disable toggle, time picker (ET), recipient preference (none/justme/admins/everyone), "Preview Tomorrow's Email" button that opens a full HTML preview in an iframe with a drag-to-reorder event list (HTML5 drag-drop) and per-event image attachment checkboxes. Custom order saves to DB and is used once (cleared after next send). The existing manual "Send 1-Day Notifications" button also picks up the saved custom order. API: `GET/PUT /api/admin/calendar-email-schedule`, `GET /api/admin/calendar-email-preview`. Scheduler runs every 60s, fires at the configured time in ET.
-   **Rocket Launch Easter Egg:** Interactive animation triggered by 5 clicks within 2 seconds on the rocket icon. Features countdown sequence (T-5 to T-0), flame effects, progressive flame sparks, and simple grey smoke plume system. Progressive flame sparks build intensity during countdown: starting with 2 particles at T-5, increasing to 12 particles at T-0, with particles progressively getting larger (3px→6px), faster (0.8s→0.5s), and brighter as countdown approaches launch. Smoke particles use horizontal/vertical offsets (±15px) to spread around the flame, with increased particle count and wider spread during launch phase. Performance-optimized with CSS animations and reduced-motion accessibility support.

**Deployment:**
-   **Development:** Local PostgreSQL and filesystem for media.
-   **Production:** Replit deployment utilizing PostgreSQL add-on and Replit Object Storage, with a focus on robust migration and optimized static asset delivery.

## External Dependencies
-   **Square API:** Payment processing for the Real Estate Marketplace.
-   **Printful API:** Print-on-demand services.
-   **Google Gemini AI:** Content generation and search functionality.
-   **Pexels API:** Event image personalization.
-   **SMTP Services (SendGrid):** Email notifications, including calendar event alerts, forum post notifications, and general community updates.
-   **Weather API:** Local weather information integration.
-   **Rocket Launch Tracking:** SpaceX launch notifications.

## Environment Variables

### Production Environment Variables (Required)
-   **APP_BASE_URL:** The production base URL for the application (e.g., `https://barefootbay.com`). This is critical for ensuring email links (unsubscribe, event links, etc.) point to the correct production domain instead of development URLs. If not set in production, the system will use `https://barefootbay.com` as default and log a warning.

### Development Environment Variables
-   **REPLIT_DEV_DOMAIN:** Automatically set by Replit in development, used for generating correct URLs in dev environment.

### Email Configuration
The `getBaseUrl()` function in `server/sendgrid-service.ts` determines the correct base URL for email links:
- **Production (NODE_ENV=production):** Uses `APP_BASE_URL` or defaults to `https://barefootbay.com`
- **Development:** Uses `REPLIT_DEV_DOMAIN` if available, falls back to `http://localhost:5000`

## Admin Review Items

### Orphaned Vendor Pages (Flagged 2026-02-04)
The following vendor pages have slugs that don't match current category patterns and need admin review. These may need to be re-categorized or deleted:

| ID | Title | Current Slug | Suggested Fix |
|----|-------|--------------|---------------|
| 273 | Florida Anchor and Barrier Company | vendors-anchor-... | Should be `vendors-anchor-and-vapor-barrier-...` |
| 251 | Aunt Louise's Pizzeria | vendors-food-and-dining-... | Should be `vendors-food-dining-...` |
| 298 | Holy Cannoli Bakery & Cafe | vendors-food-and-dining-... | Should be `vendors-food-dining-...` |
| 241 | Cafe Latte da | vendors-food-... | Should be `vendors-food-dining-...` |
| 247 | Roseland Global Methodist Church | vendors-funeral-... | Should be `vendors-funeral-and-religious-services-...` |
| 235 | Strunk Funeral Home and Crematory | vendors-funeral-... | Should be `vendors-funeral-and-religious-services-...` |
| 222, 240, 242, 245, 256, 261, 302 | Various Health vendors | vendors-health-... | Should be `vendors-health-and-medical-...` |
| 453 | Test Vendor PAGE | vendors-nature-... | DELETE - test data |
| 299, 300, 301, 305, 306, 307 | Sea Breeze Realty (6 duplicates!) | vendors-real-... | Keep one, delete rest. Should be `vendors-real-estate-senior-living-...` |
| 309 | Blues Clues 2 | vendors-retail-... | Should be `vendors-retail-shops-...` |

**Root Cause:** Category slug format changed over time (e.g., "food-and-dining" → "food-dining"). Duplicate prevention was not in place, allowing same slug to be created multiple times.

**Fix Applied:** Added duplicate slug prevention to vendor creation (2026-02-04).