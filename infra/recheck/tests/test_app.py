"""Tests for the re-check Lambda. Standard library only, and nothing here touches
the network or AWS: fetch and boto3 are replaced, so the tests pin down what the
Lambda does with an answer, not what GitHub says today.

    python3 -m unittest discover -s infra/recheck/tests
"""
import json
import sys
import types
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import app  # noqa: E402

PINNED = r"https://raw\.githubusercontent\.com/MdIbuA/[\w.-]+/[0-9a-f]{40}/.+"


def call(claim=None):
    """Invoke the handler the way API Gateway does, and decode its answer."""
    event = {"queryStringParameters": None if claim is None else {"id": claim}}
    response = app.handler(event, None)
    return response["statusCode"], json.loads(response["body"])


class CheckBuilders(unittest.TestCase):
    def test_contains_says_what_it_found(self):
        check = app.contains("MAX_TOOL_ROUNDS = 15")
        self.assertEqual(check("const MAX_TOOL_ROUNDS = 15;"), (True, "found “MAX_TOOL_ROUNDS = 15”"))
        self.assertEqual(check("const MAX_TOOL_ROUNDS = 20;"), (False, "“MAX_TOOL_ROUNDS = 15” is missing"))

    def test_count_passes_only_on_the_exact_number(self):
        check = app.count(r"^\s+\w+Schema,\s*$", 2, "tool schemas")
        self.assertEqual(check("  aSchema,\n  bSchema,\n"), (True, "counted 2 tool schemas"))
        self.assertEqual(check("  aSchema,\n"), (False, "counted 1 tool schemas"))
        self.assertEqual(check("  aSchema,\n  bSchema,\n  cSchema,\n"), (False, "counted 3 tool schemas"))

    def test_iam_read_only_wants_eleven_get_or_list_actions(self):
        policy = lambda actions: json.dumps({"Statement": [{"Action": actions[:1][0]}, {"Action": actions[1:]}]})
        reads = [f"s3:Get{n}" for n in range(6)] + [f"s3:List{n}" for n in range(5)]
        self.assertEqual(app.iam_read_only(policy(reads)), (True, "11 actions, all Get/List"))
        ok, detail = app.iam_read_only(policy(reads[:10] + ["s3:PutObject"]))
        self.assertFalse(ok)
        self.assertIn("not all read-only", detail)
        self.assertFalse(app.iam_read_only(policy(reads[:10]))[0], "a different number of actions is a different policy")

    def test_no_runtime_dependencies_wants_an_empty_object(self):
        self.assertTrue(app.no_runtime_dependencies('{"dependencies": {}}')[0])
        self.assertFalse(app.no_runtime_dependencies('{"dependencies": {"left-pad": "1.0.0"}}')[0])
        self.assertFalse(app.no_runtime_dependencies('{"name": "x"}')[0], "a missing field proves nothing")


class CheckList(unittest.TestCase):
    def test_only_pinned_commits_and_the_one_article_are_ever_fetched(self):
        for claim, specs in app.CHECKS.items():
            if specs == "amplify":
                continue
            self.assertTrue(specs, f"{claim} has no checks")
            for label, url, test in specs:
                self.assertTrue(label.strip(), f"{claim}: a check has no label")
                self.assertTrue(callable(test), f"{claim}: {label}")
                if url != app.DOCUMIND_ARTICLE:
                    self.assertRegex(url, PINNED, f"{claim}: {label} isn't pinned to a commit")

    def test_only_the_page_s_own_receipt_asks_amplify(self):
        self.assertEqual([claim for claim, specs in app.CHECKS.items() if specs == "amplify"], ["site"])

    def test_human_url_turns_a_raw_file_into_the_page_a_person_can_read(self):
        sha = "0" * 40
        self.assertEqual(app.human_url(f"https://raw.githubusercontent.com/MdIbuA/GitBard/{sha}/template.yaml"),
                         f"https://github.com/MdIbuA/GitBard/blob/{sha}/template.yaml")
        self.assertEqual(app.human_url(app.DOCUMIND_ARTICLE), app.DOCUMIND_ARTICLE)


class RunningChecks(unittest.TestCase):
    def test_overall_fails_on_any_failure_and_is_unknown_if_anything_couldn_t_run(self):
        row = lambda ok: {"ok": ok}
        self.assertIs(app.overall([row(True), row(True)]), True)
        self.assertIs(app.overall([row(True), row(None)]), None)
        self.assertIs(app.overall([row(None), row(False)]), False)

    def test_each_url_is_fetched_once_however_many_checks_read_it(self):
        specs = [("a", "https://example.test/one", app.contains("x")),
                 ("b", "https://example.test/one", app.contains("y")),
                 ("c", "https://example.test/two", app.contains("x"))]
        with mock.patch.object(app, "fetch", return_value="x") as fetch:
            result = app.check_claim(specs)
        self.assertEqual(fetch.call_count, 2)
        self.assertEqual([row["ok"] for row in result["checks"]], [True, False, True])
        self.assertIs(result["ok"], False)

    def test_network_trouble_is_couldn_t_check_never_failed(self):
        with mock.patch.object(app, "fetch", side_effect=TimeoutError()):
            result = app.check_claim([("a", "https://example.test/one", app.contains("x"))])
        self.assertIs(result["ok"], None)
        self.assertIs(result["checks"][0]["ok"], None)
        self.assertIn("couldn't check right now", result["checks"][0]["detail"])


