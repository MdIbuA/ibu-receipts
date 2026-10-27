# Rubric audit

Scores are 1–5 per criterion. Each criterion is worth `weight × score / 5` points out of 100.

## Re-scored Oct 28, after deploying

| Criterion | Weight | Before deploy | Now (live) | Once AWS shots #1–7 are in |
|---|---|---|---|---|
| Creativity & memorability | 30% | 4 → 24 | 4.5 → 27 | 4.5 → 27 |
| Working AWS implementation | 25% | 2 → 10 | 4.5 → 22.5 | 5 → 25 |
| Communication quality | 25% | 3 → 15 | 4 → 20 | 5 → 25 |
| Portfolio completeness & usability | 20% | 4 → 16 | 4.5 → 18 | 4.5 → 18 |
| **Total** | | **65** | **87.5** | **95** |

**What moved the scores**
- The site is live on Amplify Hosting.
- Every link resolves except LinkedIn, which blocks automated checks.
- The site's own receipt is stamped by the real build, and that receipt caught a real bug (the commit printed as `HEAD`), now fixed.
- The hero stub prints on first view, and shared links show a preview card.
- Website screenshots #8–14 are in the repo.

**What's left (yours)**
- AWS console screenshots #1–7.
- Confirm the budget alarm exists.
- Click through every receipt.
- One read-through of the write-up in your own voice.

The detailed analysis below is the pre-deploy baseline.

## Baseline (before deploying)

| Criterion | Weight | Score now | Points now | After top 3 fixes |
|---|---|---|---|---|
| Creativity & memorability | 30% | **4** | 24 | 4.5 → 27 |
| Working AWS implementation | 25% | **2** | 10 | 5 → 25 |
| Communication quality | 25% | **3** | 15 | 5 → 25 |
| Portfolio completeness & usability | 20% | **4** | 16 | 4.5 → 18 |
| **Total** | | | **65** | **95** |

---

## 1. Creativity & memorability: 4 / 5

