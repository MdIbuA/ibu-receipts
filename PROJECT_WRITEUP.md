# I keep receipts: a portfolio where every claim proves itself

> **Before you submit (delete this block):**
> 1. Capture AWS screenshots #1–7 from SCREENSHOTS.md into `docs/screenshots/` and push. The website shots #8–14 are already there.
> 2. Make sure the $5 budget alarm from DEPLOY.md step 1 exists. "How I built it" says you set it up first.
> 3. Open every receipt and click its evidence links yourself. "How I built it" says you reviewed them, so make that true.
> 4. Read the whole post aloud once and change anything that doesn't sound like you.
> 5. The images load from GitHub, so they show up anywhere Markdown images work. If the submission form wants uploads instead, upload the PNGs from `docs/screenshots/` in the same order.

**Live site:** https://main.d1nj3qfdmf673t.amplifyapp.com · **Code:** https://github.com/MdIbuA/ibu-receipts · **Hosted on:** AWS Amplify Hosting

Most portfolios ask you to take their word for it. Mine prints receipts. Every underlined claim on the page (an R² score, a tool count, a latency, a job title) prints a till-style receipt with the evidence behind it, how it was measured, and **the catch**, the part that makes me look worse. The receipts even caught three places where my own earlier write-ups disagreed with my code. That's the creative feature, and I think it's my actual tech superpower: I keep receipts.

