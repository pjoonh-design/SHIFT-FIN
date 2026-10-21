"""FRED(미국 세인트루이스 연준): 미국 지수·금리 일별 마감 값.

인증키: https://fred.stlouisfed.org/docs/api/api_key.html 에서 무료 발급 → FRED_API_KEY
"""
import json
import os
import urllib.parse

from common import FetchError, http_get, now_iso, to_float

SERIES = [
    ("SP500", "S&P 500", ""),
    ("NASDAQCOM", "나스닥 종합", ""),
    ("DJIA", "다우존스", ""),
    ("DGS10", "미국 10년물 국채금리", "%"),
    ("VIXCLS", "VIX 변동성 지수", ""),
]


def parse_observations(payload):
    """최근 값과 그 전 거래일 값을 찾는다 ('.' 은 휴장일 빈 값)"""
    if "error_message" in payload:
        raise FetchError(f"FRED: {payload['error_message']}")
    obs = [(o.get("date"), to_float(o.get("value"))) for o in payload.get("observations", [])]
    obs = [(d, v) for d, v in obs if v is not None]
    obs.sort(key=lambda x: x[0], reverse=True)
    if len(obs) < 2:
        return None
    (d0, v0), (d1, v1) = obs[0], obs[1]
    return {"date": d0, "value": v0, "prevDate": d1, "prev": v1,
            "change": round(v0 - v1, 4), "changePct": round((v0 / v1 - 1) * 100, 2) if v1 else None}


def fetch(key):
    items = []
    errors = []
    for sid, name, unit in SERIES:
        q = urllib.parse.urlencode({"series_id": sid, "api_key": key, "file_type": "json",
                                    "sort_order": "desc", "limit": 10})
        try:
            raw = http_get(f"https://api.stlouisfed.org/fred/series/observations?{q}")
            p = parse_observations(json.loads(raw.decode("utf-8")))
            if p:
                items.append({"id": sid, "name": name, "unit": unit, **p})
        except FetchError as e:
            errors.append(str(e))
    if not items:
        raise FetchError("FRED 값을 하나도 받지 못했어요: " + "; ".join(errors))
    return {"status": "ok", "updatedAt": now_iso(), "source": "FRED, Federal Reserve Bank of St. Louis",
            "items": items, "errors": errors}


if __name__ == "__main__":
    print(json.dumps(fetch(os.environ["FRED_API_KEY"]), ensure_ascii=False, indent=1))
