"""Tests for the Bedrock reader: what gets through from the model, and what never does."""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
import reader  # noqa: E402

DESCRIPTION = "Cloud Intern\nRequirements\n- Python and AWS Lambda\nNice to have:\n- Terraform is a plus\n- Great coffee"


class FakeBedrock:
    def __init__(self, requirements=None, error=None):
        self.requirements, self.error, self.calls = requirements, error, []

    def converse(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return {
            "output": {"message": {"content": [{"toolUse": {"toolUseId": "t1", "name": "itemize_requirements", "input": {"requirements": self.requirements}}}]}},
            "usage": {"inputTokens": 900, "outputTokens": 120},
        }


class ClientError(Exception):
    def __init__(self, code):
        super().__init__(code)
        self.response = {"Error": {"Code": code}}


def call(fake, text=DESCRIPTION):
    reader._client = fake
    return reader.handler({"body": json.dumps({"text": text})}, None)


class Validate(unittest.TestCase):
    def test_keeps_real_quotes_with_known_skills(self):
        kept, dropped = reader.validate([{"quote": "AWS Lambda", "priority": "must", "skill": "lambda"}], DESCRIPTION)
        self.assertEqual(kept, [{"quote": "AWS Lambda", "priority": "must", "skill": "lambda"}])
        self.assertEqual(dropped, 0)

    def test_drops_quotes_the_description_never_says(self):
        kept, dropped = reader.validate([{"quote": "10 years of Kubernetes", "priority": "must", "skill": "kubernetes"}], DESCRIPTION)
        self.assertEqual((kept, dropped), ([], 1))

    def test_drops_skills_that_are_not_on_the_map(self):
        kept, dropped = reader.validate([{"quote": "Python", "priority": "must", "skill": "cobol"}], DESCRIPTION)
        self.assertEqual((kept, dropped), ([], 1))

    def test_keeps_requirements_outside_the_map_without_a_skill(self):
        kept, _ = reader.validate([{"quote": "Great coffee", "priority": "nice", "skill": "none"}], DESCRIPTION)
        self.assertEqual(kept, [{"quote": "Great coffee", "priority": "nice", "skill": None}])

    def test_matches_quotes_ignoring_case_and_spacing(self):
        kept, _ = reader.validate([{"quote": "python  and aws lambda", "priority": "must", "skill": "python"}], DESCRIPTION)
        self.assertEqual(len(kept), 1)

    def test_one_line_per_skill_and_required_anywhere_wins(self):
        kept, _ = reader.validate([
            {"quote": "Terraform is a plus", "priority": "nice", "skill": "terraform"},
            {"quote": "Terraform", "priority": "must", "skill": "terraform"},
        ], DESCRIPTION)
        self.assertEqual([(k["skill"], k["priority"]) for k in kept], [("terraform", "must")])

    def test_defaults_an_unknown_priority_to_must(self):
        kept, _ = reader.validate([{"quote": "Python", "priority": "urgent", "skill": "python"}], DESCRIPTION)
        self.assertEqual(kept[0]["priority"], "must")

    def test_survives_garbage(self):
        for raw in (None, "text", [None, 3, {"quote": 5}], [{"skill": "python"}]):
            kept, _ = reader.validate(raw, DESCRIPTION)
            self.assertEqual(kept, [])


class Handler(unittest.TestCase):
    def test_returns_only_validated_requirements(self):
        fake = FakeBedrock([
            {"quote": "Python", "priority": "must", "skill": "python"},
            {"quote": "an invented requirement", "priority": "must", "skill": "java"},
        ])
        result = call(fake)
        body = json.loads(result["body"])
        self.assertEqual(result["statusCode"], 200)
        self.assertEqual([r["skill"] for r in body["requirements"]], ["python"])
        self.assertEqual(body["dropped"], 1)

    def test_always_sets_max_tokens_and_forces_the_tool(self):
        fake = FakeBedrock([])
        call(fake)
        sent = fake.calls[0]
        self.assertEqual(sent["inferenceConfig"]["maxTokens"], 1500)
        self.assertEqual(sent["toolConfig"]["toolChoice"], {"tool": {"name": "itemize_requirements"}})

    def test_rejects_empty_and_oversized_descriptions_without_calling_the_model(self):
        fake = FakeBedrock([])
        self.assertEqual(call(fake, "   ")["statusCode"], 400)
        self.assertEqual(call(fake, "x" * (reader.MAX_CHARS + 1))["statusCode"], 413)
        self.assertEqual(fake.calls, [])

    def test_reports_an_unavailable_model_without_leaking_the_error(self):
        result = call(FakeBedrock(error=ClientError("ValidationException")))
        self.assertEqual(result["statusCode"], 503)
        self.assertEqual(json.loads(result["body"]), {"error": "model-unavailable"})

    def test_reports_throttling_as_429(self):
        self.assertEqual(call(FakeBedrock(error=ClientError("ThrottlingException")))["statusCode"], 429)

    def test_catalog_ids_are_the_tool_schema_enum(self):
        enum = reader.TOOL_CONFIG["tools"][0]["toolSpec"]["inputSchema"]["json"]["properties"]["requirements"]["items"]["properties"]["skill"]["enum"]
        self.assertEqual(enum, reader.IDS + ["none"])


if __name__ == "__main__":
    unittest.main()