![The hero: "I build AI systems. I keep the receipts." with the hint box and the receipt stub](https://raw.githubusercontent.com/MdIbuA/ibu-receipts/main/docs/screenshots/08-live-desktop-hero.png)

---

## Why receipts are me

I'm Ibu, a final-year B.Tech IT student in Coimbatore. I build AI agents and serverless apps on AWS, and I keep coming back to one rule: **the model never gets to invent a fact.** In my Supermarket Ops Agent, Claude can't make up a price, because every number comes out of Postgres through one of its tools. My CryptoPulse write-up puts a 47.93% direction accuracy right next to the R² of 0.94, because a coin flip gets 50%.

So for this challenge I asked: what if my portfolio followed the same rule? The page can't claim anything it can't prove, and when it can't, it says so.

## The feature, in one minute

![A printed receipt for "R² 0.94", with the coin-versus-model race](https://raw.githubusercontent.com/MdIbuA/ibu-receipts/main/docs/screenshots/10-feature-receipt-desktop.png)

- **Every claim is a button.** Click `30 typed tools` and a receipt feeds out of a small printer docked bottom-right. It lists line items (`Tools in ALL_TOOLS ..... 30`), the evidence links (the exact file and line on GitHub), how it was measured, the catch, and a stamp: **Verified**, **Partial** or **Self-reported**.
- **Corrections are printed, not hidden.** My README said the agent has 32 tools; the registry has 30. An old write-up said CryptoPulse used an 80/20 split; the notebook's LSTM cell splits 70/30. Tiny Tale Toy's README names a different model from the code. Those receipts carry a red **Corrected** box.
- **Coin vs. model.** The first screen has a **Flip a coin against my model** button. It prints the CryptoPulse receipt and races a coin, flipped 100 times, against my model's 47.93%. The coin often wins, and the receipt says so.
- **The itemized bill.** The printer tab opens a summary: 14 claims, how many are backed by public proof, partial or self-reported, write-ups the code corrected, invented facts (0), and how many receipts *you* have audited.
- **The page's own receipt.** On the first screen, the hero receipt shows which Amplify build and commit you're looking at ("Live on AWS Amplify · build #4 · commit 1d61ba0"). Click that, or the footer's "deployed on AWS Amplify", and you get the full receipt: app, branch, build number and commit, written into the page by the Amplify build at deploy time. I didn't type them. AWS did.

![The page's own receipt next to the matching build in the Amplify console](https://raw.githubusercontent.com/MdIbuA/ibu-receipts/main/docs/screenshots/07-site-receipt-vs-console.png)

**How you find it in ten seconds.** The first screen has a dashed **"How to read this page"** box that names the first claim to try (`R² 0.94`, which pulses a few times to catch your eye), a receipt-shaped **stub** that prints itself out of a little printer slot the first time you see it ("Printed for you at 10:42"), stamped with the live Amplify build, and a printer **tab** in the corner reading `0/14`. Two buttons sit in the hint: **Flip a coin against my model** and **Highlight all 14 claims**.

![Highlight mode: every claim in the Tech superpowers section marked like a highlighter pen](https://raw.githubusercontent.com/MdIbuA/ibu-receipts/main/docs/screenshots/13-feature-highlight.png)

**What it never does.** It never gets in the way. The panel is non-modal and docked to the side, so the header navigation always works, and a recruiter can read About → Superpowers → Projects without touching it. On phones it's a bottom sheet that closes when you tap a nav link. Without JavaScript, every claim is a plain link to its evidence.

![Mobile, 360px: the receipt as a bottom sheet under an untouched header](https://raw.githubusercontent.com/MdIbuA/ibu-receipts/main/docs/screenshots/11-feature-receipt-mobile.png)

## How I built it

### 1. Account setup
I started with an AWS Budgets alarm: a $5 monthly cost budget with an email alert, before creating anything that could cost money. The code lives in a public GitHub repo, `ibu-receipts`, which my coding agent created and pushed with the GitHub CLI.

### 2. The coding agent
I used **Claude Code** as my coding agent. I gave it the challenge rules, the rubric weights and my existing portfolio, and asked for three feature ideas drawn from me rather than from a template. It proposed Receipts (my honest-metrics habit), a quantum circuit that "measures" me (my Qiskit interest) and a fantasy retelling (my Git Bard project). I picked Receipts because it's the one that only I could have.

The interesting part was the evidence pass. The agent read my public repos file by file: notebook outputs, tool registries, IAM policies, test counts and SAM templates. It turned every claim into a receipt pointing at the exact file and line. That's how the three corrections surfaced. I reviewed every receipt against the source myself before shipping.

### 3. Local build
Plain HTML, CSS and JavaScript: no framework, no build step, no dependencies. The base page works on its own. The feature lives in `site/feature/receipts/` and upgrades the page when JavaScript runs. I previewed it with `python -m http.server`, tested it at 360px, with the keyboard only, in light and dark mode, and with reduced motion. To check the deploy receipt before deploying, I ran the stamp script locally with fake `AWS_*` variables.

### 4. Deploying on AWS Amplify
I connected the repo to Amplify Hosting. `amplify.yml` runs a single command, `bash scripts/stamp-build.sh`, and publishes only the `site/` folder. Build #1 went live on the `amplifyapp.com` domain, and its own receipt immediately caught a bug: Amplify's first build reported its commit as `HEAD` instead of a hash, so the receipt printed "HEAD". I made the stamp script resolve the real hash from the build's clone. I pushed that fix with the live URL and the screenshots, build #2 deployed by itself, and the footer receipt now shows the real commit.

![Amplify build history with two green builds](https://raw.githubusercontent.com/MdIbuA/ibu-receipts/main/docs/screenshots/02-amplify-build-history.png)

## AWS services used

| Service | What it does here |
|---|---|
| **AWS Amplify Hosting** | CI/CD from GitHub (push → build → deploy), HTTPS hosting on Amplify's CDN, and the `AWS_APP_ID` / `AWS_BRANCH` / `AWS_JOB_ID` / `AWS_COMMIT_ID` build variables that write the site's own receipt and its link-preview URLs |
| **AWS Budgets** | A $5/month cost alarm, set up first |

There's no Lambda, API Gateway or database, on purpose. Everything the feature needs is known at build time, and a static site can't fail mid-judging. My Bedrock, Lambda, EventBridge and S3 work is on the page as projects, each with its own receipt. Details and what to check in the console: [AWS.md](AWS.md).

![Amplify app overview: branch main, Deployed, amplifyapp.com domain](https://raw.githubusercontent.com/MdIbuA/ibu-receipts/main/docs/screenshots/01-amplify-overview.png)

## What I learned

- **Writing proof is a test suite for prose.** Three of my published numbers were wrong or stale. Unit tests check code; nothing was checking my write-ups until each sentence needed a link to the line that proves it.
- **The deploy can testify for itself.** Amplify's build variables let the page show which build and commit it came from, which is more convincing than any "hosted on AWS" badge.
- **A playful feature still has to be a good citizen.** I made it a non-modal panel instead of a modal, returned focus on Escape, supported reduced motion, and gave visitors without JavaScript plain links. The fun layer can't cost a recruiter anything.
- **Small is fast.** A visitor's first load is about 42 KB over the wire, and my photo is the biggest file in it. System fonts and inline SVG did the design work.

## Challenges and how I solved them

| Challenge | Fix |
|---|---|
| The close button floated over the receipt and covered text as you scrolled | Moved it into a bar above the paper, outside the scroll area |
| On phones the receipt sheet covers most of the screen | It never covers the header nav, and it closes as soon as you tap a section link |
| GitHub can't deep-link a notebook cell | The receipt links the notebook and names the cell ("Evaluating Model") |
| A section highlight in the nav stuck after scrolling back to the top | Clear the current section when it leaves the viewport band, not only when another enters |
| The print animation is fun once and annoying for some people | `prefers-reduced-motion` disables printing, stamping and pulsing in both CSS and JS |
| Amplify's first build reported its commit as `HEAD`, so the site's receipt printed "HEAD" instead of a hash | The stamp script now resolves anything that isn't a full hash with `git rev-parse HEAD` in the build's clone |
| On a 360px phone, the floating receipts tab sat on top of the hint's buttons on the first screen | The tab tucks away while the hint is on screen and comes back once you scroll past it |
| An accessibility scan (axe) flagged the hero receipt as an `<aside>` nested inside another landmark | Made it a labelled group; axe now reports zero issues at phone and desktop sizes |
| Windows line endings would break the bash stamp script on Amplify's Linux builder | `.gitattributes` forces LF for `*.sh` and `amplify.yml` |
| A `display: grid` rule once beat the `hidden` attribute in an earlier project of mine and covered the whole app | `[hidden] { display: none !important; }` from the first line |

## Links

- **Live portfolio:** https://main.d1nj3qfdmf673t.amplifyapp.com
- **Jump straight to a receipt:** https://main.d1nj3qfdmf673t.amplifyapp.com/#r-supermarket · the bill: https://main.d1nj3qfdmf673t.amplifyapp.com/#receipts
- **GitHub repository:** https://github.com/MdIbuA/ibu-receipts
- **Me on AWS Builder Center:** https://builder.aws.com/community/@abufawaz
