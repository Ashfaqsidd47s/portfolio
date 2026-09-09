# Mohammad Ashfaq — Portfolio

Personal portfolio and résumé site. React + TypeScript + Vite, styled with
Tailwind CSS v4 and shadcn-style components, animated with Motion.

## ⚠️ Before you deploy

Set your real domain in **[`.env`](.env)** — it drives canonical URLs, Open
Graph tags, `robots.txt` and `sitemap.xml`:

```bash
VITE_SITE_URL=https://your-real-domain.com   # no trailing slash
```

This file holds no secrets and is committed on purpose, so a fresh clone builds
with correct URLs.

**Host environment variables win over this file.** On Vercel or Netlify, set
`VITE_SITE_URL` in the project's environment-variable settings — and if you
create it there, give it a real value. The build falls back to
`http://localhost:5173` and prints a warning when it is unset or blank, so a
missing value degrades the metadata rather than breaking the build.

## Stack

| Area       | Choice                                       |
| ---------- | -------------------------------------------- |
| Framework  | React 19 + TypeScript, Vite                  |
| Styling    | Tailwind CSS v4 (CSS-first `@theme` tokens)  |
| Components | shadcn/ui primitives (Radix under the hood)  |
| Animation  | Motion (`motion/react`)                      |
| Routing    | React Router, with lazy secondary routes     |
| Icons      | lucide-react, plus local brand marks         |

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
npm run preview  # serve the production build
npm run lint     # oxlint
```

## Editing content

All copy lives in one place — [`src/data/profile.ts`](src/data/profile.ts).
Experience, projects, skills, education and contact details are typed objects
consumed by the home page and the résumé page, so an edit there updates both.

To swap the downloadable PDF, replace `public/Mohammad_Ashfaq_Resume.pdf` and
update `profile.resumeFile` / `profile.resumeFileName` if the name changes.

## Structure

```
src/
├─ data/profile.ts            # single source of truth for all content
├─ components/
│  ├─ ui/                     # shadcn primitives (button, badge)
│  ├─ sections/               # hero, experience, projects, about, contact
│  ├─ motion-primitives.tsx   # Reveal / StaggerGroup / MaskedWords
│  ├─ nav.tsx, footer.tsx, section.tsx, icons.tsx
├─ pages/
│  ├─ home.tsx                # /
│  ├─ resume.tsx              # /resume — web résumé + PDF download + print
│  └─ not-found.tsx           # catch-all
├─ hooks/
│  ├─ use-theme.tsx           # light/dark, no flash on first paint
│  └─ use-document-meta.ts    # per-route title/description/canonical
└─ index.css                  # design tokens, base layer, print styles
```

## Design notes

- **Palette** — cool neutral base with a single emerald accent, used sparingly
  (eyebrows, links, badges, the availability dot). Tokens are defined once on
  `:root` and redefined under `.dark`; nothing hardcodes a colour.
- **Contrast** — every foreground/background token pair clears WCAG AA (4.5:1)
  in both themes, including the 11px mono labels.
- **Theme** — an inline script in `index.html` applies the stored or system
  theme before first paint, so there is no flash of the wrong theme.
- **Motion** — entrance reveals are scroll-triggered and run once. Every
  animation is disabled under `prefers-reduced-motion: reduce`.
- **Print** — `/resume` has a dedicated print stylesheet: chrome is hidden,
  colours drop to ink, and sections avoid breaking across pages.

## SEO & production

- Canonical URL, Open Graph and Twitter card tags, plus JSON-LD `Person`
  structured data in [`index.html`](index.html).
- `robots.txt` and `sitemap.xml` are **generated at build time** from
  `VITE_SITE_URL` by a small plugin in [`vite.config.ts`](vite.config.ts) — add
  a route to its `ROUTES` array and the sitemap follows.
- Per-route `<title>`, description and canonical via `useDocumentMeta`.
- A `<noscript>` fallback carries the name, pitch, and contact links.
- Social preview image at `public/og-image.png` (1200×630).
- Icon set: `favicon.svg`, `icon-192.png`, `icon-512.png`,
  `apple-touch-icon.png`, and a web manifest.

### Bundle

Vendor code is split so the entry chunk stays small, and `/resume` and the 404
page are lazy-loaded:

```
index    ~79 kB  (24 kB gzip)   app code
react   ~220 kB  (70 kB gzip)   react + react-dom + router
motion  ~142 kB  (47 kB gzip)   animation runtime
resume    ~9 kB   (2 kB gzip)   loaded on demand
```

## Deployment

Static SPA — build and serve `dist/`.

- **Vercel** — [`vercel.json`](vercel.json) covers SPA rewrites, security
  headers, and cache policy (immutable for `/assets/*`, revalidate for HTML).
- **Netlify** — [`netlify.toml`](netlify.toml) plus `public/_headers` and
  `public/_redirects` do the same.
- **Anything else** — serve `dist/`, point all unmatched routes at
  `index.html`, and mirror the cache headers from `public/_headers`.
