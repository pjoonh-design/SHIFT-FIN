# SHIFT-FIN

교대근무 경찰공무원을 위한 재무설계 에이전트.
계급·호봉·근무 형태·추가근무·수당을 넣으면 달마다 받는 돈을 계산하고, 그 돈으로 저축 배분안과 실행 계획을 만들어 준다.
밤에 깨어 있는 교대근무자를 위해 미국장 시간과 내 근무를 겹쳐 보여 주는 '오늘 밤' 화면도 있다.

2026 KHU AI Challenge (AI 문제해결 솔루션 부문) 출품작.

## 화면

| 탭 | 하는 일 |
|---|---|
| 에이전트 | 5단계 입력(근무·급여 → 지출 → 자산·부채 → 목표 → 성향·노후)과 실시간 재무설계 리포트: 재무 건강 점수, 이번 달 할 일, 월 저축 배분안, 보너스 달 활용, 목표별 진단, 노후 준비, AI에게 이어서 물어볼 요약 |
| 급여명세 | 평달·정근수당 달·명절 달·연간 실수령, 지급·공제 항목, 12개월 실수령 그래프, 수당 단가 |
| 오늘 밤 | 24시간 다이얼(미국 정규장 × 내 근무), 근무별 체크 시간, 실시간 시세 위젯, 3줄 브리핑, 미국장 마감·한국 지표·은행 금리·뉴스 |
| 노후 | 공무원연금 개략 추정, 퇴직수당, 퇴직~연금 개시 소득 공백, 더 준비할 돈 |

입력한 값은 서버로 보내지 않고 사용자의 브라우저(localStorage)에만 저장한다.

## 계산 기준 (2026년)

`assets/js/data/rules-2026.js` 한 파일에 모든 숫자와 출처가 있다. 규정이 바뀌면 이 파일만 고치면 된다.

- 봉급: 공무원보수규정 [별표 10] 경찰공무원 봉급표 (2026. 1. 2. 개정)
- 직급보조비 [별표 15], 정근수당·가산금 [별표 2], 명절휴가비 60%, 가족수당 [별표 5]
- 시간외 = 봉급기준액 ÷ 209 × 150%, 야간(22~06시) = ÷ 209 × 50%, 휴일 1일 = ÷ 26 × 150%
  - 봉급기준액 = 기준호봉(순경 9호봉, 경장 이상 10호봉) 봉급 × 60%(경장 이하) 또는 55%
- 정액급식비 월 16만원(비과세), 위험근무수당 월 8만원
- 공제: 공무원연금 기여금 9%, 건강보험 7.19%·장기요양 0.9448%의 절반, 소득세(간이세액 근사)·지방소득세
- 공무원연금: 연도별 지급률(2016년 1.878% → 2035년 1.7%), 지급개시연령, 퇴직수당(제62조)
- 연금저축·IRP 세액공제: 연 900만원 한도, 총급여 5,500만원 이하 16.5%, 초과 13.2%

한계: 소득세는 근사치이고, 공무원연금 소득재분배·기준소득월액 상한은 반영하지 않았다. 화면마다 '이렇게 계산했어요'에 적어 두었다.

## 데이터 자동 수집

GitHub Actions가 매일 07시·12시·21시(KST)에 `scripts/run_all.py`를 실행해 `data/live/*.json`을 갱신하고 커밋한다.

| 데이터 | 출처 | 키 (GitHub Secrets 이름) |
|---|---|---|
| 기준금리·환율·물가·성장률 | 한국은행 ECOS | `ECOS_API_KEY` |
| 은행 평균 예금·적금·대출 금리 (신규취급액, 월) | 한국은행 ECOS (121Y002·121Y006) | `ECOS_API_KEY` |
| 미국 지수·10년물 금리·VIX 마감 값 | FRED (세인트루이스 연준) | `FRED_API_KEY` |
| 정기예금·적금 금리 상위 | 금융감독원 금융상품한눈에 | `FINLIFE_API_KEY` |
| 경제 뉴스 헤드라인 | Google 뉴스 RSS | 필요 없음 |
| 3줄 브리핑 문장 | Google Gemini API | `GEMINI_API_KEY` (없으면 숫자 요약으로 대신) |
| 실시간 시세·경제 일정 | TradingView 무료 위젯 | 필요 없음 (브라우저에서 바로) |

키가 없는 소스는 '자동 수집 준비 중'으로 남고, 수집에 실패하면 이전 데이터를 지키면서 오류만 기록한다.
금융감독원 API는 해외(GitHub Actions 서버)에서 응답이 없을 때가 있어 https → http 순서로 시도하고, 그래도 안 되면 '은행 금리' 카드에 한국은행 은행 평균 금리를 대신 보여 준다.
AI 브리핑은 입력 데이터에 없는 숫자가 문장에 들어가면 버리고 숫자 요약으로 바꾼다.

### 키 발급

- ECOS: https://ecos.bok.or.kr/api/ → 인증키 신청
- FRED: https://fred.stlouisfed.org/docs/api/api_key.html → 계정 만들고 API Key 요청
- 금융감독원: https://finlife.fss.or.kr → 오픈API → 인증키 신청
- Gemini: https://aistudio.google.com/apikey → API 키 만들기

저장소 Settings → Secrets and variables → Actions → New repository secret 에 위 이름 그대로 넣는다.

## 배포 (GitHub Pages)

1. 저장소 Settings → Pages → Build and deployment: `Deploy from a branch`, Branch `main` / `(root)` → Save
2. 1~2분 뒤 `https://<아이디>.github.io/<저장소>/` 에서 열린다
3. Actions 탭 → '데이터 자동 수집' → Run workflow 로 첫 수집을 바로 돌릴 수 있다

## 개발

```bash
python3 -m http.server 8000      # http://localhost:8000 에서 확인 (ES 모듈이라 파일을 바로 열면 안 됨)
node --test tests/*.test.mjs     # 급여·세금·연금·재무설계·시계 계산 테스트
python3 -m unittest discover -s scripts/tests   # 데이터 수집 파서 테스트
```

```
index.html                 화면 뼈대
assets/css/app.css         디자인 (다크 기본, 라이트 대응)
assets/js/data/rules-2026.js   2026 보수·수당·공제·연금 기준과 출처
assets/js/engine/          계산 엔진 (pay, tax, pension, plan, market, format)
assets/js/ui/              화면 (agent, paysheet, tonight, retire)
scripts/                   데이터 수집 (표준 라이브러리만 사용) + 파서 테스트
data/live/                 자동 수집 결과 (Actions가 갱신)
.github/workflows/         자동 수집 일정
tools/build-preview.mjs    claude.ai 미리보기용 한 파일 버전 생성
```

## AI 활용

- 기획·문제 정의·콘텐츠 검증: ChatKHU(경희대 생성형 AI 플랫폼)
- 코드 작성·테스트·데이터 수집 설계: Claude (코드를 쓰고 직접 실행·수정하는 에이전트형 도구가 필요해 병행)
- 서비스 안의 AI: 3줄 브리핑(Gemini, 숫자 검증), AI에게 이어서 물어볼 요약 생성

정보 제공·교육용 서비스이며 투자 권유가 아니다.
