"""경제 뉴스 헤드라인: Google 뉴스 RSS (인증키 없음). 제목과 링크만 저장한다."""
import email.utils
import json
import urllib.parse
import xml.etree.ElementTree as ET

from common import FetchError, http_get, now_iso

TOPICS = [("미국 증시", "미국 증시"), ("환율", "원달러 환율"), ("금리", "기준금리")]


def parse_rss(xml_bytes, topic, limit=4):
    root = ET.fromstring(xml_bytes)
    items = []
    for it in root.iter("item"):
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        src_el = it.find("source")
        source = (src_el.text or "").strip() if src_el is not None else ""
        if source and title.endswith(f" - {source}"):
            title = title[: -len(source) - 3].strip()
        pub = it.findtext("pubDate")
        published = None
        if pub:
            try:
                published = email.utils.parsedate_to_datetime(pub).isoformat()
            except (TypeError, ValueError):
                published = None
        if title and link:
            items.append({"title": title, "link": link, "source": source, "published": published, "topic": topic})
        if len(items) >= limit:
            break
    return items


def fetch():
    items, seen = [], set()
    for topic, query in TOPICS:
        q = urllib.parse.quote(query)
        raw = http_get(f"https://news.google.com/rss/search?q={q}&hl=ko&gl=KR&ceid=KR:ko")
        for x in parse_rss(raw, topic):
            if x["title"] not in seen:
                seen.add(x["title"])
                items.append(x)
    if not items:
        raise FetchError("뉴스를 찾지 못했어요")
    items.sort(key=lambda x: x["published"] or "", reverse=True)
    return {"status": "ok", "updatedAt": now_iso(), "source": "Google 뉴스", "items": items[:10]}


if __name__ == "__main__":
    print(json.dumps(fetch(), ensure_ascii=False, indent=1))
