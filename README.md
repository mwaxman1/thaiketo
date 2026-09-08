# thaiketo

SEO content and affiliate site for Thai-ketogenic cooking — recipes, ingredient guides, and Amazon product roundups at thaiketo.com.

## Overview

ThaiKeto is a niche content property combining Thai cuisine with the ketogenic diet. It publishes long-form articles (beginner's guide, food lists, meal plans, recipes like keto pad thai, tom yum, and green curry) plus product roundup pages ("Best coconut aminos", "Best konjac noodles", etc.) that monetize through Amazon Associates affiliate links. All affiliate link generation is centralized in `src/config/affiliate.ts` (tag `thaiketo-20`), which builds product and search URLs from ASINs.

Content lives inline in the page modules: `articles/[slug].astro` and `roundups/[slug].astro` hold article/roundup data (title, FAQ blocks, HTML content, product lists) as hard-coded records, and several articles/roundups also exist as dedicated hand-written `.astro` pages. The `src/content/` collection directories exist but are empty — this is a code-as-content site, not MDX-collection driven, despite MDX being configured. The newsletter signup endpoint is a stub: it validates the email but the Loops.so API call is commented out pending an API key.

## Tech Stack

- Astro 7 (`output: 'static'`, Vercel adapter, `thaiketo.com` as site)
- MDX integration with `rehype-slug` + `rehype-autolink-headings` (anchor links in content)
- Tailwind CSS 4 + Typography plugin
- `@astrojs/sitemap` (excludes `/admin` paths)
- TypeScript, Vite 6

## Getting Started

```bash
npm install
npm run dev       # astro dev on 0.0.0.0:5000
npm run build     # static build
npm run preview   # preview on 0.0.0.0:5000
```

## Features

- Article pages with meta descriptions, canonical URLs, FAQ sections, and JSON-LD structured data (WebSite + Organization schema on home)
- Product roundups with per-product ASIN, price, rating, and generated Amazon affiliate links (`buildAmazonProductUrl`)
- Centralized affiliate config — one tag, one marketplace, throws if unset
- Static-path generation for slugs (2 slugs wired in each `[slug]` route; remaining articles as individual pages)
- Newsletter subscribe API endpoint (`/api/subscribe`, `prerender = false`) with email validation — Loops integration is scaffolded but not active
- SEO infrastructure: sitemap filtering, canonical URLs, noindex support, Open Graph defaults in `BaseLayout.astro`
- Standard pages: about, contact, privacy, terms, affiliate disclosure, 404