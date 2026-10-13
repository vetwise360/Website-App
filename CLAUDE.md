# Demo Site Pipeline

Turns a lead's website URL into a redesigned, higher-converting demo homepage on a Vercel staging URL. Run it with `/demo <url>`.

## Flow
1. `scripts/capture.mjs` (no LLM): scrapes the site into `runs/<slug>/before/content.json`, saves screenshots (`shots/`), downloads the logo and images to `runs/<slug>/assets/`, and writes `metrics.json` (perf, axe a11y, mobile checks).
2. `analyst` agent (Sonnet) writes `runs/<slug>/brief.json`: industry, design skill + direction, cleaned content, and 5 improvements with acceptance criteria.
3. `designer` agent (Opus) builds `sites/<slug>/` from `template/` using `design-core` plus one `design-<industry>` skill.
4. `capture.mjs sites/<slug>/dist --out runs/<slug>/after-N`, then the `reviewer` agent (Sonnet) writes `review-N.json` (PASS/FAIL). On FAIL the designer revises from that file only. Max rounds come from `pipeline.config.json`.
5. `scripts/deploy.sh <slug>` deploys only if the latest review is PASS, then writes `runs/<slug>/url.txt`.

## Rules
- Agents communicate through files in `runs/<slug>/`. The orchestrator passes paths and never contents.
- Never ship a demo that hasn't passed review. Never invent reviews, ratings, awards, or statistics.
- Design tokens live only in `src/styles/global.css` `@theme`. Content lives in `src/data/site.json`.
- To add an industry, create `.claude/skills/design-<name>/SKILL.md` in the same format as the others, then add its name to the skill list in `.claude/agents/analyst.md`.
- `runs/` and `sites/` are gitignored (per-lead output).
