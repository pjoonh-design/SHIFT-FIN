"""금융감독원 금융상품한눈에: 은행 정기예금·적금 12개월 금리 상위 상품.

인증키: https://finlife.fss.or.kr 오픈API 메뉴에서 무료 발급 → FINLIFE_API_KEY

해외(GitHub Actions)에서는 응답이 늦거나 막힐 때가 있어 https → http 순서로 한 번씩 시도하고,
어느 쪽이 왜 실패했는지 짧게 남긴다. 실패하면 화면은 한국은행 은행 평균 금리로 대신한다.
"""
import json
import os
import re
import urllib.parse

from common import FetchError, http_get, now_iso, to_float

BASES = ("https://finlife.fss.or.kr/finlifeapi", "http://finlife.fss.or.kr/finlifeapi")
BANKS = "020000"   # 은행권
MAX_PAGES = 5
BROWSER_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


def check_result(payload):
    result = payload.get("result", {})
    if result.get("err_cd") not in (None, "000"):
        raise FetchError(f"금융상품한눈에 {result.get('err_cd')}: {result.get('err_msg')}")
    return result


def merge_pages(payloads):
    """여러 페이지 응답을 하나로 합친다."""
    base_list, option_list = [], []
    for p in payloads:
        r = check_result(p)
        base_list += r.get("baseList", [])
        option_list += r.get("optionList", [])
    return {"result": {"err_cd": "000", "baseList": base_list, "optionList": option_list}}


def clean(name):
    """'주식회사 케이뱅크' → '케이뱅크', 줄바꿈·겹친 공백 정리"""
    name = re.sub(r"\s*주식회사\s*", " ", str(name or ""))
    return " ".join(name.split())


def parse_products(payload, top=5, term="12"):
    result = check_result(payload)
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
            "bank": clean(b.get("kor_co_nm")), "product": clean(b.get("fin_prdt_nm")),
            "rate": rate, "maxRate": max_rate if max_rate is not None else rate,
            "term": int(term), "type": o.get("intr_rate_type_nm") or "",
            "open": str(b.get("join_deny")) == "1",   # 1: 가입 제한 없음
            "month": b.get("dcls_month"),
        }
    items = sorted(best.values(), key=lambda x: (-x["rate"], -x["maxRate"]))
    open_items = [x for x in items if x["open"]]
    return (open_items or items)[:top]


def get_page(base, path, key, page):
    q = urllib.parse.urlencode({"auth": key, "topFinGrpNo": BANKS, "pageNo": page})
    raw = http_get(f"{base}/{path}?{q}", headers={"User-Agent": BROWSER_UA}, timeout=20, retries=2)
    return json.loads(raw.decode("utf-8"))


def first_reachable(path, key):
    """https, http 순서로 첫 페이지를 받아 본다. 둘 다 실패하면 각각의 원인을 남긴다."""
    errors = []
    for base in BASES:
        try:
            return base, get_page(base, path, key, 1)
        except FetchError as e:
            errors.append(f"{base.split(':')[0]} {e.reason}")
    raise FetchError("금감원 서버 응답 없음 (" + " / ".join(errors) + ")")


def fetch_all_pages(path, key, base=None):
    if base:
        first = get_page(base, path, key, 1)
    else:
        base, first = first_reachable(path, key)
    pages = [first]
    max_page = int(to_float(check_result(first).get("max_page_no")) or 1)
    for page in range(2, min(max_page, MAX_PAGES) + 1):
        pages.append(get_page(base, path, key, page))
    return base, merge_pages(pages)


def fetch(key):
    out, base = {}, None
    for kind, path in (("deposit", "depositProductsSearch.json"), ("saving", "savingProductsSearch.json")):
        base, merged = fetch_all_pages(path, key, base)
        out[kind] = parse_products(merged)
    if not out["deposit"] and not out["saving"]:
        raise FetchError("금리 상품을 찾지 못했어요")
    month = next((x["month"] for x in out["deposit"] + out["saving"] if x.get("month")), None)
    return {"status": "ok", "updatedAt": now_iso(), "source": "금융감독원 금융상품한눈에", "month": month,
            "via": base.split(":")[0], **out}


if __name__ == "__main__":
    print(json.dumps(fetch(os.environ["FINLIFE_API_KEY"]), ensure_ascii=False, indent=1))
