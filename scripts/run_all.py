"""모든 데이터를 한 번에 수집한다. GitHub Actions 가 하루 세 번 실행한다.

키가 없는 소스는 '연결 대기'로 남기고, 실패한 소스는 이전 데이터를 지키면서 오류만 기록한다.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import fetch_ecos  # noqa: E402
import fetch_finlife  # noqa: E402
import fetch_fred  # noqa: E402
import fetch_news  # noqa: E402
import make_briefing  # noqa: E402
from common import FetchError, now_iso, read_live, redact, write_live  # noqa: E402

SOURCES = [
    ("macro.json", "ECOS_API_KEY", lambda k: fetch_ecos.fetch(k)),
    ("us-markets.json", "FRED_API_KEY", lambda k: fetch_fred.fetch(k)),
    ("rates.json", "FINLIFE_API_KEY", lambda k: fetch_finlife.fetch(k)),
    ("news.json", None, lambda k: fetch_news.fetch()),
]


def run_one(name, env, fn):
    key = os.environ.get(env) if env else None
    if env and not key:
        prev = read_live(name)
        if prev and prev.get("status") == "ok":
            return f"{name}: 키 없음, 이전 데이터 유지"
        write_live(name, {"status": "pending", "updatedAt": now_iso(), "message": f"{env} 등록 대기"})
        return f"{name}: {env} 없음 → 연결 대기"
    try:
        write_live(name, fn(key))
        return f"{name}: 성공"
    except Exception as e:  # 한 소스가 실패해도 나머지는 계속 모은다
        if not isinstance(e, FetchError):
            e = FetchError(f"{type(e).__name__}: {e}")
        msg = redact(str(e))[:300]
        prev = read_live(name) or {"status": "pending"}
        if prev.get("status") != "ok":
            prev["message"] = "연결 실패, 다음 수집 때 다시 시도"
        prev.update({"stale": True, "lastError": msg, "lastErrorAt": now_iso()})
        write_live(name, prev)
        return f"{name}: 실패 ({msg})"


def main():
    for name, env, fn in SOURCES:
        print(run_one(name, env, fn))
    us, macro, news = read_live("us-markets.json"), read_live("macro.json"), read_live("news.json")
    ok = lambda d: d if d and d.get("status") == "ok" else None
    try:
        write_live("briefing.json", make_briefing.build(ok(us), ok(macro), ok(news), os.environ.get("GEMINI_API_KEY")))
        print("briefing.json: 성공")
    except FetchError as e:
        print(f"briefing.json: 건너뜀 ({e})")


if __name__ == "__main__":
    main()
