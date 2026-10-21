// 놓치는 돈 찾기: 입력값으로 '받을 수 있는데 아직 안 받는 돈'을 1년 기준 금액으로 계산한다.
// 금액은 모두 코드가 계산한다. 가입 조건처럼 사이트가 확인할 수 없는 부분은 caveat 로 함께 보여 준다.
import { RULES } from '../data/rules-2026.js';
import { man, pct, sum } from './format.js';

const roundMan = v => Math.max(0, Math.round(v / 10000) * 10000);
const LOAN_BENCH = [
  { re: /신용|마이너스/, key: 'creditLoan', label: '은행 일반신용대출 평균' },
  { re: /주택|주담|담보/, key: 'mortgage', label: '은행 주택담보대출 평균' },
  { re: /.*/, key: 'householdLoan', label: '은행 가계대출 평균' },
];
const HOUSE_GOAL = /집|전세|주택|청약|아파트/;

// bench: 실시간 은행 평균 금리 { asOf, deposit1y, saving, creditLoan, mortgage, householdLoan } (없으면 규칙 파일 값)
export function findMissedMoney({ pay, plan, profile, finance, goals = [], bench }) {
  const B = RULES.benefits;
  const live = Object.fromEntries(Object.entries(bench || {}).filter(([, v]) => v !== null && v !== undefined));
  const b = { ...RULES.benchmarks, ...live };
  const saving = finance.saving || {};
  const assets = finance.assets || {};
  const free = plan.cashflow.free;
  const gross = pay.annualTaxable;
  const taxRate = (pay.yearEnd ? pay.yearEnd.marginal : 0.15) * 1.1;   // 지방소득세 10% 포함
  const items = [];

  // 1. 청년미래적금: 정부가 넣은 돈의 6%를 더 준다 (일반형)
  const YF = B.youthFutureSaving;
  if (free > 0 && gross <= YF.grossMax) {
    const youthAlloc = (plan.alloc.find(a => /청년미래적금/.test(a.product)) || {}).amount || 0;
    const monthly = Math.min(YF.monthlyMax, Math.max(saving.deposit || 0, youthAlloc));
    if (profile.age <= YF.ageMax && monthly > 0) {
      const amount = Math.round(monthly * 12 * YF.govRate);
      items.push({
        key: 'youth', kind: 'money', title: `${YF.name} 정부 기여금`, amount,
        detail: `월 ${man(monthly)}씩 넣으면 정부가 1년에 ${man(amount)}을 더 넣어 줘요. ${YF.years}년이면 ${man(amount * YF.years)}이고, 이자에 세금도 붙지 않아요.`,
        action: `${YF.recruit}이에요. 다음 모집 때 은행 앱에서 신청해요.`,
        caveat: `만 ${YF.ageMax}세 이하·총급여 ${man(YF.grossMax)} 이하·${YF.householdNote}, 청년도약계좌와는 함께 못 들어요.`,
        source: YF.source,
      });
    } else if (profile.age > YF.ageMax && profile.age <= YF.ageMax + YF.militaryMaxYears) {
      items.push({
        key: 'youth-military', kind: 'check', title: `${YF.name}, 군 복무했다면 대상일 수 있어요`, amount: null,
        detail: `군 복무 기간(최대 ${YF.militaryMaxYears}년)만큼 나이 계산에서 빼 줘요. 대상이면 넣은 돈의 ${pct(YF.govRate, 0)}를 정부가 더 줘요.`,
        action: `${YF.recruit}이에요. 병적증명서로 복무 기간을 확인해요.`,
        caveat: `총급여 ${man(YF.grossMax)} 이하·${YF.householdNote} 조건도 함께 봐요.`,
        source: YF.source,
      });
    }
  }

  // 2. 연금저축·IRP 세액공제: 계획대로 넣으면 지금보다 더 돌려받는 돈
  const PA = RULES.pensionAccount;
  const nowCredit = Math.min((saving.pension || 0) * 12, PA.annualLimit) * plan.tax.creditRate;
  const extraCredit = Math.round(plan.tax.refund - nowCredit);
  if (extraCredit >= 10000) {
    items.push({
      key: 'pension', kind: 'money', title: '연금저축·IRP 세액공제', amount: extraCredit,
      detail: `계획대로 연금계좌에 연 ${man(plan.tax.annualPension)}을 넣으면 연말정산에서 ${man(plan.tax.refund)}을 돌려받아요(넣은 돈의 ${pct(plan.tax.creditRate, 1)}).`,
      action: '증권사 앱에서 연금저축펀드 계좌를 열고 21일 자동이체를 걸어요.',
      caveat: `55세 전에 꺼내면 공제받은 돈에 ${pct(B.pensionEarlyTax, 1)} 세금이 붙어요. 꼭 노후용 돈만 넣어요.`,
      source: null,
    });
  }

  // 3. 주택청약 소득공제: 넣고 있는데 무주택확인서를 안 내면 못 받는다
  const HS = B.housingSubscription;
  if (gross <= HS.grossMax) {
    const paid = Math.min(HS.annualLimit, (saving.subscription || 0) * 12);
    const houseGoal = goals.some(g => HOUSE_GOAL.test(g.name || ''));
    if (paid > 0) {
      const amount = Math.round(paid * HS.rate * taxRate);
      items.push({
        key: 'subscription', kind: 'money', title: HS.name, amount,
        detail: `청약에 연 ${man(paid)}을 넣고 있어요. 소득공제(넣은 돈의 ${pct(HS.rate, 0)})를 받으면 세금이 약 ${man(amount)} 줄어요.`,
        action: '청약 통장 은행에 무주택확인서를 내야 받을 수 있어요. 은행 앱이나 창구에서 신청해요.',
        caveat: `무주택 세대의 세대주·총급여 ${man(HS.grossMax)} 이하만 받을 수 있어요. 연 ${man(HS.annualLimit)}까지 인정돼요.`,
        source: HS.source,
      });
    } else if (houseGoal && free > 0) {
      const amount = Math.round(HS.annualLimit * HS.rate * taxRate);
      items.push({
        key: 'subscription', kind: 'money', title: HS.name, amount,
        detail: `집 마련 목표가 있다면 청약에 월 ${man(HS.annualLimit / 12)}까지 넣을 때 세금이 1년에 약 ${man(amount)} 줄어요.`,
        action: '주택청약종합저축을 열고 은행에 무주택확인서를 내요.',
        caveat: `무주택 세대의 세대주·총급여 ${man(HS.grossMax)} 이하만 받을 수 있어요.`,
        source: HS.source,
      });
    }
  }

  // 4. 대출 금리: 은행 평균보다 비싸게 빌리고 있으면, 평균 수준으로만 낮춰도 줄어드는 이자
  for (const d of (finance.debts || []).filter(x => x.balance > 0 && x.rate > 0)) {
    const kind = LOAN_BENCH.find(t => t.re.test(d.name || '') && b[t.key]);
    if (!kind) continue;
    const avg = b[kind.key];
    if (d.rate <= avg + 0.3) continue;
    const amount = roundMan((d.balance * (d.rate - avg)) / 100);
    if (amount < 10000) continue;
    items.push({
      key: `loan-${d.name}`, kind: 'money', title: `${d.name} 금리 낮추기`, amount,
      detail: `연 ${d.rate}%는 ${kind.label}(${avg}%, ${b.asOf})보다 ${(d.rate - avg).toFixed(2)}%p 높아요. 평균 수준으로만 낮춰도 1년 이자가 약 ${man(amount)} 줄어요.`,
      action: '호봉이 오르거나 신용점수가 올랐다면 은행에 금리인하요구권을 신청하고, 갈아탈 대출도 비교해요.',
      caveat: '대출 종류·담보·신용점수에 따라 받을 수 있는 금리는 달라요.',
      source: { label: `한국은행 은행 평균 금리 (${b.asOf})`, url: null },
    });
  }

  // 5. 잠자는 돈: 비상금보다 많은 현금을 이자가 거의 없는 통장에 두고 있다면
  const efTarget = plan.ef.target;
  const idle = Math.max(0, (assets.cash || 0) - efTarget);
  const PM = B.policeMutual;
  if (idle >= 1000000 && b.deposit1y) {
    const amount = roundMan((idle * b.deposit1y) / 100);
    items.push({
      key: 'idle', kind: 'money', title: '잠자는 돈 굴리기', amount,
      detail: `비상금(${man(efTarget)})을 넘는 ${man(idle)}을 정기예금 평균 금리(${b.deposit1y}%)로만 맡겨도 1년 이자가 약 ${man(amount)}이에요.`,
      action: `목표에 쓸 날짜에 맞춰 정기예금에 나눠 넣어요. ${PM.name}(연 ${PM.rate.toFixed(2)}%, ${PM.asOf})처럼 경찰만 쓰는 상품도 비교해요.`,
      caveat: '지금 이자를 거의 못 받는 입출금 통장에 있다고 보고 계산했어요. 공제회 상품은 회원 가입과 조건 확인이 필요해요.',
      source: PM.source,
    });
  } else if (free > 0) {
    items.push({
      key: 'mutual', kind: 'check', title: '경찰공제회 저축 상품', amount: null,
      detail: `${PM.name}은 연 ${PM.rate.toFixed(2)}%(${PM.asOf}, ${PM.note})예요. 은행 정기예금 평균(${b.deposit1y}%)보다 높은 편이에요.`,
      action: '목돈을 맡길 때 은행 예금과 함께 비교해요.',
      caveat: '회원 가입이 필요하고 상품 조건은 공제회에서 확인해요.',
      source: PM.source,
    });
  }

  // 6. 보험 중복: 직장 단체보험(맞춤형 복지)과 개인 실손이 겹치면 한쪽을 멈출 수 있다
  if ((finance.spending || {}).insurance > 0) {
    items.push({
      key: 'insurance', kind: 'check', title: '실손보험 중복 확인', amount: null,
      detail: `매달 보험료로 ${man(finance.spending.insurance)}을 내고 있어요. 실손은 두 개 있어도 실제 쓴 병원비만큼만 나와요.`,
      action: '맞춤형 복지 단체보험에 실손이 있는지 보고, 개인 실손과 겹치면 한쪽을 중지 신청해요.',
      caveat: '중지한 보험은 나중에 다시 살릴 수 있어요. 보장 내용은 보험사에서 확인해요.',
      source: B.insuranceOverlap.source,
    });
  }

  const money = items.filter(i => i.kind === 'money').sort((a, b2) => b2.amount - a.amount);
  const checks = items.filter(i => i.kind === 'check');
  return { items: [...money, ...checks], total: sum(money.map(i => i.amount)), benchAsOf: b.asOf };
}
