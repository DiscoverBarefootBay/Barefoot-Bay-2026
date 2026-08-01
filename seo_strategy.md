# SEO Strategy — Discover Barefoot Bay

## Site Overview
Discover Barefoot Bay (`barefootbay.com`) is a community platform for residents of Barefoot Bay, Florida. It features a community calendar of events, a forum, a for-sale/classifieds section, a real estate section, a vendor directory, and community information pages.

## In Scope
- Home page
- Calendar / events pages (`/calendar`, `/events/:id`)
- Forum pages (`/forum`, `/forum/post/:id`)
- For-Sale listings (`/for-sale`, `/for-sale/:id`)
- Real estate listings (`/real-estate`, `/real-estate/:id`)
- Vendor directory (`/vendors`, `/vendors/:category/:vendor`)
- Community pages (`/community/:category/:page`)
- Amenities, weather, contact-us pages

## Out of Scope
- Authenticated user pages (`/admin`, `/profile`, `/messages`, `/chat`, `/my-listings`, `/subscriptions`, `/advanced-settings`, `/community-settings`)
- Store checkout flows (`/store/pay/`, `/store/order-complete/`, etc.)
- Password recovery flows

## Stack
- React + Vite SPA (client-side rendered)
- Express 5 API server with OG tags middleware and dynamic sitemap/robots.txt
- The OG middleware injects per-page titles and meta descriptions for social crawlers + Googlebot, but body content, H1s, and links remain client-side only

## Target Audience
Barefoot Bay, Florida residents seeking community events, local vendors, classifieds, and real estate.

## Primary Keywords
- Barefoot Bay community events
- Barefoot Bay residents
- Barefoot Bay vendors / local services
- Barefoot Bay real estate / for sale

## Dismissed Categories
- (None yet)
