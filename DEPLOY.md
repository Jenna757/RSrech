# RSrech website deployment

This repository contains the latest RS Technologies website. The deployable website is in `dist/`.

## Cloudflare Pages

Connect the `Jenna757/RSrech` GitHub repository in Workers & Pages, choosing the Pages Git integration.

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | `exit 0` |
| Build output directory | `dist` |
| Root directory | Leave blank |
| Environment variables | None required |

The files are ready to serve and require no Node build or database. Preserve the `dist/assets/` directory and all CSS and JavaScript files. Commits to the connected production branch trigger Cloudflare Pages deployments.

If the setup asks for a Deploy command such as `npx wrangler deploy`, that is the Workers flow. Use the Pages flow for the settings above.

## Features and behavior

- Three-scene full-width hero carousel, with synchronized image and text transitions, dot controls and mobile swipe support.
- Traditional Chinese / English copy, responsive navigation and service filters.
- Company introduction, standalone ISO/CIC information, technology brand logos and CSR gallery.
- Browser-only curated FAQ assistant, with company contact referral for unlisted questions. No external AI API, question transmission or persistence.
- Enquiry form opens a local email draft addressed to `sales@rstech.com.hk`; it does not send a message or store submissions on a server.
- Animations support reduced-motion preferences.

Content and source imagery were adapted from the company's existing website. Google Fonts are optional; system fonts provide fallbacks.

Official deployment reference: https://developers.cloudflare.com/pages/framework-guides/deploy-anything/
