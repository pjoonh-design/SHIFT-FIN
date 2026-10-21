// 화면 상태. 금액 입력은 '만원' 단위로 저장하고 계산할 때 원으로 바꾼다.
// 입력값은 이 기기 브라우저(localStorage)에만 저장한다.

export const DEFAULTS = {
  v: 2,
  isExample: true,
  tab: 'agent',
  step: 1,
  payMonth: 'regular',
  todayShift: 'night',
  profile: {
    birthYear: 1995, hireYear: 2021, retireAge: 60,
    rankId: 'kj', step: 7, years: 5,
    shiftType: '4x2', overtimeHours: 30, nightHours: 61, holidayDays: 2.5,
    hazard: true, otherAllowance: 0, performanceBonus: 0, otherDeduction: 0,
    family: { spouse: false, spouseNoIncome: false, children: 0, otherDependents: 0 },
    realGrowth: 2, targetSpend: 350,
  },
  finance: {
    spending: { housing: 45, insurance: 12, transport: 18, living: 75, other: 25 },
    saving: { deposit: 50, invest: 0, pension: 0, subscription: 10 },
    assets: { cash: 600, invest: 300, pension: 0, subscription: 400, housingDeposit: 2000 },
    debts: [{ name: '신용대출', balance: 1200, rate: 6.2, monthly: 25 }],
  },
  goals: [
    { name: '결혼 자금', amount: 3000, years: 3 },
    { name: '내 집 마련', amount: 10000, years: 8 },
  ],
  risk: 'moderate',
};

const KEY = 'shiftfin.v2';
const clone = o => JSON.parse(JSON.stringify(o));

function merge(base, saved) {
  if (Array.isArray(base) || Array.isArray(saved)) return Array.isArray(saved) ? saved : base;
  if (base && typeof base === 'object') {
    const out = { ...base };
    for (const k of Object.keys(saved || {})) {
      out[k] = k in base ? merge(base[k], saved[k]) : saved[k];
    }
    return out;
  }
  return saved === undefined ? base : saved;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.v === 2) return merge(clone(DEFAULTS), s);
    }
  } catch (e) { /* 저장소를 못 쓰면 예시로 시작 */ }
  return clone(DEFAULTS);
}

export function saveState(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* 무시 */ }
}

export const freshState = keep => ({ ...clone(DEFAULTS), ...keep });

export const getPath = (o, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);

export function setPath(o, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((a, k) => a[k], o);
  target[last] = value;
}
