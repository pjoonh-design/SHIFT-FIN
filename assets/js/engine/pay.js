// 경찰공무원 월급 계산: 계급·호봉·근무 형태·추가근무·수당 → 달마다 받는 돈
import { RULES, rankById } from '../data/rules-2026.js';
import { monthlyWithholding, annualIncomeTax } from './tax.js';
import { sum } from './format.js';

const max0 = v => Math.max(0, Number(v) || 0);
const pickRow = (rows, years, key) => {
  let v = rows[0][key];
  for (const r of rows) if (years >= r.minYears) v = r[key];
  return v;
};

export function familyAllowance({ spouse = false, children = 0, otherDependents = 0 } = {}, F = RULES.allowances.family) {
  let total = spouse ? F.spouse : 0;
  for (let i = 1; i <= Math.max(0, Math.floor(children)); i++) {
    total += i === 1 ? F.child1 : i === 2 ? F.child2 : F.child3plus;
  }
  return total + Math.max(0, Math.floor(otherDependents)) * F.other;
}

// 설·추석이 든 달 (2026년: 설 2월 17일, 추석 9월 25일), 성과상여금은 3월로 가정
const BONUS_MONTHS = { seniority: [1, 7], lunar: { 2: '설', 9: '추석' }, performance: 3 };

export function computePay(input, R = RULES) {
  const rank = rankById(input.rankId);
  const table = R.payTable[rank.name];
  const step = Math.min(table.length, Math.max(1, Math.round(Number(input.step) || 1)));
  const base = table[step - 1];
  const A = R.allowances;

  // 봉급기준액: 기준호봉 봉급액 × 비율 (시간외·야간·휴일 수당의 기준)
  const salaryBase = Math.floor(table[rank.overtimeBaseStep - 1] * rank.overtimeRatio);
  const rates = {
    overtime: Math.floor((salaryBase / A.overtime.divisor) * A.overtime.multiplier),
    night: Math.floor((salaryBase / A.night.divisor) * A.night.multiplier),
    holiday: Math.floor((salaryBase / A.holiday.divisor) * A.holiday.multiplier),
  };

  const years = max0(input.years);
  const seniorityRate = pickRow(A.seniority, years, 'rate');
  const addon = pickRow(A.seniorityAddon, years, 'amount');
  const fam = input.family || {};
  const family = familyAllowance(fam, A.family);
  const otHours = max0(input.overtimeHours);
  const nightHours = max0(input.nightHours);
  const holidayDays = max0(input.holidayDays);
  const n = v => v.toLocaleString('ko-KR');

  const items = [
    { key: 'base', name: '봉급', amount: base, note: `${rank.name} ${step}호봉` },
    { key: 'meal', name: '정액급식비', amount: A.meal, note: '비과세' },
    { key: 'position', name: '직급보조비', amount: rank.positionAllowance, note: rank.name },
    { key: 'hazard', name: '위험근무수당', amount: input.hazard === false ? 0 : A.hazard, note: input.hazard === false ? '해당 없음' : '경찰 위험직무' },
    { key: 'addon', name: '정근수당 가산금', amount: addon, note: `근무 ${years}년` },
    { key: 'family', name: '가족수당', amount: family, note: family ? '배우자·자녀 등' : '해당 없음' },
    { key: 'overtime', name: '시간외근무수당', amount: Math.floor(rates.overtime * otHours), note: `${n(rates.overtime)}원 × ${otHours}시간` },
    { key: 'night', name: '야간근무수당', amount: Math.floor(rates.night * nightHours), note: `${n(rates.night)}원 × ${nightHours}시간` },
    { key: 'holiday', name: '휴일근무수당', amount: Math.floor(rates.holiday * holidayDays), note: `${n(rates.holiday)}원 × ${holidayDays}일` },
    { key: 'other', name: '기타 수당', amount: max0(input.otherAllowance), note: '출동·특수업무 등' },
  ];

  const regularGross = sum(items.map(i => i.amount));
  const nonTaxable = Math.min(A.meal, R.tax.mealNonTaxableLimit);
  const regularTaxable = regularGross - nonTaxable;
  const seniorityPay = Math.floor(base * seniorityRate);
  const holidayBonus = Math.floor(base * A.holidayBonusRate);
  const performance = max0(input.performanceBonus);

  const annualGross = regularGross * 12 + seniorityPay * 2 + holidayBonus * 2 + performance;
  const annualTaxable = annualGross - nonTaxable * 12;
  const standardIncome = Math.floor(annualTaxable / 12);   // 기준소득월액 근사: 연 과세소득 ÷ 12

  const D = R.deductions;
  const floor10 = v => Math.floor(v / 10) * 10;
  const deductions = {
    pension: floor10(standardIncome * D.pensionContribution),
    health: floor10((standardIncome * D.healthTotal) / 2),
    ltc: floor10((standardIncome * D.longTermCareTotal) / 2),
    other: max0(input.otherDeduction),
  };
  const dependents = 1 + (fam.spouse && fam.spouseNoIncome ? 1 : 0)
    + Math.max(0, Math.floor(fam.children || 0)) + Math.max(0, Math.floor(fam.otherDependents || 0));
  const ctx = { dependents, monthlyPension: deductions.pension, monthlyInsurance: deductions.health + deductions.ltc };
  const fixedDeduction = deductions.pension + deductions.health + deductions.ltc + deductions.other;

  const months = [];
  for (let m = 1; m <= 12; m++) {
    const extras = [];
    if (BONUS_MONTHS.seniority.includes(m)) extras.push({ name: '정근수당', amount: seniorityPay });
    if (BONUS_MONTHS.lunar[m]) extras.push({ name: `명절휴가비(${BONUS_MONTHS.lunar[m]})`, amount: holidayBonus });
    if (m === BONUS_MONTHS.performance && performance) extras.push({ name: '성과상여금', amount: performance });
    const extra = sum(extras.map(e => e.amount));
    const gross = regularGross + extra;
    const w = monthlyWithholding(regularTaxable + extra, ctx, R.tax);
    const totalDeduction = fixedDeduction + w.tax + w.local;
    months.push({ month: m, extras, gross, incomeTax: w.tax, localTax: w.local, deduction: totalDeduction, net: gross - totalDeduction });
  }
  const regular = months.find(x => x.extras.length === 0);
  const annualNet = sum(months.map(x => x.net));
  const yearEnd = annualIncomeTax({
    grossTaxable: annualTaxable, dependents,
    pensionContribution: deductions.pension * 12, insurance: (deductions.health + deductions.ltc) * 12,
  }, R.tax);

  return {
    rank, step, base, salaryBase, rates, years, seniorityRate, items,
    regularGross, regularTaxable, seniorityPay, holidayBonus, performance,
    deductions, dependents, months, regular,
    annualGross, annualTaxable, annualNet, avgMonthlyNet: annualNet / 12,
    bonusNetAnnual: annualNet - regular.net * 12,
    standardIncome, yearEnd,
    overtimeOverCap: otHours > A.overtimeMonthlyCap,
  };
}
