"""오늘 밤 3줄 브리핑.

GEMINI_API_KEY 가 있으면 AI 가 문장을 쓰고, 없거나 검증에 실패하면 숫자로 만든 기본 요약을 쓴다.
AI 문장에 입력 데이터에 없는 숫자가 들어 있으면 버린다(숫자는 데이터에서, 설명은 AI 가).
"""
import json
import os
import re

from common import FetchError, http_post_json, now_iso

MODELS = [os.environ.get("GEMINI_MODEL") or "gemini-flash-latest", "gemini-2.5-flash"]
NUM = re.compile(r"[-+]?\d[\d,]*\.?\d*")


def fmt(v, digits=2):
    return f"{v:,.{digits}f}"


def signed_pct(v):
    return ("+" if v >= 0 else "") + f"{v:.2f}%"


def collect_facts(us, macro, news):
    """브리핑에 쓸 사실 목록과, 문장에 나와도 되는 숫자 표기 목록"""
    facts, allowed = [], set()

    def allow(*vals):
        for v in vals:
            if v is None:
                continue
            for d in (0, 1, 2):
                allowed.add(f"{abs(v):,.{d}f}".replace(",", ""))
                allowed.add(f"{abs(v):.{d}f}")

    for it in (us or {}).get("items", []):
        line = f"{it['name']}: {fmt(it['value'])} ({it['date']} 마감, 전일 대비 {signed_pct(it['changePct'] or 0)})"
        facts.append(line)
        allow(it["value"], it.get("change"), it.get("changePct"), it.get("prev"))
    for it in (macro or {}).get("items", []):
        facts.append(f"{it['name']}: {it['value']}{it.get('unit', '')} ({it['time']})")
        allow(it["value"])
    cpi = (macro or {}).get("cpi")
    if cpi:
        facts.append(f"소비자물가 상승률(전년 같은 달 대비): {cpi['yoy']}% ({cpi['month']})")
        allow(cpi["yoy"])
    for it in (news or {}).get("items", [])[:5]:
        facts.append(f"뉴스: {it['title']}")
    # 사실 문장에 들어 있는 숫자(날짜·뉴스 속 숫자 포함)는 그대로 써도 된다
    for f in facts:
        for n in NUM.findall(f):
            allowed.add(n.replace(",", "").lstrip("+-").rstrip("."))
    return facts, allowed


def numbers_ok(text, allowed):
    for n in NUM.findall(text):
        k = n.replace(",", "").lstrip("+-").rstrip(".")
        if not k or k in {"1", "2", "3"}:   # 목록 번호 등
            continue
        if k not in allowed:
            return False
    return True


def template_lines(us, macro, news):
    lines = []
    items = {it["id"]: it for it in (us or {}).get("items", [])}
    idx = [items[k] for k in ("SP500", "NASDAQCOM", "DJIA") if k in items]
    if idx:
        date = idx[0]["date"]
        lines.append(f"{date} 미국장: " + ", ".join(f"{i['name']} {fmt(i['value'])}({signed_pct(i['changePct'] or 0)})" for i in idx))
    rest = []
    if "DGS10" in items:
        rest.append(f"미국 10년물 {items['DGS10']['value']:.2f}%")
    if "VIXCLS" in items:
        rest.append(f"VIX {items['VIXCLS']['value']:.2f}")
    m = {it["key"]: it for it in (macro or {}).get("items", [])}
    if "usdkrw" in m:
        rest.append(f"원/달러 {m['usdkrw']['value']:,.1f}원")
    if "baseRate" in m:
        rest.append(f"한국 기준금리 {m['baseRate']['value']}%")
    if rest:
        lines.append(" · ".join(rest))
    if news and news.get("items"):
        lines.append(f"뉴스: {news['items'][0]['title']}")
    return lines[:3]


PROMPT = """너는 교대근무 경찰공무원을 위한 경제 브리핑 작성자다.
아래 사실만 사용해서, 밤에 3분 안에 읽을 한국어 문장 정확히 3줄을 써라.
1줄: 미국 증시 흐름 / 2줄: 환율·금리가 내 대출·적금·연금에 주는 의미 / 3줄: 오늘 챙겨 볼 뉴스 한 가지.
규칙: 사실에 없는 숫자를 쓰지 말 것. 특정 종목을 사거나 팔라고 하지 말 것. 각 줄은 60자 안팎. 줄 번호·기호 없이 줄바꿈으로만 구분.

[사실]
{facts}
"""


def ai_lines(facts, allowed, key):
    prompt = PROMPT.format(facts="\n".join(facts))
    last = None
    for model in MODELS:
        try:
            res = http_post_json(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                {"contents": [{"role": "user", "parts": [{"text": prompt}]}],
                 "generationConfig": {"temperature": 0.3, "maxOutputTokens": 400}},
                headers={"x-goog-api-key": key})
            text = res["candidates"][0]["content"]["parts"][0]["text"]
            lines = [l.strip(" -•\t") for l in text.strip().splitlines() if l.strip()]
            if len(lines) >= 3 and all(numbers_ok(l, allowed) for l in lines[:3]):
                return lines[:3], model
            last = "숫자 검증 실패"
        except (FetchError, KeyError, IndexError) as e:
            last = str(e)
    raise FetchError(f"AI 브리핑 실패: {last}")


def build(us, macro, news, key=None):
    facts, allowed = collect_facts(us, macro, news)
    if not facts:
        raise FetchError("브리핑에 쓸 데이터가 없어요")
    base = {"status": "ok", "updatedAt": now_iso(), "basis": [f for f in facts if not f.startswith("뉴스")]}
    if key:
        try:
            lines, model = ai_lines(facts, allowed, key)
            return {**base, "mode": "ai", "model": model, "lines": lines, "validated": True}
        except FetchError as e:
            return {**base, "mode": "template", "lines": template_lines(us, macro, news), "note": str(e)}
    return {**base, "mode": "template", "lines": template_lines(us, macro, news)}


if __name__ == "__main__":
    from common import read_live
    print(json.dumps(build(read_live("us-markets.json"), read_live("macro.json"), read_live("news.json"),
                           os.environ.get("GEMINI_API_KEY")), ensure_ascii=False, indent=1))
