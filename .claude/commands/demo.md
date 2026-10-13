---
description: Build a redesigned demo homepage for a lead from their URL (capture → analyze → design → review loop → deploy)
argument-hint: <lead-url> [--no-deploy] [--fresh]
---

Run the demo pipeline for: $ARGUMENTS

You are the **orchestrator**. Keep your own context small: you run scripts and delegate to subagents, passing *file paths*, never file contents. Do **not** open screenshots, content.json, or site code yourself — the subagents do that. Read only the small JSON fields named below.

Settings come from `pipeline.config.json` (agency, demoBanner, maxReviewRounds, deploy). `--no-deploy` overrides deploy.

## 0. Setup
- Derive `slug` from the URL hostname: drop `www.`, replace non-alphanumerics with `-`, lowercase (e.g. `https://www.happypawsvet.com/` → `happypawsvet-com`).
- If `node_modules/` or `template/node_modules/` is missing, run `npm run setup` first.
- If `runs/<slug>/brief.json` exists and `--fresh` was not passed, tell the user you're resuming and skip to the first missing step (brief → site → review). With `--fresh`, delete `runs/<slug>` and `sites/<slug>` first.

## 1. Capture (script, no LLM)
`node scripts/capture.mjs <url> --content --out runs/<slug>/before`
It prints a one-line JSON summary. If it fails (blocked, timeout, 403), stop and report the error.

## 2. Analyze
Agent `analyst`, prompt: `slug=<slug>. Inputs in runs/<slug>/before and runs/<slug>/assets. Write runs/<slug>/brief.json.`

## 3. Design (BUILD)
Agent `designer`, prompt: `BUILD slug=<slug>. Brief: runs/<slug>/brief.json. Demo banner: show=<demoBanner.show>, credit="<demoBanner.text>", url=<agency.url>.`

## 4. Review loop — N = 1 .. maxReviewRounds
1. `node scripts/capture.mjs sites/<slug>/dist --out runs/<slug>/after-<N>`
2. Agent `reviewer`, prompt: `slug=<slug> round=<N>. Compare runs/<slug>/before vs runs/<slug>/after-<N> against runs/<slug>/brief.json` (+ ` Previous review: runs/<slug>/review-<N-1>.json` when N ≥ 2) `. Write runs/<slug>/review-<N>.json.`
3. Check the `verdict` field of `runs/<slug>/review-<N>.json` (e.g. `grep '"verdict"'`).
   - **PASS** → go to step 5.
   - **FAIL** and N < maxReviewRounds → Agent `designer`, prompt: `REVISE slug=<slug>. Apply runs/<slug>/review-<N>.json.` Then N = N + 1 and repeat.
   - **FAIL** at the last round → **stop. Do not deploy.** Report the remaining fixes from the last review and tell the user they can run `/demo <url>` again to continue with more rounds, or fix by hand.

## 5. Deploy
If deploy is enabled: `bash scripts/deploy.sh <slug>` (it refuses unless the latest review is PASS). If `VERCEL_TOKEN` is missing, tell the user to add it to `.env` and stop.

## 6. Report (keep it short)
- Staging URL (from `runs/<slug>/url.txt`)
- Rounds needed, old → new scores (from the last review's `scores`)
- The 5 improvements, one line each
- `brief.pitch` — ready to paste into LinkedIn
- Any placeholders the designer flagged
