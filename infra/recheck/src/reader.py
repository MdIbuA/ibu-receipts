"""
Reads a job description with Amazon Nova Micro on Bedrock and itemizes its
requirements against the portfolio's skill map (skill_catalog.json, generated
from src/feature/receipts/skills.ts).

The model only classifies. For each requirement it may quote the description and
pick one skill id from the catalog; nothing else gets through. A quote that isn't
in the description, or an id that isn't in the catalog, is dropped, so the model
can't invent a requirement or a skill. The page then prints only proof it already
holds. The description itself is never logged or stored.
"""
import base64
import json
import os
import re
import time

MODEL_ID = os.environ.get("MODEL_ID", "us.amazon.nova-micro-v1:0")
MAX_CHARS = 8000
MAX_ITEMS = 40

with open(os.path.join(os.path.dirname(__file__), "skill_catalog.json"), encoding="utf-8") as f:
    CATALOG = json.load(f)
IDS = [skill["id"] for skill in CATALOG]
KNOWN = set(IDS)

SYSTEM = (
    "You read job descriptions for a portfolio that prints a receipt of what its owner can prove. "
    "You only classify. You never judge the candidate and never invent anything.\n"
    "For each requirement in the description that names a skill, tool, technology, practice or kind of experience, record:\n"
    "- quote: the requirement's words copied exactly as they appear in the description (2 to 12 words)\n"
    "- priority: \"nice\" if the description marks it optional (under a heading such as Nice to have, Preferred or Bonus, "
    "or with words such as \"is a plus\" or \"ideally\"), otherwise \"must\"\n"
    "- skill: the id of the one catalog skill it asks for, or \"none\" if no catalog skill fits\n"
    "Skip perks, benefits, salary, location, company background, and soft skills that match no catalog skill. "
    "Never add a requirement that is not in the description. Use each catalog id at most once.\n"
    "Catalog (id: label):\n" + "\n".join(f"{s['id']}: {s['label']}" for s in CATALOG)
)

TOOL_CONFIG = {
    "tools": [{
        "toolSpec": {
            "name": "itemize_requirements",
            "description": "Record every requirement in the job description, each matched to at most one catalog skill.",
            "inputSchema": {"json": {
                "type": "object",
                "properties": {
                    "requirements": {
                        "type": "array",
                        "maxItems": MAX_ITEMS,
                        "items": {
                            "type": "object",
                            "properties": {
                                "quote": {"type": "string"},
                                "priority": {"type": "string", "enum": ["must", "nice"]},
                                "skill": {"type": "string", "enum": IDS + ["none"]},
                            },
                            "required": ["quote", "priority", "skill"],
                        },
                    }
                },
                "required": ["requirements"],
            }},
        }
    }],
    # Forcing the tool makes the answer structured data, never prose.
    "toolChoice": {"tool": {"name": "itemize_requirements"}},
}

_client = None


def bedrock():
    """The Bedrock runtime client, created once per container (imported lazily so tests need no boto3)."""
    global _client
    if _client is None:
        import boto3
        from botocore.config import Config
        _client = boto3.client(
            "bedrock-runtime",
            config=Config(retries={"max_attempts": 2, "mode": "adaptive"}, connect_timeout=3, read_timeout=15),
        )
    return _client


def squash(text):
    return re.sub(r"\s+", " ", text).strip().lower()


def validate(raw, description):
    """Keep only what the description really says and the catalog really holds."""
    haystack = squash(description)
    kept, index, dropped = [], {}, 0
    for item in raw if isinstance(raw, list) else []:
        if not isinstance(item, dict):
            dropped += 1
            continue
        quote = item.get("quote")
        skill = item.get("skill")
        priority = item.get("priority") if item.get("priority") in ("must", "nice") else "must"
        if not isinstance(quote, str) or not 1 <= len(quote.strip()) <= 160 or squash(quote) not in haystack:
            dropped += 1  # the model may only quote the description
            continue
        if skill in (None, "", "none"):
            skill = None
        elif skill not in KNOWN:
            dropped += 1  # and only name skills on the map
            continue
        key = skill or squash(quote)
        if key in index:
            if priority == "must":
                kept[index[key]]["priority"] = "must"  # required anywhere means required
            continue
        index[key] = len(kept)
        kept.append({"quote": quote.strip(), "priority": priority, "skill": skill})
        if len(kept) >= MAX_ITEMS:
            break
    return kept, dropped


def respond(status, body):
    return {
        "statusCode": status,
        "headers": {"content-type": "application/json", "cache-control": "no-store"},
        "body": json.dumps(body),
    }


def handler(event, context):
    started = time.time()
    try:
        raw_body = event.get("body") or ""
        if event.get("isBase64Encoded"):
            raw_body = base64.b64decode(raw_body).decode("utf-8")
        body = json.loads(raw_body or "{}")
    except (ValueError, UnicodeDecodeError):
        return respond(400, {"error": "bad-json"})
    text = body.get("text") if isinstance(body, dict) else None
    if not isinstance(text, str) or not text.strip():
        return respond(400, {"error": "empty"})
    if len(text) > MAX_CHARS:
        return respond(413, {"error": "too-long", "max": MAX_CHARS})

    try:
        response = bedrock().converse(
            modelId=MODEL_ID,
            system=[{"text": SYSTEM}],
            messages=[{"role": "user", "content": [{"text": f"Job description:\n<<<\n{text}\n>>>"}]}],
            toolConfig=TOOL_CONFIG,
            inferenceConfig={"maxTokens": 1500, "temperature": 0},
        )
    except Exception as error:  # botocore ClientError and friends; logged by code, never with the text
        code = getattr(error, "response", {}).get("Error", {}).get("Code", type(error).__name__)
        print(json.dumps({"error": code, "ms": int((time.time() - started) * 1000)}))
        return respond(429 if code == "ThrottlingException" else 503, {"error": "model-unavailable"})

    blocks = response.get("output", {}).get("message", {}).get("content", [])
    tool_input = next((b["toolUse"].get("input", {}) for b in blocks if "toolUse" in b), {})
    items, dropped = validate(tool_input.get("requirements") if isinstance(tool_input, dict) else None, text)
    usage = response.get("usage", {})
    ms = int((time.time() - started) * 1000)
    # One line per reading: counts and timing only, never the description.
    print(json.dumps({"read": len(items), "dropped": dropped, "ms": ms, "in": usage.get("inputTokens"), "out": usage.get("outputTokens")}))
    return respond(200, {"model": "Amazon Nova Micro", "modelId": MODEL_ID, "requirements": items, "dropped": dropped, "ms": ms})
