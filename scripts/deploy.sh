#!/usr/bin/env bash
# Deploy sites/<slug> to its own Vercel project (demo-<slug>) and print the public URL.
#   bash scripts/deploy.sh <slug> [--force]
# Refuses to deploy unless the latest review in runs/<slug>/ is a PASS (override with --force).
set -euo pipefail
cd "$(dirname "$0")/.."
SLUG="${1:?usage: deploy.sh <slug> [--force]}"
FORCE="${2:-}"
SITE="sites/$SLUG"; RUN="runs/$SLUG"
[ -f .env ] && set -a && . ./.env && set +a
: "${VERCEL_TOKEN:?Set VERCEL_TOKEN in .env (https://vercel.com/account/tokens)}"

LATEST=$(ls "$RUN"/review-*.json 2>/dev/null | sort -V | tail -1 || true)
if [ "$FORCE" != "--force" ]; then
  [ -n "$LATEST" ] || { echo "No review found in $RUN — run the reviewer first." >&2; exit 1; }
  grep -q '"verdict": *"PASS"' "$LATEST" || { echo "Latest review ($LATEST) is not PASS — not deploying." >&2; exit 1; }
fi

(cd "$SITE" && npm run build --silent >/dev/null)

# Deploy the static build from a folder named after the project, so Vercel names it demo-<slug>.
PROJECT="demo-$SLUG"
OUT="$RUN/deploy/$PROJECT"
rm -rf "$OUT" && mkdir -p "$OUT" && cp -r "$SITE/dist/." "$OUT/"
SCOPE_ARGS=(); [ -n "${VERCEL_SCOPE:-}" ] && SCOPE_ARGS=(--scope "$VERCEL_SCOPE")

# Production deploy of a per-lead project = a public, stable *.vercel.app staging URL.
# (Preview deploys are behind Vercel Authentication by default, so leads couldn't open them.)
DEPLOY_URL=$(cd "$OUT" && npx --yes vercel@60.1.3 deploy --prod --yes --token "$VERCEL_TOKEN" "${SCOPE_ARGS[@]}" 2>/dev/null | tail -1)
ALIAS="https://$PROJECT.vercel.app"

URL="$DEPLOY_URL"
if [ "$(curl -s -o /dev/null -w '%{http_code}' "$ALIAS")" = "200" ]; then URL="$ALIAS"; fi
echo "$URL" > "$RUN/url.txt"
echo "$URL"
