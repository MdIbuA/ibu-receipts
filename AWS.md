# AWS services used

| Service | Role in this project |
|---|---|
| **AWS Amplify Hosting** | Builds the site from GitHub on every push, writes the deploy into the page, sends strict security headers, and serves it over HTTPS from Amplify's CDN |
| **Amazon API Gateway** (HTTP API) | One route, `GET /recheck`, throttled to 5 requests a second (burst 10), CORS limited to the portfolio's origin |
| **AWS Lambda** (Python 3.12, arm64) | "Re-check with AWS Lambda": fetches a receipt's evidence from GitHub at the pinned commit and checks it again, live. For the page's own receipt it asks the Amplify API which build is live. |
| **AWS IAM** | Besides writing its own logs (`AWSLambdaBasicExecutionRole`), the Lambda's role can do exactly one thing in my account: `amplify:ListJobs` on this app's `main` branch |
| **Amazon CloudWatch Logs** | Every re-check logs `{"claim", "ok", "ms"}`: an audit trail of the audits, kept 30 days |
| **AWS Budgets** | A $5/month cost alarm, set up before anything else |

The re-check stack is defined as code in `infra/recheck/template.yaml` (AWS SAM). The site's static, so it never depends on the API: if the checker is down, every receipt still shows its stored evidence.

---

## AWS Amplify Hosting

- **CI/CD from GitHub.** Connected to the `main` branch of `github.com/MdIbuA/ibu-receipts`. Each push runs Provision → Build → Deploy. Commits that only touch docs or screenshots end with `[skip-cd]`, so Amplify skips them and the live build number stays put.
- **The build spec is in the repo** (`amplify.yml`). The build runs `bash scripts/stamp-build.sh` and publishes only the `site/` folder.
- **Build variables feed the creative feature.** The stamp script writes `AWS_APP_ID`, `AWS_BRANCH`, `AWS_JOB_ID` and `AWS_COMMIT_ID` into `site/feature/receipts/build-info.js`. The hero receipt and the footer's "deployed on AWS Amplify" print them as the page's own receipt, so AWS writes the proof of deployment, not me. The script also derives the app's domain for the link-preview tags.
- **An environment variable wires in the API.** `VERIFY_URL` (set in the Amplify console) holds the re-check API's address. The build stamps it into the page; without it, receipts simply have no re-check button.
- **Security headers** (`customHttp.yml`), on every file:
  - a strict content security policy: scripts from the site itself plus one hashed inline script, no inline styles, and network calls only to the site and the us-east-1 API
  - HSTS
  - `nosniff`
  - frames denied
  - a referrer policy and a permissions policy
- **Hosting** is the default `main.<app-id>.amplifyapp.com` domain over HTTPS.

## Amazon API Gateway + AWS Lambda: "Re-check with AWS Lambda"

Every receipt ends with a button that runs its checks again, right now, on AWS:

- **Evidence checks.** Each claim has 1–4 checks, written in the Lambda. For example:
  - `registry.ts` at commit `fcf311e` still has 30 tool schemas
  - the CryptoPulse notebook still prints `R²: 0.9402 | Direction Accuracy: 47.93%`
  - the Ghost Probe IAM policy is still all `s3:Get*`/`s3:List*`

  There are 29 checks across 13 claims, plus one Amplify check for the page's own receipt.
- **The corrections are checked too.** "The README still says 32" passes, which proves the correction is still needed.
- **The page's own receipt** calls `amplify:ListJobs`. It reports the latest successful build and commit, and the page confirms it was built by that exact build.

**Safety and cost**
- The Lambda only fetches URLs hard-coded in its own check list (pinned commits on GitHub, plus one AWS Builder Center page), so the API can't be aimed anywhere else.
- Results are cached for 5 minutes per claim. The API throttles at 5 requests a second.
- Network trouble shows as "couldn't check", never as "failed".
- Lambda and HTTP API usage at portfolio scale costs fractions of a cent.

**What to look for in the console**
1. **Lambda → `ibu-receipts-recheck`:** runtime Python 3.12 on arm64, the API Gateway trigger, and a role with one inline `amplify:ListJobs` statement plus the standard logging policy.
2. **API Gateway → the HTTP API → Throttling:** 5 requests a second, burst 10; CORS shows the one allowed origin.
3. **CloudWatch → Log groups → `/aws/lambda/ibu-receipts-recheck`:** lines like `{"claim": "supermarket", "ok": true, "ms": 812}`, retention 30 days.
4. **CloudFormation → `ibu-receipts-recheck`:** the stack, created from the SAM template in the repo.

## Amplify console checks

1. **Overview:** branch `main`, status *Deployed*, the `amplifyapp.com` domain.
2. **Build history:** several green builds, which shows push-to-deploy working.
3. **Build log:** `build-info: deployed=true app=… branch=main job=… commit=… verify=https://…`
4. **Hosting → Build settings:** the repo's `amplify.yml`. **Environment variables:** `VERIFY_URL`.
5. **Match it to the live page:** the hero says "Live on AWS Amplify · build #N · commit …". Click it, then **Re-check with AWS Lambda**: AWS confirms the same build.

## AWS Budgets

A monthly cost budget, `ibu-receipts-guard`, set at $5 with an email alert, created before the Amplify app (DEPLOY.md step 1). Look for it under Billing and Cost Management → Budgets, with actual spend near $0.

---

## Why the backend is this small

The portfolio itself is static: it can't break during judging, and the re-check is an extra on top, never a dependency. The backend exists only where it adds something a static page can't: a live, independent check that the evidence still says what the receipt claims, plus AWS's own word on which build is live.

## Services I considered and didn't use

| Service | Why not |
|---|---|
| Amazon DynamoDB (counters, a guestbook) | Would add state and write traffic without proving anything. CloudWatch Logs already keeps the audit trail. |
| Amazon Bedrock (an "ask about me" bot) | Every portfolio has one, it costs money per visit, and a model inventing answers about me would break this site's one rule. My Bedrock work is in the projects instead, each with a receipt. |
| Lambda function URLs | Simpler, but they have no throttling. API Gateway's HTTP API does. |
| Amazon S3 + CloudFront directly | Amplify Hosting already gives a CDN, HTTPS, headers and push-to-deploy. I used S3 + CloudFront by hand for DocuMind AI. |
