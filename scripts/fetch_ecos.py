"""한국은행 ECOS: 기준금리, 환율, 물가, 경제성장률 등 핵심 지표.

인증키: https://ecos.bok.or.kr/api/ 에서 무료 발급 → GitHub Secrets 의 ECOS_API_KEY
"""
import datetime
import json
import os

from common import FetchError, http_get, now_iso, to_float, KST

BASE = "https://ecos.bok.or.kr/api"

# 100대 통계지표에서 이름으로 찾는다 (코드가 바뀌어도 이름은 잘 안 바뀐다)
KEYSTATS = [
    ("baseRate", "기준금리", ["한국은행 기준금리", "기준금리"]),
    ("usdkrw", "원/달러 환율", ["원/달러 환율", "원/달러"]),
    ("gdp", "경제성장률", ["경제성장률"]),
    ("kospi", "코스피", ["코스피", "KOSPI"]),
    ("ktb3", "국고채 3년", ["국고채수익률(3년)", "국고채(3년)", "국고채"]),
    ("unemployment", "실업률", ["실업률"]),
]


def check_error(payload):
    """ECOS 는 오류도 200 으로 돌려준다: {"RESULT": {"CODE": "INFO-100", "MESSAGE": ...}}"""
    if isinstance(payload, dict) and "RESULT" in payload:
        r = payload["RESULT"]
        raise FetchError(f"ECOS {r.get('CODE')}: {r.get('MESSAGE')}")


def fmt_time(t):
    """20261020 → 2026-10-20, 202609 → 2026-09, 2026Q2 → 2026-Q2"""
    t = str(t or "")
    if len(t) == 8 and t.isdigit():
        return f"{t[:4]}-{t[4:6]}-{t[6:]}"
    if len(t) == 6:
        return f"{t[:4]}-{t[4:]}"
    return t


def parse_keystats(payload):
    check_error(payload)
    rows = payload.get("KeyStatisticList", {}).get("row", [])
    items = []
    for key, label, names in KEYSTATS:
        row = None
        for name in names:
            row = next((r for r in rows if name in str(r.get("KEYSTAT_NAME", ""))), None)
            if row:
                break
        if not row:
            continue
        value = to_float(row.get("DATA_VALUE"))
        if value is None:
            continue
        items.append({
            "key": key, "name": label, "value": value,
            "unit": row.get("UNIT_NAME", ""), "time": fmt_time(row.get("CYCLE")),
            "source": row.get("KEYSTAT_NAME", ""),
        })
    return items


def parse_cpi(payload):
    """소비자물가지수(총지수) 월별 → 전년 같은 달 대비 상승률"""
    check_error(payload)
    rows = payload.get("StatisticSearch", {}).get("row", [])
    series = sorted(((r.get("TIME"), to_float(r.get("DATA_VALUE"))) for r in rows), key=lambda x: x[0])
    series = [(t, v) for t, v in series if v is not None]
    if len(series) < 13:
        return None
    latest_t, latest_v = series[-1]
    year_ago = f"{int(latest_t[:4]) - 1}{latest_t[4:]}"
    base = next((v for t, v in series if t == year_ago), None)
    if not base:
        return None
    return {"month": fmt_time(latest_t), "yoy": round((latest_v / base - 1) * 100, 1), "index": latest_v}


def fetch(key):
    raw = http_get(f"{BASE}/KeyStatisticList/{key}/json/kr/1/120")
    items = parse_keystats(json.loads(raw.decode("utf-8")))
    end = datetime.datetime.now(KST)
    start = end - datetime.timedelta(days=500)
    cpi = None
    try:
        raw = http_get(f"{BASE}/StatisticSearch/{key}/json/kr/1/30/901Y009/M/{start:%Y%m}/{end:%Y%m}/0")
        cpi = parse_cpi(json.loads(raw.decode("utf-8")))
    except FetchError:
        cpi = None
    if not items:
        raise FetchError("ECOS 응답에서 지표를 찾지 못했어요")
    return {"status": "ok", "updatedAt": now_iso(), "source": "한국은행 경제통계시스템(ECOS)", "items": items, "cpi": cpi}


if __name__ == "__main__":
    print(json.dumps(fetch(os.environ["ECOS_API_KEY"]), ensure_ascii=False, indent=1))