class AskingAmplify(unittest.TestCase):
    def ask(self, jobs):
        client = mock.Mock()
        client.list_jobs.return_value = {"jobSummaries": jobs}
        boto3 = types.SimpleNamespace(client=mock.Mock(return_value=client))
        env = {"AMPLIFY_APP_ID": "d0000000000000", "AMPLIFY_BRANCH": "main"}
        with mock.patch.dict(sys.modules, {"boto3": boto3}), mock.patch.dict(app.os.environ, env):
            return app.check_site(), client

    def test_reports_the_latest_successful_build(self):
        ended = datetime(2026, 11, 1, 10, 0, tzinfo=timezone.utc)
        result, client = self.ask([
            {"jobId": "9", "status": "SUCCEED", "commitId": "a" * 40},
            {"jobId": "12", "status": "SUCCEED", "commitId": "3d38dbb" + "0" * 33, "endTime": ended},
            {"jobId": "13", "status": "FAILED", "commitId": "b" * 40},
        ])
        client.list_jobs.assert_called_once_with(appId="d0000000000000", branchName="main", maxResults=25)
        self.assertIs(result["ok"], True)
        self.assertEqual(result["live"], {"job": 12, "commit": "3d38dbb" + "0" * 33, "endedAt": ended.isoformat()})
        self.assertEqual(result["checks"][0]["detail"], "build #12 · commit 3d38dbb")

    def test_a_console_build_that_recorded_head_has_no_commit(self):
        result, _ = self.ask([{"jobId": "1", "status": "SUCCEED", "commitId": "HEAD"}])
        self.assertEqual(result["live"]["commit"], "")
        self.assertIn("commit not recorded by Amplify", result["checks"][0]["detail"])

    def test_no_successful_build_fails(self):
        result, _ = self.ask([{"jobId": "1", "status": "FAILED", "commitId": "a" * 40}])
        self.assertIs(result["ok"], False)

    def test_an_aws_error_is_couldn_t_ask_never_failed(self):
        with mock.patch.dict(sys.modules, {"boto3": None}):  # the import itself fails
            result = app.check_site()
        self.assertIs(result["ok"], None)
        self.assertIn("couldn't ask Amplify", result["checks"][0]["detail"])


class Handler(unittest.TestCase):
    def setUp(self):
        app._cache.clear()
        quiet = mock.patch("builtins.print")  # the handler logs every run to CloudWatch
        self.log = quiet.start()
        self.addCleanup(quiet.stop)

    def test_an_unknown_or_missing_claim_is_a_404_that_fetches_nothing(self):
        with mock.patch.object(app, "fetch") as fetch:
            for claim in (None, "", "nope", "../site"):
                status, body = call(claim)
                self.assertEqual(status, 404)
                self.assertEqual(body["known"], sorted(app.CHECKS))
        fetch.assert_not_called()

    def test_a_claim_s_checks_run_and_are_logged(self):
        with mock.patch.object(app, "fetch", return_value="Schedule: cron(0 16 ? * FRI *)\nDefault: \"amazon.nova-micro-v1:0\""):
            status, body = call(" gitbard ")
        self.assertEqual(status, 200)
        self.assertEqual(body["id"], "gitbard")
        self.assertIs(body["ok"], True)
        self.assertIs(body["cached"], False)
        self.assertEqual(len(body["checks"]), len(app.CHECKS["gitbard"]))
        self.assertTrue(datetime.fromisoformat(body["checkedAt"]).tzinfo, "checkedAt carries its time zone")
        logged = json.loads(self.log.call_args.args[0])
        self.assertEqual((logged["claim"], logged["ok"]), ("gitbard", True))

    def test_pinned_evidence_is_cached_for_five_minutes(self):
        with mock.patch.object(app, "fetch", return_value="nothing here") as fetch:
            _, first = call("gitbard")
            fetched = fetch.call_count
            _, second = call("gitbard")
            self.assertEqual(fetch.call_count, fetched, "the second answer came from the cache")
            self.assertIs(second["cached"], True)
            self.assertEqual(second["checkedAt"], first["checkedAt"])
            with mock.patch.object(app.time, "time", return_value=app.time.time() + app.CACHE_SECONDS + 1):
                _, third = call("gitbard")
            self.assertIs(third["cached"], False)

    def test_a_check_that_couldn_t_run_is_never_cached(self):
        with mock.patch.object(app, "fetch", side_effect=TimeoutError()):
            _, first = call("gitbard")
        self.assertIs(first["ok"], None)
        self.assertNotIn("gitbard", app._cache)
        # GitHub answers again: the very next click gets a real result, not the hiccup.
        with mock.patch.object(app, "fetch", return_value="Schedule: cron(0 16 ? * FRI *)\nDefault: \"amazon.nova-micro-v1:0\""):
            _, second = call("gitbard")
        self.assertIs(second["cached"], False)
        self.assertIs(second["ok"], True)

    def test_a_failed_check_is_cached_like_a_passed_one(self):
        with mock.patch.object(app, "fetch", return_value="nothing here"):
            _, first = call("gitbard")
            _, second = call("gitbard")
        self.assertIs(first["ok"], False)
        self.assertIs(second["cached"], True)

    def test_what_s_live_is_never_cached(self):
        answer = {"ok": True, "checks": []}
        with mock.patch.object(app, "check_site", return_value=answer) as check_site:
            call("site")
            _, second = call("site")
        self.assertEqual(check_site.call_count, 2)
        self.assertIs(second["cached"], False)

    def test_answers_are_json_that_no_browser_or_proxy_may_keep(self):
        response = app.handler({"queryStringParameters": {"id": "nope"}}, None)
        self.assertEqual(response["headers"]["cache-control"], "no-store")
        self.assertTrue(response["headers"]["content-type"].startswith("application/json"))


if __name__ == "__main__":
    unittest.main()
