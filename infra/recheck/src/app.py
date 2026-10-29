"""Re-check this receipt.

GET /recheck?id=<claim-id> fetches the evidence behind one portfolio claim from GitHub,
at the exact commit the receipt cites, and checks it again right now. For the page's own
receipt it asks the AWS Amplify API which build is live.

Only the URLs listed in CHECKS are ever fetched, so the endpoint can't be aimed anywhere
else. Results are cached for five minutes per claim, and every check run is logged to
CloudWatch, which makes the logs an audit trail.
"""
import json
import os
import re
import time
import urllib.request
from datetime import datetime, timezone

CACHE_SECONDS = 300
_cache = {}


def pinned(repo, sha, path):
    return f"https://raw.githubusercontent.com/MdIbuA/{repo}/{sha}/{path}"


SHA = {
    "CryptoPulse": "0bde245a9a8f1f7aec31d8ae4467b865871a0a2f",
    "SuperMarketAgent": "fcf311e17c8ed933b2d4b7608feb44d274af2a34",
    "DocuMind-AI": "04473d196c96482e0c87189ad2749b5ad02bb3f0",
    "strands-tripwire": "9f0559ff2898979d43f48c28140248556c281837",
    "s3-ghost-probe": "2a18b3f4496d4223a087e33471144375d15a07e0",
    "GitBard": "79c750e69e4e2314befa351c515c4466ebfede29",
    "votersaathi": "8594c62338df5004c39b7dca56ff388e2a6b5eef",
    "Celebrai": "18078d1e71b2a54d6f5d4acaadad8df0af9b0976",
    "tiny-tale-toy": "bf82c2ddfba3ead7817d731883d68585ca042d74",
    "MdIbuA": "c1279fde3e9d71a50f186c5190af9f744682a1f4",
}


def src(repo, path):
    return pinned(repo, SHA[repo], path)


DOCUMIND_ARTICLE = "https://builder.aws.com/content/3IXxyXBIA0XvQy27nJLaev2clbM/weekend-showcase-challenge-documind-ai"

# ---------- check builders: each returns (ok, detail) for a fetched body ----------


def contains(text):
    def check(body):
        found = text in body
        return found, (f"found “{text}”" if found else f"“{text}” is missing")
    return check


def count(pattern, expected, noun):
    rx = re.compile(pattern, re.M)

    def check(body):
        n = len(rx.findall(body))
        return n == expected, f"counted {n} {noun}"
    return check


def iam_read_only(body):
    statements = json.loads(body)["Statement"]
    actions = []
    for st in statements:
        actions += st["Action"] if isinstance(st["Action"], list) else [st["Action"]]
    read_only = all(a.startswith(("s3:Get", "s3:List")) for a in actions)
    return read_only and len(actions) == 11, f"{len(actions)} actions, {'all Get/List' if read_only else 'not all read-only'}"


def no_runtime_dependencies(body):
    deps = json.loads(body).get("dependencies")
    return deps == {}, f"dependencies: {json.dumps(deps)}"


CHECKS = {
    "cryptopulse": [
        ("R² 0.9402 and 47.93% direction in the notebook output", src("CryptoPulse", "milestone%202/bitcoin-infy.ipynb"), contains("R²: 0.9402 | Direction Accuracy: 47.93%")),
        ("The LSTM cell splits 70/30, in time order", src("CryptoPulse", "milestone%202/bitcoin-infy.ipynb"), contains("train_size = int(len(X_all) * 0.7)")),
    ],
    "supermarket": [
        ("ALL_TOOLS holds 30 tool schemas", src("SuperMarketAgent", "src/tools/registry.ts"), count(r"^\s+\w+Tools\.\w+Schema,\s*$", 30, "tool schemas")),
        ("At most 15 tool rounds per message", src("SuperMarketAgent", "src/agent/runtime.ts"), contains("const MAX_TOOL_ROUNDS = 15;")),
        ("Money is stored as integer paise", src("SuperMarketAgent", "prisma/schema.prisma"), contains("stored as integers (paise)")),
        ("The README still says 32 (the correction stands)", src("SuperMarketAgent", "README.md"), contains("Tool Registry - 32 tools")),
    ],
    "documind": [
        ("Q&A reads at most 12,000 characters", src("DocuMind-AI", "backend/lambda_function.py"), contains("truncate_for_context(text, max_chars=12000)")),
        ("Built for the Aug 28–31, 2026 challenge", src("DocuMind-AI", "README.md"), contains("(Aug 28–31, 2026)")),
        ("The write-up is live on AWS Builder Center", DOCUMIND_ARTICLE, contains("DocuMind")),
    ],
    "tripwire": [
        ("Guard decides in a median 233 ms offline", src("strands-tripwire", "README.md"), contains("**233 ms**")),
        ("Quarantine decides in a median 212 ms offline", src("strands-tripwire", "README.md"), contains("**212 ms**")),
        ("0 of 10 attacks got through with Tripwire", src("strands-tripwire", "README.md"), contains("**0%** (0/10)")),
        ("End to end it's 341 ms (the catch)", src("strands-tripwire", "README.md"), contains("**341 ms**")),
    ],
    "ghostprobe": [
        ("The IAM policy is read-only", src("s3-ghost-probe", "docs/s3_probe_iam_policy.json"), iam_read_only),
        ("The verdict flips to INCOMPLETE", src("s3-ghost-probe", "README.md"), contains("| Verdict on case_25 | COMPLETE | **INCOMPLETE** |")),
        ("2 hidden copies found", src("s3-ghost-probe", "README.md"), contains("2 recoverable files")),
    ],
    "gitbard": [
        ("EventBridge fires Fridays at 16:00 UTC", src("GitBard", "template.yaml"), contains("Schedule: cron(0 16 ? * FRI *)")),
        ("The storyteller is Amazon Nova Micro", src("GitBard", "template.yaml"), contains('Default: "amazon.nova-micro-v1:0"')),
    ],
    "votersaathi": [
        ("12 languages in the README table", src("votersaathi", "README.md"), count(r"^\| .+ \| `[a-z]{2}` \| .+ \|\s*$", 12, "languages")),
        ("Only English is hand-written", src("votersaathi", "README.md"), contains("**All other languages** → Gemini AI generates responses")),
    ],
    "celebrai": [
        ("Zero runtime dependencies", src("Celebrai", "package.json"), no_runtime_dependencies),
        ("86 tests passed, 0 failed", src("Celebrai", "README.md"), contains("86 passed, 0 failed")),
    ],
    "tinytale": [
        ("The default model in code is Ministral 3 8B", src("tiny-tale-toy", "backend/lambda_function.py"), contains('"mistral.ministral-3-8b-instruct"')),
        ("The defensive JSON parser is there", src("tiny-tale-toy", "backend/lambda_function.py"), contains("Safely parse JSON from model output")),
        ("The README still says Nova Lite (the correction stands)", src("tiny-tale-toy", "README.md"), contains("(Nova Lite)")),
    ],
    "roles": [
        ("Author on AWS Builder Center: the DocuMind article is live", DOCUMIND_ARTICLE, contains("DocuMind")),
    ],
    "internships": [
        ("Infosys Springboard, Batch 5, in the CryptoPulse README", src("CryptoPulse", "README.md"), contains("Infosys Springboard - Batch 5")),
    ],
    "hackerrank": [
        ("Ghost Probe audits the October round's dataset", src("s3-ghost-probe", "README.md"), contains("hackerrank-orchestrate-october26")),
    ],
    "qiskit": [
        ("The self-report is on my GitHub profile README", src("MdIbuA", "README.md"), contains("IBM Qiskit Fall Fest")),
    ],
    "site": "amplify",
}

