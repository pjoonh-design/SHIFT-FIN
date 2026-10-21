"""금융감독원 금융상품한눈에: 은행 정기예금·적금 12개월 금리 상위 상품.

인증키: https://finlife.fss.or.kr 오픈API 메뉴에서 무료 발급 → FINLIFE_API_KEY
"""
import json
import os
import urllib.parse

from common import FetchError, http_get, now_iso, to_float

BASE = "https://finlife.fss.or.kr/finlifeapi"
BANKS = "020000"   # 은행권


def parse_products(payload, top=5, term="12"):
    result = payload.get("result", {})
    if result.get("err_cd") not in (None, "000"):
        raise FetchError(f"금융상품한눈에 {result.get('err_cd')}: {result.get('err_msg')}")
    bases = {(b.get("fin_co_no"), b.get("fin_prdt_cd")): b for b in result.get("baseList", [])}
    best = {}
    for o in result.get("optionList", []):
        if str(o.get("save_trm")) != term:
            continue
        k = (o.get("fin_co_no"), o.get("fin_prdt_cd"))
        b = bases.get(k)
        rate, max_rate = to_float(o.get("intr_rate")), to_float(o.get("intr_rate2"))
        if not b or rate is None:
            continue
        # 같은 상품에 단리·복리 등 여러 줄이 있으면 기본금리가 높은 줄만 남긴다
        if k in best and best[k]["rate"] >= rate:
            continue
        best[k] = {
            "bank": b.get("kor_co_nm"), "product": b.get("fin_prdt_nm"),
            "rate": rate, "maxRate": max_rate if max_rate is not None else rate,
            "term": int(term), "type": o.get("intr_rate_type_nm") or "",
            "open": str(b.get("join_deny")) == "1",   # 1: 가입 제한 없음
            "month": b.get("dcls_month"),
        }
    items = sorted(best.values(), key=lambda x: (-x["rate"], -x["maxRate"]))
    open_items = [x for x in items if x["open"]]
    return (open_items or items)[:top]


def fetch(key):
    out = {}
    for kind, path in (("deposit", "depositProductsSearch.json"), ("saving", "savingProductsSearch.json")):
        q = urllib.parse.urlencode({"auth": key, "topFinGrpNo": BANKS, "pageNo": 1})
        raw = http_get(f"{BASE}/{path}?{q}")
        out[kind] = parse_products(json.loads(raw.decode("utf-8")))
    if not out["deposit"] and not out["saving"]:
        raise FetchError("금리 상품을 찾지 못했어요")
    month = next((x["month"] for x in out["deposit"] + out["saving"] if x.get("month")), None)
    return {"status": "ok", "updatedAt": now_iso(), "source": "금융감독원 금융상품한눈에", "month": month, **out}


if __name__ == "__main__":
    print(json.dumps(fetch(os.environ["FINLIFE_API_KEY"]), ensure_ascii=False, indent=1))
