// node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, rankById } from '../assets/js/data/rules-2026.js';
import { computePay, familyAllowance } from '../assets/js/engine/pay.js';
import { earnedIncomeDeduction, progressiveTax, earnedIncomeCredit } from '../assets/js/engine/tax.js';
import { govPension, payRate, govStartAge, retirementNeeds, retirementAllowanceRate } from '../assets/js/engine/pension.js';
import { marketStatus, openTimeChange, hm, dayLabel, countdown } from '../assets/js/engine/market.js';
import { makePlan, monthlyForGoal, payoffMonths } from '../assets/js/engine/plan.js';
import { findMissedMoney } from '../assets/js/engine/benefits.js';
import { man, manShort } from '../assets/js/engine/format.js';

const near = (a, b, eps, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} expected ${b} ± ${eps}, got ${a}`);
const utc = (y, mo, d, h, mi) => Date.UTC(y, mo - 1, d, h, mi);

// ---------- 봉급표 ----------
test('봉급표: 계급별 호봉 수와 공식 값 일치 (별표 10, 2026)', () => {
  const T = RULES.payTable;
  assert.deepEqual(Object.fromEntries(Object.entries(T).map(([k, v]) => [k, v.length])),
    { 순경: 31, 경장: 31, 경사: 31, 경위: 31, 경감: 32, 경정: 30 });
  // 두 번째 출처(1·10·20·30호봉)와 대조
  const anchors = {
    순경: [2133000, 2680900, 3395400, 3836800], 경장: [2215300, 2922200, 3680400, 4149600],
    경사: [2472100, 3276600, 4111700, 4605800], 경위: [2507700, 3490700, 4399300, 4918600],
    경감: [2698600, 3820800, 4768800, 5303200], 경정: [3126100, 4296500, 5312400, 5846900],
  };
  for (const [rank, vals] of Object.entries(anchors)) {
    [1, 10, 20, 30].forEach((s, i) => assert.equal(T[rank][s - 1], vals[i], `${rank} ${s}호봉`));
  }
  // 청원경찰 봉급표(=순경 열)와 대조
  [[5, 2281100], [15, 3070500], [24, 3607200], [31, 3869200]].forEach(([s, v]) => assert.equal(T.순경[s - 1], v));
});
test('봉급표: 모든 열이 호봉이 오를수록 커짐', () => {
  for (const [rank, col] of Object.entries(RULES.payTable)) {
    for (let i = 1; i < col.length; i++) assert.ok(col[i] > col[i - 1], `${rank} ${i + 1}호봉`);
  }
});

// ---------- 수당 ----------
test('시간외·야간·휴일 단가 (경장: 10호봉 × 60%)', () => {
  const p = computePay({ rankId: 'kj', step: 7, years: 5 });
  assert.equal(p.salaryBase, 1753320);
  assert.equal(p.rates.overtime, 12583);
  assert.equal(p.rates.night, 4194);
  assert.equal(p.rates.holiday, 101153);
});
test('시간외 기준호봉: 순경 9호봉 × 60%, 경사 10호봉 × 55%', () => {
  assert.equal(computePay({ rankId: 'sk', step: 1 }).salaryBase, Math.floor(2595100 * 0.6));
  assert.equal(computePay({ rankId: 'ks', step: 1 }).salaryBase, Math.floor(3276600 * 0.55));
});
test('정근수당 비율과 가산금', () => {
  const at = y => { const p = computePay({ rankId: 'kj', step: 7, years: y }); return [p.seniorityRate, p.items.find(i => i.key === 'addon').amount]; };
  assert.deepEqual(at(1), [0.10, 30000]);
  assert.deepEqual(at(3), [0.20, 30000]);
  assert.deepEqual(at(5), [0.25, 50000]);
  assert.deepEqual(at(10), [0.50, 60000]);
  assert.deepEqual(at(22), [0.50, 110000]);
  assert.deepEqual(at(26), [0.50, 130000]);
});
test('가족수당', () => {
  assert.equal(familyAllowance({ spouse: true, children: 2 }), 170000);
  assert.equal(familyAllowance({ children: 3 }), 250000);
  assert.equal(familyAllowance({ otherDependents: 2 }), 40000);
});

// ---------- 세금 ----------
test('근로소득공제·세율 구간', () => {
  assert.equal(earnedIncomeDeduction(5000000), 3500000);
  assert.equal(earnedIncomeDeduction(15000000), 7500000);
  assert.equal(earnedIncomeDeduction(45000000), 12000000);
  assert.equal(earnedIncomeDeduction(100000000), 14750000);
  assert.equal(earnedIncomeDeduction(700000000), 20000000);
  assert.equal(progressiveTax(14000000), 840000);
  assert.equal(progressiveTax(50000000), 6240000);
  near(progressiveTax(14000001), 840000.15, 0.01, '구간 경계 연속');
  assert.equal(earnedIncomeCredit(2598769, 45841272), 660000);
});

// ---------- 예시 인물: 경장 7호봉, 근무 5년, 4조 2교대 ----------
const EX = { rankId: 'kj', step: 7, years: 5, hazard: true, overtimeHours: 30, nightHours: 61, holidayDays: 2.5, family: {} };
test('예시 경장: 평달 지급 합계와 공제', () => {
  const p = computePay(EX);
  assert.equal(p.regularGross, 3980106);
  assert.equal(p.seniorityPay, 657225);
  assert.equal(p.holidayBonus, 1577340);
  assert.equal(p.annualGross, 52230402);
  assert.equal(p.standardIncome, 4192533);
  assert.deepEqual(p.deductions, { pension: 377320, health: 150720, ltc: 19800, other: 0 });
  assert.equal(p.regular.incomeTax, 161560);
  assert.equal(p.regular.localTax, 16150);
  assert.equal(p.regular.net, 3254556);
  // 정근수당 달·명절 달은 평달보다 많다
  assert.ok(p.months[0].net > p.regular.net && p.months[1].net > p.months[0].net);
  assert.equal(p.months.filter(m => m.extras.length).length, 4);
  near(p.annualNet, p.months.reduce((s, m) => s + m.net, 0), 0.5);
});

// ---------- 공무원연금 ----------
test('지급률·개시연령·퇴직수당 비율', () => {
  assert.equal(payRate(2015), 1.9); assert.equal(payRate(2026), 1.736); assert.equal(payRate(2040), 1.7);
  assert.equal(govStartAge(2021, 2055), 65); assert.equal(govStartAge(2005, 2026), 62);
  assert.equal(retirementAllowanceRate(4), 0.065); assert.equal(retirementAllowanceRate(12), 0.2925); assert.equal(retirementAllowanceRate(34), 0.39);
});
test('예시 경장 연금: 1995년생 2021년 임용, 60세 퇴직', () => {
  const r = govPension({ birthYear: 1995, hireYear: 2021, retireAge: 60, monthlyIncome: 4192533, realGrowth: 2, thisYear: 2026 });
  assert.equal(r.serviceYears, 34);
  near(r.rateSum, 58.28, 1e-9);
  let f = 0; for (let t = -5; t <= 28; t++) f += Math.pow(1.02, t);   // 2021~2054년, 2026년 기준
  near(r.avgIncome, (4192533 * f) / 34, 1e-6);
  near(r.monthly, r.avgIncome * 0.5828, 1);
  near(r.retirementAllowance, r.avgIncome * 33 * 0.39, 1);
  const n = retirementNeeds({ retireAge: 60, startAge: r.startAge, targetMonthly: 3500000, pensionMonthly: r.monthly });
  assert.equal(n.gapYears, 5);
  assert.equal(n.gapNeed, 210000000);
});

// ---------- 재무설계 ----------
test('대출 상환 개월 수', () => {
  assert.equal(payoffMonths(12000000, 0, 1000000), 12);
  // 1,200만원, 연 6%, 월 100만원 → 13개월 (마지막 달 일부)
  assert.equal(payoffMonths(12000000, 0.06, 1000000), 13);
  assert.equal(payoffMonths(12000000, 0.06, 50000), null);   // 이자도 못 갚음
});
test('목표 적립액: 닫힌 공식', () => {
  near(monthlyForGoal(30000000, 0.03, 3), 30000000 * (0.0025) / (Math.pow(1.0025, 36) - 1), 1e-6);
  assert.equal(monthlyForGoal(1200000, 0, 1), 100000);
});
test('예시 계획: 배분 합계가 남는 돈을 넘지 않고 점수는 0~100', () => {
  const pay = computePay(EX);
  const pension = govPension({ birthYear: 1995, hireYear: 2021, retireAge: 60, monthlyIncome: pay.standardIncome, thisYear: 2026 });
  const needs = retirementNeeds({ retireAge: 60, startAge: pension.startAge, targetMonthly: 3500000, pensionMonthly: pension.monthly });
  const plan = makePlan({
    pay, pension, needs,
    profile: { age: 31, retireAge: 60, family: {}, shiftName: '4조 2교대' },
    finance: {
      spending: { housing: 450000, insurance: 120000, transport: 180000, living: 750000, other: 250000 },
      saving: { deposit: 500000, invest: 0, pension: 0, subscription: 100000 },
      assets: { cash: 6000000, invest: 3000000, pension: 0, subscription: 4000000, housingDeposit: 20000000 },
      debts: [{ name: '신용대출', balance: 12000000, rate: 6.2, monthly: 250000 }],
    },
    goals: [{ name: '결혼 자금', amount: 30000000, years: 3 }, { name: '내 집 마련', amount: 100000000, years: 8 }],
    risk: 'moderate',
  });
  assert.ok(plan.totalPlanned <= plan.cashflow.free + 1, 'over-allocated');
  assert.ok(plan.score >= 0 && plan.score <= 100);
  assert.equal(plan.cashflow.spend, 1750000 + 250000);
  assert.equal(plan.ef.target, 6000000);
  assert.ok(plan.highDebts.length === 1);
  assert.ok(plan.alloc.find(a => a.key === 'debt'));
  // 31세·3년 뒤 결혼 목표: 목표 자금(청년미래적금)이 연금저축보다 먼저
  assert.ok(plan.young && plan.youthEligible && plan.goalsFirst);
  const keys = plan.alloc.map(a => a.key);
  const pi = keys.indexOf('pension');
  assert.ok(pi === -1 || pi > keys.indexOf('goal0'), keys.join(','));
  assert.match(plan.alloc.find(a => a.key === 'goal0').product, /청년미래적금/);
  assert.ok(plan.actions.now.some(t => /청년미래적금/.test(t)));
  assert.match(plan.aiPrompt, /경장 7호봉/);
  assert.doesNotMatch(plan.aiPrompt, /undefined|NaN/);
  for (const a of plan.alloc) assert.ok(a.amount > 0 && a.amount % 10000 === 0, a.label);
  // 정근수당에서 연금계좌로 보내는 돈은 정근수당 순액보다 작아야 한다
  const seniorityNet = pay.months[0].net - pay.regular.net;
  assert.ok(plan.tax.bonusToPension / 2 <= seniorityNet);
  assert.ok(plan.actions.soon.some(s => /개월 뒤 끝나요/.test(s)));
});
test('적자인 경우: 배분 없이 지출 점검부터', () => {
  const pay = computePay({ rankId: 'sk', step: 1, years: 0 });
  const pension = govPension({ birthYear: 2000, hireYear: 2026, retireAge: 60, monthlyIncome: pay.standardIncome, thisYear: 2026 });
  const needs = retirementNeeds({ retireAge: 60, startAge: 65, targetMonthly: 3000000, pensionMonthly: pension.monthly });
  const plan = makePlan({ pay, pension, needs, profile: { age: 26, retireAge: 60, family: {}, shiftName: '일근' },
    finance: { spending: { living: 4000000 }, saving: {}, assets: { cash: 0 }, debts: [] }, goals: [] });
  assert.ok(plan.cashflow.free < 0);
  assert.equal(plan.alloc.length, 0);
  assert.match(plan.headline, /적자/);
});

test('적자 가정(외벌이·자녀·고금리 대출): 빈 문장 없이 줄일 곳과 1개월치 비상금부터', () => {
  const fam = { spouse: true, spouseNoIncome: true, children: 1, otherDependents: 0 };
  const pay = computePay({ rankId: 'kj', step: 3, years: 3, overtimeHours: 30, nightHours: 61, holidayDays: 2.5, family: fam });
  const pension = govPension({ birthYear: 1996, hireYear: 2023, retireAge: 60, monthlyIncome: pay.standardIncome, thisYear: 2026 });
  const needs = retirementNeeds({ retireAge: 60, startAge: pension.startAge, targetMonthly: 3500000, pensionMonthly: pension.monthly });
  const plan = makePlan({ pay, pension, needs, profile: { age: 30, retireAge: 60, family: fam, shiftName: '4조 2교대' },
    finance: {
      spending: { housing: 600000, insurance: 250000, transport: 250000, living: 1500000, other: 300000 },
      saving: { deposit: 200000, subscription: 100000 }, assets: { cash: 2000000, invest: 1000000 },   // 1개월치(355만원)도 안 됨
      debts: [{ name: '전세대출', balance: 100000000, rate: 4.2, monthly: 350000 }, { name: '신용대출', balance: 15000000, rate: 6.8, monthly: 300000 }],
    },
    goals: [{ name: '내 집 마련', amount: 100000000, years: 7 }] });
  assert.ok(plan.cashflow.free < 0);
  const all = [...plan.actions.now, ...plan.actions.soon, ...plan.actions.year, ...plan.bonusPlan.map(b => b.use)].join(' ');
  assert.doesNotMatch(all, /(^|[^0-9,])0원|저축 항목 없음|undefined|NaN/);
  assert.ok(plan.actions.now.some(t => /가장 큰 지출인 식비·생활비/.test(t)));
  assert.ok(plan.actions.now.some(t => /우선 1개월치/.test(t)));
  assert.ok(plan.actions.now.some(t => /보험료/.test(t)));
  assert.ok(plan.actions.now.some(t => /신용대출\(연 6.8%\)는 은행에 금리인하요구권/.test(t)));
  assert.equal(plan.tax.bonusToPension, 0);
  assert.ok(!plan.actions.now.some(t => /청년미래적금/.test(t)));   // 적자일 땐 새 적금보다 지출 정리가 먼저
});

test('35세 이상이면 예전처럼 연금저축을 목표보다 먼저 채운다', () => {
  const pay = computePay(EX);
  const pension = govPension({ birthYear: 1988, hireYear: 2014, retireAge: 60, monthlyIncome: pay.standardIncome, thisYear: 2026 });
  const needs = retirementNeeds({ retireAge: 60, startAge: pension.startAge, targetMonthly: 3500000, pensionMonthly: pension.monthly });
  const plan = makePlan({ pay, pension, needs, profile: { age: 38, retireAge: 60, family: {}, shiftName: '4조 2교대' },
    finance: { spending: { living: 1500000 }, saving: {}, assets: { cash: 6000000 }, debts: [] },
    goals: [{ name: '내 집 마련', amount: 100000000, years: 8 }] });
  assert.ok(!plan.goalsFirst);
  const keys = plan.alloc.map(a => a.key);
  assert.ok(keys.indexOf('pension') < keys.indexOf('goal0'));
  assert.ok(plan.tax.refund > 0);
});

// ---------- 놓치는 돈 찾기 ----------
function scenario({ age = 31, birthYear = 2026 - age, finance, goals = [], payInput = EX }) {
  const pay = computePay(payInput);
  const pension = govPension({ birthYear, hireYear: 2021, retireAge: 60, monthlyIncome: pay.standardIncome, thisYear: 2026 });
  const needs = retirementNeeds({ retireAge: 60, startAge: pension.startAge, targetMonthly: 3500000, pensionMonthly: pension.monthly });
  const plan = makePlan({ pay, pension, needs, profile: { age, retireAge: 60, family: payInput.family || {}, shiftName: '4조 2교대' }, finance, goals });
  return { pay, plan, profile: { age }, finance, goals };
}
const BASE_FIN = {
  spending: { housing: 450000, insurance: 120000, transport: 180000, living: 750000, other: 250000 },
  saving: { deposit: 500000, invest: 0, pension: 0, subscription: 100000 },
  assets: { cash: 6000000, invest: 3000000, pension: 0, subscription: 4000000 },
  debts: [{ name: '신용대출', balance: 12000000, rate: 6.2, monthly: 250000 }],
};
const textOf = m => m.items.map(i => [i.title, i.detail, i.action, i.caveat].join(' ')).join(' ');

test('놓치는 돈: 31세 예시 — 청년미래적금 기여금·청약 소득공제·보험 확인', () => {
  const sc = scenario({ finance: BASE_FIN, goals: [{ name: '결혼 자금', amount: 30000000, years: 3 }, { name: '내 집 마련', amount: 100000000, years: 8 }] });
  const m = findMissedMoney(sc);
  const youth = m.items.find(i => i.key === 'youth');
  assert.equal(youth.amount, 500000 * 12 * 0.06);                       // 월 50만원 × 12 × 6%
  const sub = m.items.find(i => i.key === 'subscription');
  near(sub.amount, 1200000 * 0.4 * sc.pay.yearEnd.marginal * 1.1, 1);    // 연 120만원 × 40% × 한계세율(지방세 포함)
  assert.ok(!m.items.some(i => i.key.startsWith('loan')));               // 6.2%는 은행 평균 6.33%보다 낮음
  assert.ok(m.items.some(i => i.key === 'insurance' && i.kind === 'check'));
  assert.equal(m.total, youth.amount + sub.amount);
  assert.doesNotMatch(textOf(m), /undefined|NaN/);
});

test('놓치는 돈: 비싼 대출은 은행 평균과 비교, 실시간 평균이 있으면 그 값을 쓴다', () => {
  const fin = { ...BASE_FIN, debts: [{ name: '신용대출', balance: 15000000, rate: 6.8, monthly: 300000 }, { name: '전세대출', balance: 100000000, rate: 4.2, monthly: 350000 }] };
  const sc = scenario({ finance: fin });
  const m = findMissedMoney(sc);
  const loan = m.items.find(i => i.key === 'loan-신용대출');
  assert.equal(loan.amount, 70000);                                       // 1,500만원 × (6.8 − 6.33)% ≈ 7.05만원 → 7만원
  assert.ok(!m.items.some(i => i.key === 'loan-전세대출'));                // 가계대출 평균이 없으면 비교하지 않음
  const live = findMissedMoney({ ...sc, bench: { creditLoan: 7.0, householdLoan: 4.0, asOf: '2026-09' } });
  assert.ok(!live.items.some(i => i.key === 'loan-신용대출'));             // 평균 7.0%면 6.8%는 비싸지 않음
  assert.ok(!live.items.some(i => i.key === 'loan-전세대출'));             // 4.2%는 4.0%+0.3%p 이내
  assert.equal(live.benchAsOf, '2026-09');
});

test('놓치는 돈: 잠자는 현금, 35세 이상(군 복무 확인), 적자일 때', () => {
  const rich = findMissedMoney(scenario({ finance: { ...BASE_FIN, assets: { ...BASE_FIN.assets, cash: 20000000 } } }));
  assert.equal(rich.items.find(i => i.key === 'idle').amount, 470000);   // (2,000만 − 600만) × 3.39% ≈ 47.5만 → 47만원
  const older = findMissedMoney(scenario({ age: 37, finance: BASE_FIN }));
  assert.ok(older.items.some(i => i.key === 'youth-military' && i.kind === 'check'));
  assert.ok(!older.items.some(i => i.key === 'youth'));
  const tight = findMissedMoney(scenario({ finance: { ...BASE_FIN, spending: { living: 4000000 } } }));
  assert.ok(tight.items.every(i => i.key !== 'youth' && i.key !== 'mutual'));   // 적자면 새 저축 상품 권유 안 함
  assert.doesNotMatch(textOf(tight), /undefined|NaN/);
});

// ---------- 미국장 시계 ----------
test('미국장: 서머타임·휴장·주말', () => {
  let st = marketStatus(utc(2026, 10, 21, 5, 49));
  assert.equal(st.state, 'pre'); assert.equal(hm(st.openMs), '22:30'); assert.equal(hm(st.closeMs), '05:00');
  st = marketStatus(utc(2026, 11, 2, 5, 0));
  assert.equal(hm(st.openMs), '23:30');
  st = marketStatus(utc(2026, 11, 26, 13, 0));
  assert.equal(st.holidayName, '추수감사절'); assert.equal(st.early, true); assert.equal(hm(st.closeMs), '03:00');
  st = marketStatus(utc(2026, 10, 24, 16, 0));
  assert.equal(st.openMs, utc(2026, 10, 26, 13, 30));
  const c = openTimeChange(utc(2026, 10, 21, 5, 49));
  assert.equal(dayLabel(c.openMs, utc(2026, 10, 21, 5, 49)), '11/2(월)');
  assert.deepEqual(countdown(7 * 3600e3 + 41 * 60e3), { text: '7:41', mono: true });
});

// ---------- 표기 ----------
test('금액 표기', () => {
  assert.equal(man(3254556), '325만원');
  assert.equal(man(335000000), '3억 3,500만원');
  assert.equal(man(300000000), '3억원');
  assert.equal(man(-12000000), '−1,200만원');
  assert.equal(manShort(250000000), '2.5억');
  assert.equal(rankById('ks').name, '경사');
});
