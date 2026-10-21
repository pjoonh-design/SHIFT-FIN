"""수집 스크립트 파서 테스트: python3 -m unittest discover -s scripts/tests
fixtures/ 의 값은 각 API 응답 형식을 본뜬 시험용 예시다(실제 시세 아님)."""
import json
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import fetch_ecos  # noqa: E402
import fetch_finlife  # noqa: E402
import fetch_fred  # noqa: E402
import fetch_news  # noqa: E402
import common  # noqa: E402
import make_briefing  # noqa: E402
import run_all  # noqa: E402
from common import FetchError  # noqa: E402


def fx(name, binary=False):
    with open(os.path.join(HERE, "fixtures", name), "rb" if binary else "r", encoding=None if binary else "utf-8") as f:
        return f.read() if binary else json.load(f)


class Ecos(unittest.TestCase):
    def test_keystats_by_name(self):
        items = {i["key"]: i for i in fetch_ecos.parse_keystats(fx("ecos_keystat.json"))}
        self.assertEqual(items["baseRate"]["value"], 2.5)
        self.assertEqual(items["baseRate"]["time"], "2026-10-20")
        self.assertEqual(items["usdkrw"]["value"], 1385.2)          # 쉼표 처리
        self.assertEqual(items["gdp"]["time"], "2026-Q2")
        self.assertEqual(items["ktb3"]["value"], 2.61)
        self.assertNotIn("unemployment", items)                      # 없는 지표는 건너뜀

    def test_error_payload(self):
        with self.assertRaises(FetchError):
            fetch_ecos.parse_keystats(fx("ecos_error.json"))

    def test_cpi_yoy(self):
        cpi = fetch_ecos.parse_cpi(fx("ecos_cpi.json"))
        self.assertEqual(cpi["month"], "2026-09")
        self.assertEqual(cpi["yoy"], round((118.1 / 115.7 - 1) * 100, 1))


    def test_bank_rate_latest_month(self):
        t, v = fetch_ecos.parse_latest(fx("ecos_bankrate.json"))   # 순서가 섞여 있어도 최신 달
        self.assertEqual((t, v), ("202608", 2.61))
        self.assertEqual(fetch_ecos.fmt_time(t), "2026-08")

    def test_bank_rate_no_data(self):
        with self.assertRaises(FetchError):
            fetch_ecos.parse_latest(fx("ecos_error.json"))


class Fred(unittest.TestCase):
    def test_latest_and_previous_skip_holiday(self):
        p = fetch_fred.parse_observations(fx("fred_sp500.json"))
        self.assertEqual(p["date"], "2026-10-20")
        self.assertEqual(p["prevDate"], "2026-10-16")
        self.assertAlmostEqual(p["change"], 23.45)
        self.assertEqual(p["changePct"], round((6123.45 / 6100 - 1) * 100, 2))

    def test_error(self):
        with self.assertRaises(FetchError):
            fetch_fred.parse_observations(fx("fred_error.json"))


class Finlife(unittest.TestCase):
    def test_top_open_products_12m(self):
        items = fetch_finlife.parse_products(fx("finlife_deposit.json"))
        self.assertEqual([i["bank"] for i in items], ["마바은행", "가나은행"])   # 가입 제한 상품 제외, 금리순
        self.assertEqual(items[0]["rate"], 3.1)
        self.assertEqual(items[0]["maxRate"], 3.1)                              # 우대금리 없으면 기본금리
        self.assertTrue(all(i["term"] == 12 for i in items))


    def test_clean_names(self):
        self.assertEqual(fetch_finlife.clean("주식회사 케이뱅크"), "케이뱅크")
        self.assertEqual(fetch_finlife.clean("토스뱅크 주식회사"), "토스뱅크")
        self.assertEqual(fetch_finlife.clean("JB 다이렉트예금통장\n(만기일시지급식)"), "JB 다이렉트예금통장 (만기일시지급식)")

    def test_merge_pages(self):
        page = fx("finlife_deposit.json")
        page2 = json.loads(json.dumps(page))
        for b in page2["result"]["baseList"]:
            b["fin_prdt_cd"] += "-P2"
        for o in page2["result"]["optionList"]:
            o["fin_prdt_cd"] += "-P2"
        merged = fetch_finlife.merge_pages([page, page2])
        self.assertEqual(len(merged["result"]["baseList"]), 2 * len(page["result"]["baseList"]))
        self.assertEqual(len(fetch_finlife.parse_products(merged, top=10)), 4)   # 페이지마다 가입 가능 2개

    def test_error_page(self):
        with self.assertRaises(FetchError):
            fetch_finlife.merge_pages([{"result": {"err_cd": "100", "err_msg": "auth 누락"}}])


