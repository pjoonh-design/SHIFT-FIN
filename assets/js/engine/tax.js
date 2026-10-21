// 근로소득세 근사 계산 (소득세법 기준).
// 매달 원천징수는 간이세액표처럼 '그 달 과세급여 × 12'로 연 세액을 구해 12로 나눈 값으로 근사한다.
// 자녀세액공제·각종 특별세액공제는 연말정산에서 반영되므로 여기서는 빼고 계산한다.
import { RULES } from '../data/rules-2026.js';

export function earnedIncomeDeduction(gross, T = RULES.tax) {
  const rows = T.earnedIncomeDeduction;
  for (let i = rows.length - 1; i >= 0; i--) {
    const [floor, basic, rate] = rows[i];
    if (gross > floor) return Math.min(basic + (gross - floor) * rate, T.earnedIncomeDeductionCap);
  }
  return 0;
}

export function progressiveTax(base, T = RULES.tax) {
  for (const [cap, rate, deduction] of T.brackets) {
    if (base <= cap) return Math.max(0, base * rate - deduction);
  }
  return 0;
}

export function marginalRate(base, T = RULES.tax) {
  for (const [cap, rate] of T.brackets) if (base <= cap) return rate;
  return T.brackets[T.brackets.length - 1][1];
}

// 근로소득세액공제와 총급여 구간별 한도
export function earnedIncomeCredit(calculated, gross) {
  const raw = calculated <= 1300000 ? calculated * 0.55 : 715000 + (calculated - 1300000) * 0.30;
  let limit;
  if (gross <= 33000000) limit = 740000;
  else if (gross <= 70000000) limit = Math.max(660000, 740000 - (gross - 33000000) * 0.008);
  else if (gross <= 120000000) limit = Math.max(500000, 660000 - (gross - 70000000) * 0.5);
  else limit = Math.max(200000, 500000 - (gross - 120000000) * 0.5);
  return Math.min(raw, limit);
}

export function annualIncomeTax({ grossTaxable, dependents = 1, pensionContribution = 0, insurance = 0 }, T = RULES.tax) {
  const deduction = earnedIncomeDeduction(grossTaxable, T);
  const earned = Math.max(0, grossTaxable - deduction);
  const personal = T.personalDeduction * Math.max(1, dependents);
  const base = Math.max(0, earned - personal - pensionContribution - insurance);
  const calculated = progressiveTax(base, T);
  const credit = earnedIncomeCredit(calculated, grossTaxable);
  const determined = Math.max(0, calculated - credit);
  return {
    deduction, earned, personal, base, calculated, credit, determined,
    local: determined * 0.1, marginal: marginalRate(base, T),
  };
}

export function monthlyWithholding(monthTaxable, ctx, T = RULES.tax) {
  const a = annualIncomeTax({
    grossTaxable: monthTaxable * 12,
    dependents: ctx.dependents,
    pensionContribution: ctx.monthlyPension * 12,
    insurance: ctx.monthlyInsurance * 12,
  }, T);
  const tax = Math.floor(a.determined / 12 / 10) * 10;
  const local = Math.floor((tax * 0.1) / 10) * 10;
  return { tax, local };
}
