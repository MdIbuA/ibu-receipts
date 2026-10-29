# Deploy to AWS Amplify Hosting

About 20 minutes from an empty AWS account to a live URL. Console labels shift a little over time; if a button reads slightly differently, the step is the same.

You need an **AWS account** and a **GitHub account**.

---

## 1. Set a cost alarm first (2 min)

A static site costs pennies, but an alarm costs nothing, and it's the first AWS setup step you can screenshot.

1. AWS console → search bar → **Billing and Cost Management** → left menu **Budgets** → **Create budget**.
2. **Use a template (simplified)** → **Monthly cost budget**.
3. Budget name: `ibu-receipts-guard`. Budgeted amount: `5` (USD). Email recipients: your email.
4. **Create budget**.

📸 `SCREENSHOTS.md` #6: the budget in the Budgets list.

## 2. Put the code on GitHub (5 min)

1. Go to https://github.com/new
   - Repository name: **`ibu-receipts`** (the site's footer and receipts link to `github.com/MdIbuA/ibu-receipts`; if you pick another name, find-and-replace it in `site/` and the docs)
   - **Public** (the challenge needs a public repo link)
   - Leave "Add a README" **unchecked**; this folder already has one
   - **Create repository**
2. In a terminal, in this project folder:

```bash
git init -b main
git add .
git commit -m "Ibu keeps receipts: portfolio with a receipts layer"
git remote add origin https://github.com/MdIbuA/ibu-receipts.git
git push -u origin main
```

`.gitattributes` forces Linux line endings on `scripts/stamp-build.sh`. Without it, a Windows checkout could break bash on the Amplify build machine.

## 3. Create the Amplify app (5 min)

1. AWS console → pick a region in the top-right (any works; for example **US East (N. Virginia)** or **Asia Pacific (Mumbai)**) → search **Amplify** → open **AWS Amplify**.
2. Click **Create new app** (on a fresh account the button may read **Deploy an app** or **Get started**).
3. **Choose source code provider:** **GitHub** → **Next**.
4. A GitHub window opens:
   - **Authorize AWS Amplify**
   - If asked to install the Amplify GitHub App: choose **Only select repositories** → `ibu-receipts` → **Install & Authorize**
5. Back in Amplify, **Add repository and branch**:
   - Repository: `MdIbuA/ibu-receipts`
   - Branch: `main`
   - Leave **My app is a monorepo** unchecked → **Next**
6. **App settings**:
   - App name: `ibu-receipts`
   - Build settings: Amplify should say it **detected `amplify.yml`** in the repo. Expand it to check that the build command is `bash scripts/stamp-build.sh` and the output directory is `site`.
   - Leave the service role and advanced settings at their defaults → **Next**
7. **Review** → **Save and deploy**.

## 4. Watch the first build (2 min)

The branch shows three steps: **Provision → Build → Deploy**. When all three are green:

- Open the **Build** step's log and find the line:
  `build-info: deployed=true app=d… branch=main job=1 commit=…`
  That's the stamp script writing the site's own receipt.

📸 #1 app overview, #2 build history, #3 that log line, #4 build settings, #5 the domain.

## 5. Open the live site (1 min)

- In the app's overview, click the domain, which looks like **`https://main.d1abc2def3.amplifyapp.com`**.
- Scroll to the footer and click **deployed on AWS Amplify**. The receipt should say **Verified** and show build **#1** and the same commit hash GitHub shows for your latest commit.

That URL is your **live URL**. Copy it.

## 6. Prove the pipeline with a second deploy (3 min)

1. Replace `<LIVE_URL>` in `README.md` and `PROJECT_WRITEUP.md` with your live URL.
2. Commit and push:

```bash
git add README.md PROJECT_WRITEUP.md
git commit -m "Add live URL"
git push
```

3. Amplify starts build **#2** on its own. When it finishes, reload the site: the footer receipt now says **Build #2** with the new commit. Screenshot the receipt beside the Amplify build page (📸 #7). It's the clearest single proof that the AWS implementation works.

## 7. Keep it live through judging (until the end of November)

- Don't delete the app or disconnect the repo.
- Leave **Hosting → Access control** off; judges must be able to open the site without a password.
- Every push to `main` redeploys. If you change something during judging, check that the build goes green.
- The budget alert from step 1 emails you if anything unexpected starts costing money.

## 8. Turn on "Re-check with AWS Lambda" (15 min)

`infra/recheck/` is a small serverless stack: one HTTP API route (throttled to 5 requests a second) and one Lambda that re-checks a receipt's evidence live. Deploy it in **us-east-1**, the same region as the Amplify app, because the site's content security policy only allows that region's API Gateway.

**Option A, with the SAM CLI (simplest):** install it ([AWS SAM CLI install guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)), then:

```bash
cd infra/recheck
sam deploy --guided --region us-east-1 --stack-name ibu-receipts-recheck --capabilities CAPABILITY_IAM
```

Accept the defaults (the app ID, branch and site origin are already filled in), say **Y** to saving the config, and copy the **RecheckUrl** output.

**Option B, with only the AWS CLI** (already on this laptop): it needs a bucket to upload the code to.

```bash
cd infra/recheck
aws s3 mb s3://ibu-receipts-recheck-artifacts-<your-initials> --region us-east-1
aws cloudformation package --template-file template.yaml --s3-bucket ibu-receipts-recheck-artifacts-<your-initials> --output-template-file packaged.yaml --region us-east-1
aws cloudformation deploy --template-file packaged.yaml --stack-name ibu-receipts-recheck --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --region us-east-1
aws cloudformation describe-stacks --stack-name ibu-receipts-recheck --region us-east-1 --query "Stacks[0].Outputs[0].OutputValue" --output text
```

The last command prints the **RecheckUrl**. Don't commit `packaged.yaml`.

**Connect it to the site:**
1. Amplify → `ibu-receipts` → **Hosting → Environment variables** → **Manage variables** → **Add new**: `VERIFY_URL` = the RecheckUrl → **Save**.
2. **Deployments** → open the latest build → **Redeploy this version**. Environment variables only reach the site on a new build.
3. Open any receipt on the live site. It now ends with **Re-check with AWS Lambda**. Click it on the footer receipt too: it should say "This page was built by that exact build."

📸 SCREENSHOTS.md #16–20.

**Deployed on Oct 29, 2026:** stack `ibu-receipts-recheck` in us-east-1. The API is `https://gfulhw10hd.execute-api.us-east-1.amazonaws.com/recheck`, and the code was uploaded to the private bucket `ibu-receipts-recheck-artifacts-1374-e11d`.

**After judging (December or later), to remove it:**

```bash
aws cloudformation delete-stack --stack-name ibu-receipts-recheck --region us-east-1
aws s3 rb s3://ibu-receipts-recheck-artifacts-1374-e11d --force
```

Then delete `VERIFY_URL` in Amplify and redeploy. The receipts lose their Re-check button and keep everything else.

## 9. Security headers (nothing to do)

`customHttp.yml` sets HSTS, nosniff, a frame ban, a referrer policy, a permissions policy and a strict content security policy on every file. Amplify applies it on the next build. Check it:

```bash
curl -sI https://main.d1nj3qfdmf673t.amplifyapp.com/ | grep -i -E "content-security|strict-transport|x-frame|x-content"
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails with `$'\r': command not found` | Windows line endings got into `stamp-build.sh`. Run `git add --renormalize . && git commit -m "Normalize line endings" && git push`. |
| Build log has no `build-info:` line | Amplify isn't using `amplify.yml`. Go to **Hosting → Build settings** and make sure the repo file is used, not a console-edited spec. |
| Live site shows the page but receipts say "Not deployed" | `build-info.js` wasn't overwritten. Check the build log for the stamp line, then redeploy. |
| Footer links to `ibu-receipts` 404 | The GitHub repo name differs or the repo is private. Make it public, or update the links. |
| The repo isn't listed in step 5 | In GitHub → **Settings → Applications → AWS Amplify → Configure**, grant access to `ibu-receipts`. |
| No "Re-check" button on receipts | `VERIFY_URL` isn't set, or you didn't redeploy after setting it. The build log's `build-info:` line should end with `verify=https://…`, not `verify=none`. |
| "Couldn't reach the checker just now" | The stack isn't in us-east-1 (the security policy blocks other regions), or the API URL is wrong. Open the RecheckUrl with `?id=gitbard` in a browser: it should return JSON. |
| The site receipt's re-check says "couldn't ask Amplify" | The `AmplifyAppId` parameter doesn't match your app. Redeploy the stack with the right app ID (Amplify → App settings → General → App ARN ends with it). |
| The page looks unstyled after a change to `index.html` | You edited the inline script in `<head>`. Update its SHA-256 hash in `customHttp.yml` (the file explains how). |
