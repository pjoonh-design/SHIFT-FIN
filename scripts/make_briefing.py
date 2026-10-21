"""오늘 밤 3줄 브리핑.

GEMINI_API_KEY 가 있으면 AI 가 문장을 쓰고, 없거나 검증에 실패하면 숫자로 만든 기본 요약을 쓴다.
AI 문장에 입력 데이터에 없는 숫자가 들어 있으면 버린다(숫자는 데이터에서, 설명은 AI 가).
"""
import json
import os
import re

from common import FetchError, http_post_json, now_iso

# 앞에서부터 시도한다. Flash-Lite 는 생각(thinking)을 최소로 해서 빠르고 싸다.
# 2026년 Gemini 3 이후로 temperature 등은 무시·폐지되고, 생각 토큰도 maxOutputTokens 에 포함된다.
MODELS = [m for m in [os.environ.get("GEMINI_MODEL"), "gemini-3.5-flash-lite", "gemini-flash-lite-latest",
                      "gemini-flash-latest", "gemini-2.5-flash"] if m]
NUM = re.compile(r"[-+]?\d[\d,]*\.?\d*")
# 숫자를 한글로 풀어 쓰면 검증을 피해 가므로 막는다: '삼 퍼센트', '일천삼백이십원', '삼점오'
SPELLED = re.compile(
    r"퍼센트|(?:\d|[일이삼사오육칠팔구십])\s*프로(?!그램|젝트|필|세스|모션|토콜|포즈|야구|듀서|페셔널|틴)"
    r"|(?<![0-9,.])[일이삼사오육칠팔구]?[십백천만][일이삼사오육칠팔구십백천만]*\s*(?:원|포인트|bp)")


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
        unit = it.get("unit", "")
        unit = "" if "=" in unit else unit          # 코스피 '1980.01.04=100' 같은 기준 표시는 뺀다
        facts.append(f"{it['name']}: {it['value']:,}{unit} ({it['time']})")
        allow(it["value"])
    cpi = (macro or {}).get("cpi")
    if cpi:
        facts.append(f"소비자물가 상승률(전년 같은 달 대비): {cpi['yoy']}% ({cpi['month']})")
        allow(cpi["yoy"])
    bank = ((macro or {}).get("bankRates") or {}).get("items", {})
    for it in bank.values():
        facts.append(f"은행 평균 {it['name']} 금리: {it['value']}% ({it['month']}, 신규취급액 기준)")
        allow(it["value"])
    for it in (news or {}).get("items", [])[:5]:
        facts.append(f"뉴스: {it['title']}")
    # 사실 문장에 들어 있는 숫자(날짜·뉴스 속 숫자 포함)는 그대로 써도 된다
    for f in facts:
        for n in NUM.findall(f):
            allowed.add(n.replace(",", "").lstrip("+-").rstrip("."))
    return facts, allowed


def spelled_numbers(text):
    return bool(SPELLED.search(text))


def lines_ok(lines, allowed, need_digits):
    """3줄 모두: 데이터에 없는 숫자 없음, 한글로 풀어 쓴 숫자 없음. 데이터가 있으면 1·2줄에 숫자가 있어야 한다."""
    if len(lines) < 3:
        return False, f"{len(lines)}줄"
    for i, line in enumerate(lines[:3]):
        if spelled_numbers(line):
            return False, "숫자를 한글로 씀"
        if not numbers_ok(line, allowed):
            return False, "데이터에 없는 숫자"
        if need_digits and i < 2 and not re.search(r"\d", line):
            return False, "숫자 없음"
    return True, ""


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


PROMPT = """너는 교대근무 경찰공무원을 위한 경제 브리핑 작성자야.
아래 [사실]만 사용해서, 야간 근무 중에 1분 안에 읽을 한국어 문장 정확히 3줄을 써.
1줄: 미국 증시 마감 흐름 (미국 사실이 없으면 코스피·환율 흐름)
2줄: 내 예금·적금·대출에 주는 의미 (은행 평균 예금·적금 금리를 물가 상승률과 비교하거나, 대출 평균 금리 수준을 짚기)
3줄: 오늘 챙겨 볼 뉴스 한 가지
규칙:
- 숫자는 [사실]에 적힌 표기 그대로(아라비아 숫자, %, 원) 옮겨 써. 숫자를 한글로 풀어 쓰지 마.
- 1줄과 2줄에는 [사실]의 숫자를 하나 이상 넣어.
- [사실]에 없는 숫자(직접 계산한 차이 포함), 앞으로의 예측, 특정 종목을 사거나 팔라는 말은 쓰지 마.
- 말투는 '~예요', '~어요'로 끝나는 해요체. 각 줄 60자 안팎. 줄 번호나 기호 없이 줄바꿈으로만 구분.

[사실]
{facts}
"""


def response_text(res):
    """생각(thought) 부분은 빼고 답 글자만 모은다. 비어 있으면 이유를 알려 준다."""
    cands = res.get("candidates") or []
    if not cands:
        reason = (res.get("promptFeedback") or {}).get("blockReason") or "후보 없음"
        raise FetchError(f"응답 없음 ({reason})")
    parts = (cands[0].get("content") or {}).get("parts") or []
    text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
    if not text.strip():
        raise FetchError(f"빈 응답 ({cands[0].get('finishReason', '?')})")
    return text


def ai_lines(facts, allowed, key, need_digits=True):
    prompt = PROMPT.format(facts="\n".join(facts))
    notes = []
    for model in MODELS:
        try:
            res = http_post_json(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                {"contents": [{"role": "user", "parts": [{"text": prompt}]}],
                 "generationConfig": {"maxOutputTokens": 2048}},   # 생각 토큰까지 들어갈 여유
                headers={"x-goog-api-key": key})
            lines = [l.strip(" -•*\t") for l in response_text(res).strip().splitlines() if l.strip()]
            good, why = lines_ok(lines, allowed, need_digits)
            if good:
                return lines[:3], model
            notes.append(f"{model}: {why}")
        except Exception as e:   # 어떤 오류든 다음 모델로, 마지막엔 숫자 요약으로
            notes.append(f"{model}: {getattr(e, 'reason', None) or type(e).__name__}")
    raise FetchError("AI 브리핑 실패: " + " / ".join(notes)[:280])


def build(us, macro, news, key=None):
    facts, allowed = collect_facts(us, macro, news)
    if not facts:
        raise FetchError("브리핑에 쓸 데이터가 없어요")
    base = {"status": "ok", "updatedAt": now_iso(), "basis": [f for f in facts if not f.startswith("뉴스")]}
    if key:
        try:
            lines, model = ai_lines(facts, allowed, key, need_digits=bool(us or macro))
            return {**base, "mode": "ai", "model": model, "lines": lines, "validated": True}
        except FetchError as e:
            return {**base, "mode": "template", "lines": template_lines(us, macro, news), "note": str(e)}
    return {**base, "mode": "template", "lines": template_lines(us, macro, news)}


if __name__ == "__main__":
    from common import read_live
    print(json.dumps(build(read_live("us-markets.json"), read_live("macro.json"), read_live("news.json"),
                           os.environ.get("GEMINI_API_KEY")), ensure_ascii=False, indent=1))
