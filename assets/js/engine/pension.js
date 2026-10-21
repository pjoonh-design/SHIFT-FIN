// 공무원연금 개략 추정 (금액은 모두 '오늘 돈 가치', 원 단위)
// 2016년 이후 재직분 지급률 1% 부분의 소득재분배, 기준소득월액 상한 등은 반영하지 않는다.
import { RULES } from '../data/rules-2026.js';

export function payRate(year, P = RULES.pension) {
  if (year < 2016) return P.payRateBefore2016;
  if (year >= 2035) return P.payRateFrom2035;
  return P.payRate[year];
}

// 2010년 이후 임용자는 65세, 그 전 임용자는 퇴직연도에 따라 60~65세
export function govStartAge(hireYear, retireYear) {
  if (hireYear >= 2010) return 65;
  if (retireYear <= 2021) return 60;
  if (retireYear <= 2023) return 61;
  if (retireYear <= 2026) return 62;
  if (retireYear <= 2029) return 63;
  if (retireYear <= 2032) return 64;
  return 65;
}

export function retirementAllowanceRate(years, P = RULES.pension) {
  let rate = 0;
  for (const r of P.retirementAllowance) if (years >= r.minYears) rate = r.rate;
  return rate;
}

export function govPension({ birthYear, hireYear, retireAge, monthlyIncome, realGrowth = 2, thisYear }, P = RULES.pension) {
  const retireYear = birthYear + retireAge;
  const years = [];
  for (let y = hireYear; y < retireYear; y++) years.push(y);
  const counted = years.slice(0, P.maxServiceYears);
  const g = realGrowth / 100;
  const incomeAt = y => monthlyIncome * Math.pow(1 + g, y - thisYear);
  const avgIncome = counted.length ? counted.reduce((s, y) => s + incomeAt(y), 0) / counted.length : 0;
  const rateSum = counted.reduce((s, y) => s + payRate(y, P), 0);
  const eligible = years.length >= P.minServiceYears;
  const monthly = eligible ? (avgIncome * rateSum) / 100 : 0;
  const finalIncome = years.length ? incomeAt(retireYear - 1) : monthlyIncome;
  const allowanceYears = Math.min(years.length, P.retirementAllowanceMaxYears);
  const retirementAllowance = avgIncome * allowanceYears * retirementAllowanceRate(years.length, P);
  return {
    retireYear, serviceYears: years.length, countedYears: counted.length, capped: years.length > P.maxServiceYears,
    rateSum, avgIncome, monthly, finalIncome, eligible,
    replacementAvg: avgIncome ? monthly / avgIncome : 0,
    replacementFinal: finalIncome ? monthly / finalIncome : 0,
    startAge: govStartAge(hireYear, retireYear),
    retirementAllowance,
  };
}

// 은퇴 후 필요한 돈: 퇴직~연금 개시 공백 + 연금 개시 후 매달 부족분 (수익률 0%, 오늘 돈 가치)
export function retirementNeeds({ retireAge, startAge, targetMonthly, pensionMonthly, planToAge = 90 }) {
  const gapYears = Math.max(0, startAge - retireAge);
  const gapNeed = targetMonthly * 12 * gapYears;
  const from = Math.max(startAge, retireAge);
  const afterYears = Math.max(0, planToAge - from);
  const shortfall = Math.max(0, targetMonthly - pensionMonthly);
  const afterNeed = shortfall * 12 * afterYears;
  return { gapYears, gapNeed, from, afterYears, shortfall, afterNeed, total: gapNeed + afterNeed };
}
