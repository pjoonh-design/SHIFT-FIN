// SHIFT-FIN 보수·수당·공제 기준 (2026년)
// 모든 금액은 원 단위. 규정이 바뀌면 이 파일만 고치면 되도록 숫자를 한곳에 모았다.

export const RULES = {
  year: 2026,
  updated: '2026-10-21',

  // 공무원보수규정 [별표 10] 경찰공무원·소방공무원 봉급표 (2026. 1. 2. 개정), 월지급액
  // 배열의 0번째가 1호봉
  payTable: {
    순경: [2133000, 2155600, 2187500, 2229200, 2281100, 2343900, 2418400, 2505600, 2595100, 2680900,
      2762900, 2844100, 2922200, 2998100, 3070500, 3140600, 3209100, 3273000, 3335700, 3395400,
      3451600, 3506000, 3557600, 3607200, 3654200, 3697100, 3733900, 3769300, 3803400, 3836800, 3869200],
    경장: [2215300, 2245500, 2290400, 2350700, 2427500, 2522200, 2628900, 2731700, 2829500, 2922200,
      3012000, 3099500, 3183800, 3264300, 3341600, 3416300, 3486000, 3553600, 3618500, 3680400,
      3739400, 3796100, 3850000, 3902200, 3951600, 3999600, 4039500, 4078000, 4114300, 4149600, 4183800],
    경사: [2472100, 2493100, 2539000, 2610800, 2710600, 2826000, 2942100, 3059100, 3170300, 3276600,
      3376800, 3475200, 3568600, 3657900, 3743200, 3823900, 3901400, 3975500, 4045300, 4111700,
      4175200, 4235000, 4293000, 4347900, 4399900, 4449900, 4492000, 4531300, 4569300, 4605800, 4639900],
    경위: [2507700, 2567700, 2640000, 2758200, 2879500, 3001800, 3125400, 3249000, 3373300, 3490700,
      3600800, 3709400, 3812400, 3909100, 4002700, 4090100, 4173700, 4252700, 4327900, 4399300,
      4467200, 4531200, 4592000, 4650300, 4705700, 4756500, 4800000, 4841900, 4881500, 4918600, 4954300],
    경감: [2698600, 2814700, 2933000, 3054900, 3178700, 3305500, 3435100, 3565700, 3697600, 3820800,
      3937600, 4051200, 4158400, 4261000, 4357000, 4449500, 4535400, 4618100, 4695400, 4768800,
      4837900, 4904700, 4965900, 5025200, 5081100, 5134000, 5183300, 5225600, 5264800, 5303200, 5338600, 5372500],
    경정: [3126100, 3243100, 3364700, 3491000, 3620600, 3752700, 3887000, 4022900, 4159300, 4296500,
      4425000, 4548700, 4666100, 4775600, 4879100, 4976500, 5068100, 5154500, 5236000, 5312400,
      5384200, 5451700, 5515300, 5574900, 5631200, 5684200, 5728100, 5770400, 5809200, 5846900],
  },

  // 계급별 기준.
  // overtimeBaseStep: 시간외근무수당 봉급기준액의 기준호봉 (순경 9호봉, 경장 이상 10호봉)
  // overtimeRatio: 기준호봉 봉급액에 곱하는 비율 (8급 상당 이하 60%, 그 위 55%)
  // positionAllowance: 직급보조비 (공무원수당 등에 관한 규정 별표 15)
  ranks: [
    { id: 'sk', name: '순경', overtimeBaseStep: 9, overtimeRatio: 0.60, positionAllowance: 175000 },
    { id: 'kj', name: '경장', overtimeBaseStep: 10, overtimeRatio: 0.60, positionAllowance: 175000 },
    { id: 'ks', name: '경사', overtimeBaseStep: 10, overtimeRatio: 0.55, positionAllowance: 180000 },
    { id: 'kw', name: '경위', overtimeBaseStep: 10, overtimeRatio: 0.55, positionAllowance: 185000 },
    { id: 'kg', name: '경감', overtimeBaseStep: 10, overtimeRatio: 0.55, positionAllowance: 185000 },
    { id: 'kjg', name: '경정', overtimeBaseStep: 10, overtimeRatio: 0.55, positionAllowance: 250000 },
  ],

  allowances: {
    meal: 160000,                 // 정액급식비 (비과세)
    hazard: 80000,                // 위험근무수당 (경찰·소방)
    holidayBonusRate: 0.60,       // 명절휴가비: 설·추석에 월봉급액의 60%
    // 정근수당: 1월·7월에 월봉급액 × 비율 (별표 2)
    seniority: [
      { minYears: 0, rate: 0.10 }, { minYears: 2, rate: 0.20 }, { minYears: 5, rate: 0.25 },
      { minYears: 6, rate: 0.30 }, { minYears: 7, rate: 0.35 }, { minYears: 8, rate: 0.40 },
      { minYears: 9, rate: 0.45 }, { minYears: 10, rate: 0.50 },
    ],
    // 정근수당 가산금: 매월 (20년 이상은 추가 가산금 포함)
    seniorityAddon: [
      { minYears: 0, amount: 30000 }, { minYears: 5, amount: 50000 }, { minYears: 10, amount: 60000 },
      { minYears: 15, amount: 80000 }, { minYears: 20, amount: 110000 }, { minYears: 25, amount: 130000 },
    ],
    family: { spouse: 40000, child1: 50000, child2: 80000, child3plus: 120000, other: 20000 },
    // 시간외·야간·휴일 근무수당 산식 (공무원수당 등에 관한 규정 제15~17조)
    overtime: { divisor: 209, multiplier: 1.5 },   // 시간당 봉급기준액 ÷ 209 × 150%
    night: { divisor: 209, multiplier: 0.5 },      // 22~06시 시간당 봉급기준액 ÷ 209 × 50%
    holiday: { divisor: 26, multiplier: 1.5 },     // 휴일 1일당 봉급기준액 ÷ 26 × 150%
    overtimeMonthlyCap: 57,                        // 일반 근무명령 월 상한(현업·재난 대응 예외)
  },

  // 근무 형태별 월평균 야간(22~06시) 시간과 휴일 근무일 추정치
  // 30.44일 ÷ 주기 × 1회 야간 8시간, 휴일 비율 0.33(주말 + 공휴일)
  shiftTypes: [
    { id: '4x2', name: '4조 2교대 (주·야·비·휴)', nightHours: 61, holidayDays: 2.5 },
    { id: '3x1', name: '3조 1교대 (당·비·휴)', nightHours: 81, holidayDays: 3.3 },
    { id: 'day', name: '일근 (주간 근무)', nightHours: 0, holidayDays: 0 },
    { id: 'custom', name: '직접 입력', nightHours: null, holidayDays: null },
  ],

  deductions: {
    pensionContribution: 0.09,     // 공무원연금 일반기여금 (기준소득월액의 9%)
    healthTotal: 0.0719,           // 건강보험료율 (본인 50%)
    longTermCareTotal: 0.009448,   // 장기요양보험료율, 소득 대비 (본인 50%)
    localIncomeTax: 0.10,          // 지방소득세 = 소득세 × 10%
  },

  tax: {
    mealNonTaxableLimit: 200000,   // 식대 비과세 한도 (월)
    personalDeduction: 1500000,    // 인적공제 1인당
    brackets: [                    // [상한, 세율, 누진공제]
      [14000000, 0.06, 0], [50000000, 0.15, 1260000], [88000000, 0.24, 5760000],
      [150000000, 0.35, 15440000], [300000000, 0.38, 19940000], [500000000, 0.40, 25940000],
      [1000000000, 0.42, 35940000], [Infinity, 0.45, 65940000],
    ],
    // 근로소득공제 [구간 하한, 기본공제, 초과분 공제율], 한도 2천만원
    earnedIncomeDeduction: [
      [0, 0, 0.70], [5000000, 3500000, 0.40], [15000000, 7500000, 0.15],
      [45000000, 12000000, 0.05], [100000000, 14750000, 0.02],
    ],
    earnedIncomeDeductionCap: 20000000,
  },

  // 연금계좌(연금저축·IRP) 세액공제
  pensionAccount: { annualLimit: 9000000, savingsLimit: 6000000, rateLow: 0.165, rateHigh: 0.132, grossThreshold: 55000000 },

  pension: {
    // 공무원연금 지급률(%) 2016 1.878 → 2035 1.7
    payRate: { 2016: 1.878, 2017: 1.856, 2018: 1.834, 2019: 1.812, 2020: 1.790, 2021: 1.780, 2022: 1.770,
      2023: 1.760, 2024: 1.750, 2025: 1.740, 2026: 1.736, 2027: 1.732, 2028: 1.728, 2029: 1.724,
      2030: 1.720, 2031: 1.716, 2032: 1.712, 2033: 1.708, 2034: 1.704 },
    payRateBefore2016: 1.9,
    payRateFrom2035: 1.7,
    maxServiceYears: 36,
    minServiceYears: 10,
    // 퇴직수당 = 재직기간 × 기준소득월액 × 지급비율 (재직기간 33년 상한)
    retirementAllowance: [
      { minYears: 1, rate: 0.065 }, { minYears: 5, rate: 0.2275 }, { minYears: 10, rate: 0.2925 },
      { minYears: 15, rate: 0.325 }, { minYears: 20, rate: 0.39 },
    ],
    retirementAllowanceMaxYears: 33,
    retirementAge: 60,             // 경찰공무원 연령정년
  },

  payday: 20,
  // 놓치기 쉬운 돈: 공무원·청년이 받을 수 있는 제도 (조건은 화면에서 '확인 필요'로 함께 안내)
  benefits: {
    youthFutureSaving: {
      name: '청년미래적금', ageMax: 34, militaryMaxYears: 6, grossMax: 60000000, monthlyMax: 500000, govRate: 0.06, years: 3,
      recruit: '매년 6월·12월 모집', householdNote: '가구 중위소득 200% 이하',
      source: { label: '청년미래적금 가입 조건 (토스피드, 2026.6)', url: 'https://toss.im/tossfeed/article/money-policies-64' },
    },
    housingSubscription: {
      name: '주택청약 소득공제', annualLimit: 3000000, rate: 0.40, grossMax: 70000000,
      source: { label: '주택청약저축 소득공제 조건 (2026)', url: 'https://wikidocs.net/blog/@TaxSave/25791/' },
    },
    policeMutual: {
      name: '경찰공제회 목돈수탁복지저축', rate: 4.30, asOf: '2026년 8월 공지', note: '만기지급식·연복리·세전, 회원 대상',
      source: { label: '공제회 저축 금리 비교 (2026)', url: 'https://glasswallet.com/blog/mutual-aid-association-guide' },
    },
    insuranceOverlap: {
      source: { label: '개인·단체 실손 중복 시 중지 신청', url: 'https://www.etoday.co.kr/news/view/2169504' },
    },
    pensionEarlyTax: 0.165,   // 연금저축을 55세 전에 꺼내면 공제받은 돈에 기타소득세 16.5%
  },
  // 은행 평균 금리 (실시간 수집이 안 될 때 쓰는 마지막 확인 값)
  benchmarks: {
    asOf: '2026-08', source: '한국은행 예금은행 가중평균금리(신규취급액 기준)',
    deposit1y: 3.39, saving: 3.72, creditLoan: 6.33, mortgage: 4.66, householdLoan: null,
  },                      // 보수 지급일: 매월 20일

  sources: [
    { name: '봉급표', text: '공무원보수규정 [별표 10] 경찰공무원·소방공무원 봉급표 (2026. 1. 2. 개정)', url: 'https://www.law.go.kr/flDownload.do?flSeq=160436465' },
    { name: '직급보조비', text: '공무원수당 등에 관한 규정 [별표 15] (2026. 1. 2. 개정)' },
    { name: '정근수당·가산금', text: '공무원수당 등에 관한 규정 [별표 2] (2025. 1. 3. 개정)' },
    { name: '명절휴가비·근무수당 산식', text: '공무원수당 등에 관한 규정 제15~17조, 제18조의3 (2026. 10. 2. 시행)' },
    { name: '정액급식비·위험근무수당', text: '2026년 공무원 보수 개정 (정액급식비 월 16만원, 경찰·소방 위험근무수당 월 8만원)', url: 'https://www.fnnews.com/news/202512291654213601' },
    { name: '가족수당', text: '공무원수당 등에 관한 규정 [별표 5] (2025년 10월 기준 금액)' },
    { name: '건강보험·장기요양', text: '국민건강보험공단 2026년 보험료율 (건강 7.19%, 장기요양 0.9448%)', url: 'https://www.nhis.or.kr/renewal_popup/poster/20260204_poster_longdesc_1.html' },
    { name: '공무원연금', text: '공무원연금법 (2015년 개정): 기여율 9%, 지급률 2035년 1.7%, 퇴직수당 제62조·시행령 제58조' },
    { name: '소득세', text: '소득세법: 종합소득세율, 근로소득공제, 근로소득세액공제' },
    { name: '청년미래적금', text: '만 19~34세, 총급여 6,000만원 이하 일반형 정부 기여금 6%, 월 50만원까지 3년', url: 'https://toss.im/tossfeed/article/money-policies-64' },
    { name: '주택청약 소득공제', text: '무주택 세대주·총급여 7,000만원 이하, 연 300만원 한도 40% 소득공제', url: 'https://wikidocs.net/blog/@TaxSave/25791/' },
    { name: '은행 평균 금리', text: '한국은행 ECOS 예금은행 가중평균금리(신규취급액 기준, 121Y002·121Y006), 하루 세 번 자동 수집' },
  ],
};

export const rankById = id => RULES.ranks.find(r => r.id === id) || RULES.ranks[0];
export const maxStep = rankName => RULES.payTable[rankName].length;