**Evidence**
- The feature comes from a documented habit of mine, not a template. My agents never invent facts, and my case studies print the unflattering metric. The receipts apply that rule to me.
- It does real work. Writing the 14 receipts against my public code caught **3 places where my own write-ups were wrong**: Supermarket agent tools 32 → 30 (`registry.ts`), CryptoPulse split 80/20 → 70/30 (notebook), Tiny Tale Toy's model (README vs `lambda_function.py`). Those receipts print the correction.
- Memorable moments: the receipt feeding out of a printer in steps, a rubber-stamp verdict, the **coin-vs-model race** (a fair coin beats my model's 47.93% about two times in three), and the **page's own receipt**, written by the Amplify build.
- It reflects things only I could claim: integer paise, khata ledgers, a Friday bard, a Qiskit workshop.

**Why not 5:** the payoff needs one click. A judge who only skims sees a static stub and a dashed hint, which could read as "a portfolio with footnotes". The write-up has no moving demo yet.

## 2. Working AWS implementation: 2 / 5 (now) → 5 after deploying

**Evidence**
- `amplify.yml` runs `bash scripts/stamp-build.sh` and publishes only `site/`.
- I ran the stamp script locally with fake Amplify variables. It produced valid JS (`deployed=true … job=0000000003 commit=3f9c2e1 bytes=176876`), and the page rendered "Build #3 · commit 3f9c2e1 · 173 KB" with a **Verified** stamp.
- 37 of the 41 unique URLs in the page and receipts return HTTP 200 (checked Oct 28). Three point at this repo, `github.com/MdIbuA/ibu-receipts`, which doesn't exist until step 2 of DEPLOY.md. LinkedIn answers automated checks with a 999 but opens normally in a browser.
- All 19 evidence permalinks are pinned to commit SHAs, so they can't drift during judging.
- AWS.md lists every service, why it's used, why there's no backend, and five console checks for a judge.

**Why 2:** the site isn't live. "Site loads during judging" can't be scored until there's a URL.

## 3. Communication quality: 3 / 5

**Evidence**
- PROJECT_WRITEUP.md follows the required order: hook naming the feature → why it's me → the feature → build story (account → coding agent → local → Amplify) → AWS services → lessons → a challenges table → links.
- The challenges are real ones from this build: the close button covering text, the stuck nav highlight, line endings vs. bash, notebook cells that can't be deep-linked.
- SCREENSHOTS.md names 14 shots with exact filenames, URLs and what must be visible, already wired into README and the write-up.
- DEPLOY.md has click-level steps and a troubleshooting table.

**Why 3:** no screenshots exist yet, `<LIVE_URL>` is a placeholder, and the write-up was drafted by my coding agent. It needs my own read-through and voice before it counts as mine.

## 4. Portfolio completeness & usability: 4 / 5

**Evidence**
- Clearly labelled **About me**, **Tech superpowers** and **Projects & achievements** sections, plus Contact. The sticky nav underlines the section on screen.
- **360px:** tested with no horizontal scroll; the header keeps all four links; the receipt becomes a bottom sheet that leaves the header alone and closes on nav taps.
- **Keyboard:** tested. Enter on a claim prints the receipt and focuses its title; Escape closes it and returns focus to the claim.
- **Contrast:** 19 colour pairs measured, lowest 5.25:1 (WCAG AA needs 4.5). That covers light, dark and receipt paper.
- **Reduced motion** turns off the printing, stamp and nudge animations (CSS and JS). **No-JS:** every claim stays a working link.
- **Weight:** first load is about 42 KB over the wire (25 KB of gzipped text plus an 18 KB lazy portrait); everything shipped, including the link-preview image, is about 300 KB.

**Why not 5:** not yet checked on a real phone or iOS Safari. There's no Open Graph image, so a shared link (Builder Center, LinkedIn) shows a plain text card. The floating printer tab briefly covers a line of text on small phones as you scroll.

---

## Top 3 weaknesses

1. **It isn't live.** That caps the AWS criterion (25%) and blocks half the screenshots.
2. **The submission has no screenshots, live URL or personal voice yet.** Screenshots of both the portfolio and the AWS setup are a hard requirement, not just points.
3. **The first 10 seconds are static.** The creative layer is easy to find but only comes alive on click. Shared links have no preview image.

## Fixes, ranked by points per hour

| Rank | Fix | Who | Effort | Points | Points / hour |
|---|---|---|---|---|---|
| 1 | **Deploy.** DEPLOY.md steps 1–6: budget, GitHub repo, Amplify app, build #1, README URL push → build #2. Then check the footer receipt matches the console. | You do the AWS and GitHub clicks. I can run the `git init / commit / push` once the project is in a permanent folder. | 45 min | +15 (AWS 2 → 5) | **~20** |
| 2 | **First-impression polish.** The hero stub prints itself once on first visit (skipped with reduced motion), and the hint names the claim count. Add an Open Graph image (a printed receipt) so shared links show the feature. | Me | 45 min | +5 (creativity +3, usability +2) | **~7** |
| 3 | **Screenshots and voice.** Capture the 14 shots and a 20-second GIF, replace `<LIVE_URL>`, open every receipt link yourself, and edit the write-up until it sounds like you. **Mandatory: screenshots are a hard rule.** | You (I can tighten the prose after your pass) | 2 h | +10 (communication 3 → 5) | **~5** |

Also worth doing, below the top three:
- **Real-phone check** on iOS Safari and Android Chrome (15 min, you). The masked paper edges and `color-mix()` need Safari 16.2+.
- **Fix your own READMEs** (Supermarket "32 tools", Tiny Tale model name). The pinned receipts keep pointing at the old lines, so the corrections stay true either way (20 min, you).

## Fix log

| Date | Fix | What changed |
|---|---|---|
| Oct 28 | **2: first-impression polish** (done) | The hero stub hangs from a printer slot and prints itself the first time it scrolls into view: once per visitor, skipped with reduced motion, with an 8-second safety net. It's stamped "Printed for you at <local time>". The hint names the claim count. New 1200×630 link-preview image (`og.png`, rendered from `scripts/og/og.html`) with Open Graph and Twitter tags; the Amplify build writes their absolute URLs, and the site's own receipt gains a Domain line. |
| Oct 28 | **1: deploy** (done) | Created the public repo `MdIbuA/ibu-receipts` with the GitHub CLI and connected Amplify Hosting. Build #1 went live at https://main.d1nj3qfdmf673t.amplifyapp.com. Preview tags, domain, build number and size were all stamped correctly, but the commit printed as `HEAD`. The stamp script now resolves the real hash from the build's clone, and build #2 deploys that fix. |
| Oct 28 | **3: screenshots and voice** (in progress) | Website shots #8–14 captured from the live site with headless Chrome. The write-up now has the live URL, the real build story and GitHub-hosted images. Left for you: AWS shots #1–7, the budget check, clicking through every receipt, and a pass in your own voice. |

## Risks to watch through judging (until the week of Nov 23)

| Risk | Mitigation |
|---|---|
| "Never published before": the content overlaps my older GitHub Pages portfolio | New repo, new design, new code, new feature. The site doesn't link the old portfolio, and the repo's history starts this week. |
| The site goes down mid-judging | Static files on Amplify, no backend. Don't delete the app or turn on access control. The budget alert is set. |
| An evidence link breaks | All 19 evidence permalinks are pinned to commit SHAs. Don't delete or rename those repos until judging ends. |
| A late push breaks the build | Check that every push's build goes green. Amplify keeps serving the last good deploy if a build fails. |