class RunAll(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.old_dir, common.LIVE_DIR = common.LIVE_DIR, self.tmp.name
        os.environ["FINLIFE_API_KEY"] = "SECRET-KEY-123"

    def tearDown(self):
        common.LIVE_DIR = self.old_dir
        os.environ.pop("FINLIFE_API_KEY", None)
        self.tmp.cleanup()

    def test_unexpected_error_is_recorded_without_key(self):
        def boom(key):
            raise RuntimeError(f"connection reset while calling ?auth={key}")
        msg = run_all.run_one("rates.json", "FINLIFE_API_KEY", boom)
        self.assertIn("실패", msg)
        saved = common.read_live("rates.json")
        self.assertTrue(saved["stale"])
        self.assertNotIn("SECRET-KEY-123", saved["lastError"])          # 키는 가린다
        self.assertIn("RuntimeError", saved["lastError"])
        self.assertEqual(saved["message"], "연결 실패, 다음 수집 때 다시 시도")

    def test_previous_ok_data_is_kept(self):
        common.write_live("rates.json", {"status": "ok", "deposit": [1]})
        run_all.run_one("rates.json", "FINLIFE_API_KEY", lambda k: (_ for _ in ()).throw(FetchError("시간 초과")))
        saved = common.read_live("rates.json")
        self.assertEqual(saved["status"], "ok")
        self.assertEqual(saved["deposit"], [1])
        self.assertTrue(saved["stale"])


class News(unittest.TestCase):
    def test_rss(self):
        items = fetch_news.parse_rss(fx("news_rss.xml", binary=True), "미국 증시")
        self.assertEqual(items[0]["title"], "뉴욕증시 기술주 강세 마감")         # " - 출처" 제거
        self.assertEqual(items[0]["source"], "가나일보")
        self.assertTrue(items[0]["published"].startswith("2026-10-20T21:10"))


class Briefing(unittest.TestCase):
    def setUp(self):
        self.us = {"items": [dict(id="SP500", name="S&P 500", unit="", **fetch_fred.parse_observations(fx("fred_sp500.json")))]}
        self.macro = {"items": fetch_ecos.parse_keystats(fx("ecos_keystat.json")), "cpi": fetch_ecos.parse_cpi(fx("ecos_cpi.json"))}
        self.news = {"items": fetch_news.parse_rss(fx("news_rss.xml", binary=True), "미국 증시")}

    def test_template_without_key(self):
        b = make_briefing.build(self.us, self.macro, self.news, key=None)
        self.assertEqual(b["mode"], "template")
        self.assertTrue(1 <= len(b["lines"]) <= 3)
        self.assertIn("6,123.45", b["lines"][0])
        self.assertIn("원/달러 1,385.2원", b["lines"][1])

    def test_number_validation(self):
        _, allowed = make_briefing.collect_facts(self.us, self.macro, self.news)
        self.assertTrue(make_briefing.numbers_ok("S&P 500이 0.38% 올라 6,123.45에 마감했어요", allowed))
        self.assertTrue(make_briefing.numbers_ok("2026-10-20 마감 기준 6,123", allowed))
        self.assertFalse(make_briefing.numbers_ok("S&P 500이 1.5% 급등했어요", allowed))   # 없는 숫자

    def test_no_data(self):
        with self.assertRaises(FetchError):
            make_briefing.build(None, None, None)

    def test_response_text_skips_thoughts(self):
        res = {"candidates": [{"content": {"parts": [{"text": "생각 중...", "thought": True}, {"text": "첫 줄\n둘째 줄"}]}}]}
        self.assertEqual(make_briefing.response_text(res), "첫 줄\n둘째 줄")
        with self.assertRaises(FetchError):   # 생각만 하다 끝난 응답
            make_briefing.response_text({"candidates": [{"content": {"role": "model"}, "finishReason": "MAX_TOKENS"}]})

    def test_ai_falls_through_models_and_never_crashes(self):
        calls = []
        good = {"candidates": [{"content": {"parts": [{"text": "S&P 500이 0.38% 올랐어요\n원/달러 1,385.2원이에요\n뉴욕증시 기술주 강세 소식을 보세요"}]}}]}

        def fake_post(url, payload, headers=None, timeout=60):
            calls.append(url.split("/models/")[1].split(":")[0])
            self.assertNotIn("temperature", payload["generationConfig"])   # 2026년 모델에서 폐지
            if len(calls) == 1:
                raise RuntimeError("예상 못 한 오류")
            if len(calls) == 2:
                raise FetchError("POST 404", reason="HTTP 404")
            return good
        orig, make_briefing.http_post_json = make_briefing.http_post_json, fake_post
        try:
            b = make_briefing.build(self.us, self.macro, self.news, key="k")
            self.assertEqual(b["mode"], "ai")
            self.assertEqual(b["model"], make_briefing.MODELS[2])
            make_briefing.http_post_json = lambda *a, **k: (_ for _ in ()).throw(TimeoutError("read timed out"))
            b = make_briefing.build(self.us, self.macro, self.news, key="k")
            self.assertEqual(b["mode"], "template")                   # 전부 실패해도 숫자 요약
            self.assertIn("TimeoutError", b["note"])
        finally:
            make_briefing.http_post_json = orig

    def test_spelled_out_numbers_are_rejected(self):
        for bad in ("기준금리가 삼 퍼센트로 유지돼요", "환율은 일천삼백이십원대 초반이에요", "금리가 3프로예요"):
            self.assertTrue(make_briefing.spelled_numbers(bad), bad)
        for good in ("원/달러 1,325.2원이에요", "월 50만원을 모아요", "프로그램 매매가 늘었어요", "코스피는 5,552.74예요"):
            self.assertFalse(make_briefing.spelled_numbers(good), good)

    def test_lines_need_numbers_from_data(self):
        _, allowed = make_briefing.collect_facts(self.us, self.macro, self.news)
        ok, _ = make_briefing.lines_ok(["S&P 500이 0.38% 올랐어요", "원/달러 1,385.2원이에요", "뉴스를 보세요"], allowed, True)
        self.assertTrue(ok)
        ok, why = make_briefing.lines_ok(["미국 증시가 올랐어요", "원/달러 1,385.2원이에요", "뉴스를 보세요"], allowed, True)
        self.assertEqual((ok, why), (False, "숫자 없음"))
        ok, why = make_briefing.lines_ok(["S&P 500이 0.38% 올랐어요", "기준금리는 삼 퍼센트예요", "뉴스"], allowed, True)
        self.assertEqual((ok, why), (False, "숫자를 한글로 씀"))

    def test_index_unit_is_dropped_from_facts(self):
        macro = {"items": [{"key": "kospi", "name": "코스피", "value": 5552.74, "unit": "1980.01.04=100", "time": "2026-10-20"}]}
        facts, _ = make_briefing.collect_facts(None, macro, None)
        self.assertEqual(facts[0], "코스피: 5,552.74 (2026-10-20)")

    def test_bank_rates_are_facts(self):
        macro = dict(self.macro, bankRates={"items": {"deposit1y": {"name": "정기예금(1년)", "value": 2.61, "month": "2026-08"}}})
        facts, allowed = make_briefing.collect_facts(None, macro, None)
        self.assertTrue(any("정기예금(1년)" in f for f in facts))
        self.assertTrue(make_briefing.numbers_ok("은행 정기예금 평균은 2.61%예요", allowed))


if __name__ == "__main__":
    unittest.main()
