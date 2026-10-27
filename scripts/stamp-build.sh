#!/usr/bin/env bash
# Writes site/feature/receipts/build-info.js during the AWS Amplify build, so the
# page can print a receipt for its own deployment: app, branch, build number,
# commit and size. Amplify sets the AWS_* variables. Run it locally and the
# receipt says the copy isn't deployed.
set -euo pipefail

out="site/feature/receipts/build-info.js"

# Only characters that are safe inside a JS string literal.
clean() { printf '%s' "${1:-}" | tr -cd 'A-Za-z0-9._:/-'; }

app="$(clean "${AWS_APP_ID:-}")"
branch="$(clean "${AWS_BRANCH:-}")"
job="$(clean "${AWS_JOB_ID:-}")"
commit="$(clean "${AWS_COMMIT_ID:-}")"
# Amplify's first build (started from the console) reported AWS_COMMIT_ID=HEAD.
# Resolve anything that isn't a full hash from the build's own clone.
if ! printf '%s' "$commit" | grep -Eq '^[0-9a-f]{40}$'; then
  commit="$(git rev-parse HEAD 2>/dev/null | tr -cd '0-9a-f' || true)"
fi
region="$(clean "${AWS_REGION:-${AWS_DEFAULT_REGION:-}}")"
built_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

deployed=false
site_url=""
if [ -n "$app" ] && [ -n "$job" ]; then
  deployed=true
  # Amplify's default domain is https://<branch>.<app-id>.amplifyapp.com
  site_url="https://$(printf '%s' "$branch" | tr '/' '-').${app}.amplifyapp.com"
  # Link previews need absolute URLs, which only exist once the app does.
  sed -i "s#__SITE_URL__#${site_url}#g" site/index.html
fi

# Write a placeholder first so the size below already counts this file.
printf 'window.BUILD_INFO={};\n' > "$out"
site_bytes="$(find site -type f -exec cat {} + | wc -c | tr -d ' ')"

cat > "$out" <<EOF
/* Written by scripts/stamp-build.sh at build time. Do not edit by hand. */
window.BUILD_INFO = {
  deployed: $deployed,
  host: "AWS Amplify Hosting",
  appId: "$app",
  branch: "$branch",
  job: "$job",
  commit: "$commit",
  region: "$region",
  siteUrl: "$site_url",
  builtAt: "$built_at",
  siteBytes: $site_bytes
};
EOF

echo "build-info: deployed=$deployed app=$app branch=$branch job=$job commit=${commit:0:7} bytes=$site_bytes"
