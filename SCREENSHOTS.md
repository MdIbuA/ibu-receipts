# Screenshot checklist

Save each one as a PNG in `docs/screenshots/` with exactly this filename. README.md and PROJECT_WRITEUP.md already point at these names.

**Status (Oct 30): all 23 are captured.** The website shots (#8–15, #20–23) come from the live site at build #9 (headless Chrome, light mode; desktop 1440×900, phone 360×740 at 2×). The AWS console shots (#1–7, #16–19) were taken on Oct 30 in a signed-in console window, with the account ID masked in the page before each capture.

**Keep the build numbers consistent.** Screenshot-only pushes don't change the site, so end their commit message with `[skip-cd]`. Amplify then skips the build, and the live receipt keeps showing the same build as your console screenshots:

```bash
git add docs/screenshots
git commit -m "Add AWS setup screenshots [skip-cd]"
git push
```

**How to capture**
- Windows: **Win + Shift + S** → rectangle, then paste into Paint and save as PNG. For a whole page in Chrome: DevTools (**F12**) → **Ctrl + Shift + P** → type `screenshot` → **Capture full size screenshot**.
- Phone sizes: Chrome DevTools → **Toggle device toolbar** (**Ctrl + Shift + M**) → width **360** or **390**.
- Use a light-mode browser for the site shots (that's what most judges will see), at 100% zoom.
- Crop out your bookmarks bar and other tabs. Never show account IDs, access keys or your email; blur them.

## AWS setup (proves the Working AWS implementation criterion)

| # | File | Where | Must be visible |
|---|---|---|---|
| 1 | `01-amplify-overview.png` | Amplify → `ibu-receipts` → Overview | App name, branch `main`, status **Deployed**, the `amplifyapp.com` domain, last deploy time. **Captured.** |
| 2 | `02-amplify-build-history.png` | Amplify → `ibu-receipts` → `main` → Deployments / build history | At least **two green builds**, with commit messages. **Captured** (eight builds). |
| 3 | `03-amplify-build-log.png` | Open the latest build → **Build** step log | The line `build-info: deployed=true app=… branch=main job=… commit=…` (zoom in so it's readable). **Captured** at 2×. |
| 4 | `04-amplify-build-settings.png` | Amplify → Hosting → **Build settings** | The `amplify.yml` content: `bash scripts/stamp-build.sh`, `baseDirectory: site`. **Captured.** |
| 5 | `05-amplify-domain.png` | Amplify → Hosting → **Custom domains** (or Domain management) | The default `main.<id>.amplifyapp.com` domain with HTTPS / *Available* status. **Captured.** |
| 6 | `06-budget.png` | Billing and Cost Management → **Budgets** | `My Zero-Spend Budget` (alerts when actual spend passes $0.01), actual spend near $0. **Captured.** |
| 7 | `07-site-receipt-vs-console.png` | Two windows side by side: the live site with the footer receipt open (`https://main.d1nj3qfdmf673t.amplifyapp.com/#r-site`), and the page for the **latest** build in Amplify | The **same build number and commit** in both. This is the strongest single image in the submission. **Captured:** the live receipt beside Amplify's build #8 card and its log line, both at 2×. |

## The re-check stack (after DEPLOY.md step 8)

| # | File | Where | Must be visible |
|---|---|---|---|
| 16 | `16-lambda-function.png` | Lambda → `ibu-receipts-recheck` | Runtime Python 3.12, arm64, the **API Gateway** trigger in the diagram. **Captured** as two crops of the function page: the overview and Runtime settings. |
| 17 | `17-api-throttling.png` | API Gateway → the `ibu-receipts-recheck` HTTP API → **Throttling** | Default route: rate 5, burst 10. **Captured** on the `$default` stage. |
| 18 | `18-cloudwatch-logs.png` | CloudWatch → Log groups → `/aws/lambda/ibu-receipts-recheck` | A few lines like `{"claim": "supermarket", "ok": true, "ms": 812}`, retention 1 month. Click a few re-check buttons first. **Captured** as two crops: the log group details and the log events filtered to `claim`. |
| 19 | `19-amplify-env-var.png` | Amplify → Hosting → **Environment variables** | `VERIFY_URL` = the `…execute-api.us-east-1.amazonaws.com/recheck` URL. **Captured.** |
| 20 | `20-recheck-in-action.png` | Live site → `#r-supermarket` → **Re-check with AWS Lambda** | "✓ All 4 checks passed · checked … by AWS Lambda". **Captured.** |
| 21 | `21-site-recheck-aws.png` | Live site → `#r-site` → **Re-check with AWS Lambda** | The AWS Amplify API's latest build and commit, then "This page was built by that exact build." **Captured.** |

## The job receipt

| # | File | Where | Must be visible |
|---|---|---|---|
| 22 | `22-job-receipt.png` | Live site → `#job-cloud-intern` | A job receipt for the sample cloud intern role: proven lines with their file:line links, and at least one **No receipt** line. **Captured.** |
| 23 | `23-job-receipt-mobile.png` | Device mode 360 → `#job-ml-engineer`, scrolled to the end | The totals (Proven, Partial, No receipt, Invented 0) and the "N of M proven" stamp. **Captured.** |

## The live portfolio (proves completeness and usability)

| # | File | Where | Must be visible |
|---|---|---|---|
| 8 | `08-live-desktop-hero.png` | `https://main.d1nj3qfdmf673t.amplifyapp.com` at 1440×900 (or your laptop's full window) | Name, headline, the **"How to read this page"** hint box, the receipt stub, and the printer tab in the corner. This is the "hint visible" shot. |
| 9 | `09-live-mobile.png` | `https://main.d1nj3qfdmf673t.amplifyapp.com` in device mode, width 360 | Header with all four nav links, the headline and the hint box, with no sideways scrolling |
| 10 | `10-feature-receipt-desktop.png` | `https://main.d1nj3qfdmf673t.amplifyapp.com/#r-cryptopulse` → scroll the receipt to **The catch** → click **Flip a coin 100 times** | The receipt with the coin race result, the **Corrected** box and the page behind it |
| 11 | `11-feature-receipt-mobile.png` | Device mode 360 → `https://main.d1nj3qfdmf673t.amplifyapp.com/#r-supermarket` | The receipt as a bottom sheet, the header still visible above it |
| 12 | `12-feature-bill.png` | `https://main.d1nj3qfdmf673t.amplifyapp.com/#receipts`, after opening 3–4 receipts | The itemized bill: totals, "Audited by you: N of 14" progress bar, ticked items |
| 13 | `13-feature-highlight.png` | Hero → click **Highlight all 14 claims** → scroll to Tech superpowers | Claims highlighted like a marker pen across the section |
| 14 | `14-github-repo.png` | `https://github.com/MdIbuA/ibu-receipts` | Repo root: `amplify.yml`, `site/`, `scripts/`, the README rendering |
| 15 | `15-live-site-receipt.png` | `https://main.d1nj3qfdmf673t.amplifyapp.com/#r-site` | The page's own receipt: Amplify build number, commit, domain and region. The README shows this one; #7 pairs it with the console. |

## Optional: makes the write-up much stronger

- **A 15–20 second screen recording (GIF or MP4):** click `R² 0.94` → the receipt prints → flip the coin → open the bill. On Windows, **Win + Alt + R** starts a Game Bar recording; convert it to GIF with any free converter. Name it `docs/screenshots/demo.gif` and put it right under the first paragraph of the write-up.
