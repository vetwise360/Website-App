# Demo Site Pipeline

Paste a lead's URL. You get back a redesigned homepage that has passed review, live on a Vercel URL, plus a LinkedIn-ready pitch.

```
/demo https://www.their-current-site.com
```

## One-time setup
```bash
npm run setup                 # installs scripts, the Astro template, and Playwright's Chromium
cp .env.example .env          # add VERCEL_TOKEN (and VERCEL_SCOPE for a team)
```
Claude Code also runs `npm run setup` automatically at the start of every session (a SessionStart hook in `.claude/settings.json`), so you don't need to run it by hand. **In a cloud environment, leave the environment's Setup script empty.** The hook handles installation, and `VERCEL_TOKEN` goes in the environment variables instead of `.env`.
Edit `pipeline.config.json` to set your agency name, URL, the demo banner text, the maximum number of review rounds, and whether to deploy.

## How it works
| Step | Who | Output |
|---|---|---|
| Capture | `scripts/capture.mjs` (script, no tokens) | `runs/<slug>/before/` with content.json, metrics.json, shots/, plus `assets/` |
| Analyze | `analyst` agent (Sonnet) | `brief.json`: industry, design skill, 5 testable improvements, pitch |
| Design | `designer` agent (Opus) | `sites/<slug>/`, an Astro + Tailwind site |
| Review | capture of the new build, then the `reviewer` agent (Sonnet) | `review-N.json` with PASS/FAIL. On FAIL the designer patches from the fix list, then it's reviewed again |
| Deploy | `scripts/deploy.sh` | Vercel project `demo-<slug>` with its public URL in `runs/<slug>/url.txt` |

A demo is deployed only after a PASS. A PASS requires all of the following:
- all 5 improvements applied
- every score at least as good as the old site's, with aesthetics and conversion at least 2 points higher
- accessibility no worse than before
- no horizontal scrolling on mobile
- a CTA above the fold

## Why it is token-efficient
- Scripts do the scraping, screenshots, metrics, builds and deploys, so no LLM tokens go on mechanical work.
- Screenshots are capped in size: one desktop and one mobile first screen, plus at most 5 full-page tiles 720px wide.
- The scraped content is a compact JSON summary, never raw HTML.
- Each agent starts fresh and reads only the files it needs. The orchestrator passes file paths, never file contents.
- The designer loads one industry playbook, not all 13. Revisions read only the review's fix list and patch the code in place.

## Design playbooks (`.claude/skills/`)
`design-core` holds the universal rules. There are also 13 industry playbooks: veterinary, medical, home-services, legal-finance, restaurant-hospitality, beauty-wellness, fitness, real-estate, automotive, saas-tech, professional-services, retail, and nonprofit-community. Each one has 2–3 named style directions with color tokens, font pairings, a section order, trust signals, tone, and things to avoid. To add your own, copy one, edit it, and add its name to the list in `.claude/agents/analyst.md`.

## Useful commands
```bash
node scripts/capture.mjs <url> --content --out runs/<slug>/before   # capture only
node scripts/new-site.mjs <slug>                                     # scaffold a site
cd sites/<slug> && npm run dev                                       # tweak a demo by hand
bash scripts/deploy.sh <slug> [--force]                              # deploy (--force skips the review gate)
```
`/demo <url>` picks up where it left off if `runs/<slug>/brief.json` already exists. Use `--fresh` to start over.