# ---------- running checks ----------


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "ibu-receipts-recheck"})
    with urllib.request.urlopen(request, timeout=5) as response:
        return response.read(3_000_000).decode("utf-8")


def human_url(url):
    """raw.githubusercontent.com/<owner>/<repo>/<sha>/<path> -> the GitHub page a person can read."""
    m = re.match(r"https://raw\.githubusercontent\.com/([^/]+)/([^/]+)/([0-9a-f]{40})/(.+)", url)
    return f"https://github.com/{m[1]}/{m[2]}/blob/{m[3]}/{m[4]}" if m else url


def overall(rows):
    if any(r["ok"] is False for r in rows):
        return False
    if any(r["ok"] is None for r in rows):
        return None
    return True


def check_claim(specs):
    bodies, rows = {}, []
    for label, url, test in specs:
        try:
            if url not in bodies:
                bodies[url] = fetch(url)
            ok, detail = test(bodies[url])
        except Exception as exc:  # network trouble is "couldn't check", never "failed"
            ok, detail = None, f"couldn't check right now ({type(exc).__name__})"
        rows.append({"label": label, "ok": ok, "detail": detail, "url": human_url(url)})
    return {"ok": overall(rows), "checks": rows}


def check_site():
    label = "AWS Amplify API: the latest successful build on main"
    try:
        import boto3  # bundled in the Lambda Python runtime

        amplify = boto3.client("amplify", region_name=os.environ.get("AMPLIFY_REGION") or None)
        jobs = amplify.list_jobs(
            appId=os.environ["AMPLIFY_APP_ID"],
            branchName=os.environ.get("AMPLIFY_BRANCH", "main"),
            maxResults=25,
        )["jobSummaries"]
        done = sorted((j for j in jobs if j["status"] == "SUCCEED"), key=lambda j: int(j["jobId"]), reverse=True)
        if not done:
            return {"ok": False, "checks": [{"label": label, "ok": False, "detail": "no successful build found", "url": None}]}
        latest = done[0]
        live = {
            "job": int(latest["jobId"]),
            "commit": latest.get("commitId", ""),
            "endedAt": latest["endTime"].isoformat() if latest.get("endTime") else None,
        }
        detail = f"build #{live['job']} · commit {live['commit'][:7]}"
        return {"ok": True, "live": live, "checks": [{"label": label, "ok": True, "detail": detail, "url": None}]}
    except Exception as exc:
        return {"ok": None, "checks": [{"label": label, "ok": None, "detail": f"couldn't ask Amplify ({type(exc).__name__})", "url": None}]}


def respond(status, body):
    return {
        "statusCode": status,
        "headers": {"content-type": "application/json; charset=utf-8", "cache-control": "no-store"},
        "body": json.dumps(body, ensure_ascii=False),
    }


def handler(event, context):
    claim = ((event or {}).get("queryStringParameters") or {}).get("id", "").strip()
    if claim not in CHECKS:
        return respond(404, {"error": "unknown claim", "known": sorted(CHECKS)})

    hit = _cache.get(claim)
    if hit and time.time() - hit[0] < CACHE_SECONDS:
        return respond(200, {**hit[1], "cached": True})

    started = time.time()
    result = check_site() if CHECKS[claim] == "amplify" else check_claim(CHECKS[claim])
    payload = {
        "id": claim,
        "checkedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "ms": int((time.time() - started) * 1000),
        "cached": False,
        **result,
    }
    _cache[claim] = (time.time(), payload)
    print(json.dumps({"claim": claim, "ok": payload["ok"], "ms": payload["ms"]}))
    return respond(200, payload)
