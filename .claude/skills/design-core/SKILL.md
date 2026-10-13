---
name: design-core
description: Universal rules for building award-quality, high-converting demo homepages in this repo's Astro + Tailwind template. Read before any design-<industry> skill. Also the fallback playbook when no industry skill fits.
---

# Design Core — rules every demo follows

You are building a single homepage that must look like a $15k agency build and beat the lead's current site on **aesthetics, clarity, conversion, trust, and mobile**. The industry skill picks the *style*; this file sets the *standard*.

## 1. Stack conventions (template/)
- All content lives in `src/data/site.json` (business info, nav, CTAs, SEO, demo credit). Section-specific copy goes in the section component or an added key in `site.json`. Never hardcode phone/address twice.
- Design tokens live **only** in the `@theme` block of `src/styles/global.css`. Components use token utilities (`bg-brand`, `text-muted`, `font-display`, `rounded-card`, `shadow-card`) — never raw hex in markup.
- Fonts: `npm i @fontsource-variable/<font>` and import it at the top of `src/layouts/Base.astro`, replacing Inter if the skill calls for it. Max 2 families.
- Build sections as `src/components/sections/<Name>.astro`, compose them in `src/pages/index.astro`. Reuse `ui/Button`, `ui/Section`, `ui/Icon`. Rewrite `Header.astro` / `Footer.astro` freely to match the style.
- Images: client assets are in `public/assets/` (logo + `img-NN.webp`). Use `<img loading="lazy" decoding="async" width height>` below the fold; hero image gets `fetchpriority="high"` and no lazy. Always meaningful `alt`.
- No client JS frameworks. Interactivity = CSS, `<details>`, or tiny inline scripts. Add `class="reveal"` for scroll-in animation (already wired, motion-safe).
- `npm run build` must pass with zero errors.

## 2. Homepage blueprint (adapt order per industry skill)
1. **Header** — logo, ≤5 nav items, phone (local biz), primary CTA button. Sticky.
2. **Hero** — the 5-second test: *what you do, for whom, where, and the next step*. Outcome-led H1 (≤10 words), 1–2 line subhead with specifics (location, years, speciality), primary + secondary CTA, and a proof line under the CTAs (★ rating, "Since 1998", "2,000+ pets cared for"). Strong real image or crafted composition — never a generic gradient blob.
3. **Trust bar** — ratings, years, certifications, associations, insurers, "as seen in". Logos in monochrome.
4. **Services / offer** — 3–6 cards, benefit-led titles, one-line description, link. Icons from `ui/Icon` or real photos; never emoji.
5. **Differentiator / About** — why choose us: 3 concrete reasons with specifics, team or founder photo if available.
6. **Social proof** — real testimonials from content.json (name + context). If none exist, build a proof band from real facts (years in business, services, location, guarantees, credentials) and leave `<!-- PLACEHOLDER: real Google reviews go here -->` in the markup. **Never invent reviews, ratings, awards, or numbers.**
7. **Process / how it works** — 3 steps that remove friction ("Call → Visit → Relax").
8. **FAQ** — 4–6 objection-killers using `<details>`.
9. **Final CTA band** — repeat the primary CTA with urgency/reassurance.
10. **Contact / location** — phone, email, address, hours, simple form (name, phone/email, message; `action="#"` for the demo), map link.
11. **Footer** — NAP, hours, socials, small legal line.

## 3. Conversion rules (non-negotiable)
- One **primary conversion** (from the brief) repeated at hero, mid-page, final band, and the mobile sticky bar. Same label everywhere. Verb-first, specific: "Book a visit", "Get a free quote" — not "Submit" / "Learn more".
- Primary CTA uses `--color-accent` and is the highest-contrast element on screen. Only one accent-colored button per viewport.
- Click-to-call `tel:` links for every phone number. Local businesses keep the mobile sticky call/book bar from `Header.astro`.
- Proof near every ask: rating/years/guarantee next to CTAs.
- Kill friction: no carousels for key content, no auto-play, no pop-ups, forms ≤4 fields.
- Address the visitor ("you"), lead with outcomes, then features.

## 4. Visual craft (what separates award-level from template-y)
- **Type scale**: H1 `text-5xl sm:text-7xl` (tight `leading-[1.02]`, `tracking-tight`), H2 `text-3xl sm:text-5xl`, body 17–18px, `max-w-prose` for paragraphs. Use weight + size contrast, not color, for hierarchy.
- **Spacing**: generous. Sections `py-20 sm:py-28`. Use an 8-pt rhythm. Whitespace is the luxury signal.
- **Layout**: 12-col mental grid, max width 72rem. Alternate rhythm (full-bleed image band → contained cards → split section). At least one asymmetric/editorial moment (overlapping image, oversized number, offset grid) per page.
- **Color**: 60/30/10 — paper/neutral 60, brand 30, accent 10. Tinted neutrals (warm or cool to match brand), never pure grey #888. One dark section (`tone="deep"`) for contrast rhythm.
- **Depth**: soft layered shadows (`shadow-card`), 1px hairline borders (`border-line`), subtle radial or noise backgrounds; no harsh drop shadows.
- **Imagery**: client's real photos first (crop with `object-cover` + `aspect-[4/3]` etc.). Treat weak photos with duotone/overlay or place in framed compositions. If no usable photos, design with type, color blocks, icons, and patterns — never stock-photo hotlinks or AI-looking imagery.
- **Details**: eyebrow labels above H2s (`text-sm font-semibold uppercase tracking-[.14em] text-brand`), consistent icon stroke, hover states on all interactive elements, focus rings visible.

## 5. Brand continuity
- Keep the client's logo and name. Evolve their colors (deepen/saturate/refine) unless the brief says rebrand — the lead must recognise *their* business, upgraded.
- If the logo is low-res or on a colored box, place it on a matching background or use a clean text wordmark in the display font next to it.

## 6. Accessibility & performance (the reviewer measures these)
- Text contrast ≥ 4.5:1 (≥3:1 for 24px+). Check `text-muted` on `surface` and white text on `brand`.
- One `<h1>`, logical heading order, landmarks (`header`, `main#main`, `footer`), labelled form fields, `aria-label` on icon-only links.
- Tap targets ≥ 44px, no horizontal scroll at 390px, body ≥ 16px on mobile.
- Hero LCP image ≤ 250KB webp, explicit width/height on all images (CLS ≈ 0).
- Total page weight target < 1.5MB.

## 7. Anti-slop list (instant fail)
- Purple-blue gradients, glassmorphism everywhere, floating 3D blobs, "Welcome to our website", "Your trusted partner in…", lorem ipsum, emoji icons, centered-everything layouts, 6 identical cards with identical icons, stock handshake photos, fake stats/reviews, more than 2 fonts, more than one accent color, text over busy photos without overlay.

## 8. Copy
- Rewrite, don't copy-paste: keep the client's facts (services, years, staff names, location, hours, reviews) and sharpen the language.
- Headlines: outcome + specificity ("Gentle, expert care for Springfield's pets since 1998").
- Use the industry skill's tone. Short sentences. No jargon unless B2B.
