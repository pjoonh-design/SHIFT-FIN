"""데이터 수집 공통 도구. 표준 라이브러리만 사용한다."""
import datetime
import http.client
import json
import os
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIVE_DIR = os.path.join(ROOT, "data", "live")
KST = datetime.timezone(datetime.timedelta(hours=9))
UA = "SHIFT-FIN data bot (+https://github.com)"


def now_iso():
    return datetime.datetime.now(KST).isoformat(timespec="minutes")


class FetchError(Exception):
    def __init__(self, message, reason=None):
        super().__init__(message)
        self.reason = reason or message   # 짧은 원인 (시간 초과, HTTP 403 등)


def http_get(url, headers=None, timeout=25, retries=3):
    req_headers = {"User-Agent": UA, "Accept": "*/*"}
    req_headers.update(headers or {})
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=req_headers)
            with urllib.request.urlopen(req, timeout=timeout) as res:
                return res.read()
        except urllib.error.HTTPError as e:
            last = e
            if 400 <= e.code < 500 and e.code != 429:   # 키·주소 문제는 다시 해도 같다
                break
            time.sleep(2 * (attempt + 1))
        except (OSError, http.client.HTTPException) as e:  # 연결 끊김·시간 초과 등 일시 오류
            last = e
            time.sleep(2 * (attempt + 1))
    raise FetchError(f"GET 실패: {redact(url)} ({last})", reason=redact(str(last)))


def http_post_json(url, payload, headers=None, timeout=60):
    data = json.dumps(payload).encode("utf-8")
    req_headers = {"User-Agent": UA, "Content-Type": "application/json"}
    req_headers.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=req_headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:300]
        raise FetchError(f"POST {e.code}: {body}")
    except urllib.error.URLError as e:
        raise FetchError(f"POST 실패: {e}")


def redact(url):
    """로그에 API 키가 남지 않게 가린다."""
    for name in ("ECOS_API_KEY", "FRED_API_KEY", "FINLIFE_API_KEY", "GEMINI_API_KEY"):
        key = os.environ.get(name)
        if key:
            url = url.replace(key, "***")
    return url


def write_live(name, data):
    os.makedirs(LIVE_DIR, exist_ok=True)
    path = os.path.join(LIVE_DIR, name)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")
    os.replace(tmp, path)


def read_live(name, default=None):
    try:
        with open(os.path.join(LIVE_DIR, name), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def to_float(v):
    try:
        if v in (None, "", "."):
            return None
        return float(str(v).replace(",", ""))
    except ValueError:
        return None
