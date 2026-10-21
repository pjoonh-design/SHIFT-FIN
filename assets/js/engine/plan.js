// SHIFT-FIN 재무설계 에이전트 (규칙 기반)
// 급여 계산 결과와 지출·자산·부채·목표를 받아 진단, 월 저축 배분안, 실행 계획을 만든다.
// 숫자는 모두 코드가 계산한다. 문장은 계산 결과로 채우는 템플릿이다.
import { RULES } from '../data/rules-2026.js';
import { man, pct, sum } from './format.js';

export const RISK = {
  stable: { name: '안정형', longReturn: 0.04, mix: [['현금성', 25], ['채권', 45], ['국내 주식 지수', 10], ['해외 주식 지수', 20]] },
  moderate: { name: '중립형', longReturn: 0.05, mix: [['현금성', 10], ['채권', 35], ['국내 주식 지수', 15], ['해외 주식 지수', 40]] },
  aggressive: { name: '적극형', longReturn: 0.06, mix: [['현금성', 5], ['채권', 20], ['국내 주식 지수', 20], ['해외 주식 지수', 55]] },
};
const INFLATION = 0.02;

// 목표 금액(fv)을 n년 동안 매달 모으려면 얼마씩 (연 수익률 r, 월복리)
export function monthlyForGoal(fv, r, years) {
  const n = Math.round(years * 12);
  if (fv <= 0) return 0;
  if (n <= 0) return fv;
  const i = r / 12;
  return i === 0 ? fv / n : (fv * i) / (Math.pow(1 + i, n) - 1);
}
const grow = (pv, r, years) => pv * Math.pow(1 + r, years);
const roundMan = v => Math.max(0, Math.round(v / 10000) * 10000);   // 1만원 단위
const ceilMan = v => Math.max(0, Math.ceil(v / 10000) * 10000);

export function makePlan({ pay, pension, needs, profile, finance, goals = [], risk = 'moderate' }) {
  const R = RISK[risk] || RISK.moderate;
  const net = pay.regular.net;
  const bonusNet = Math.max(0, pay.bonusNetAnnual);
  const debts = (finance.debts || []).filter(d => d.balance > 0 || d.monthly > 0);
  const debtPay = sum(debts.map(d => d.monthly));
  const living = sum(Object.values(finance.spending || {}));
  const spend = living + debtPay;
  const saving = finance.saving || {};
  const savingNow = sum(Object.values(saving));
  const free = net - spend;                 // 지출 후 남는 돈
  const unassigned = free - savingNow;      // 저축하고도 계획 없이 남는 돈 (음수면 적자)
  const savingRate = net > 0 ? savingNow / net : 0;
  const fam = profile.family || {};
  const hasDependents = !!(fam.spouse || fam.children > 0);
  const targetSavingRate = fam.children > 0 ? 0.25 : fam.spouse ? 0.35 : 0.45;

  // 1. 비상자금: 매달 지출의 3개월치 (부양가족이 있으면 6개월치)
  const efMonths = hasDependents ? 6 : 3;
  const ef = { months: efMonths, target: spend * efMonths, have: finance.assets.cash || 0 };
  ef.gap = Math.max(0, ef.target - ef.have);
  ef.ratio = ef.target > 0 ? Math.min(1, ef.have / ef.target) : 1;

  // 2. 부채: 연 6% 이상은 고금리로 먼저 갚는다
  const highDebts = debts.filter(d => d.rate >= 6 && d.balance > 0).sort((a, b) => b.rate - a.rate);
  const dsr = pay.annualGross > 0 ? (debtPay * 12) / pay.annualGross : 0;

  // 3. 연금계좌 세액공제
  const PA = RULES.pensionAccount;
  const creditRate = pay.annualTaxable <= PA.grossThreshold ? PA.rateLow : PA.rateHigh;
  const pensionNowAnnual = (saving.pension || 0) * 12;

  // 4. 노후: 공백기 + 부족분에서 퇴직수당을 뺀 금액을 연금계좌·투자로 준비
  const years = Math.max(1, profile.retireAge - profile.age);
  const realLong = (1 + R.longReturn) / (1 + INFLATION) - 1;
  const retireNeed = Math.max(0, needs.total - (pension.retirementAllowance || 0));
  const pensionAssetsFV = grow(finance.assets.pension || 0, realLong, years);
  const retireGap = Math.max(0, retireNeed - pensionAssetsFV);
  const retireMonthly = monthlyForGoal(retireGap, realLong, years);
  const currentRetireFV = pensionAssetsFV + monthlyFV(saving.pension || 0, realLong, years);
  const retireCoverage = retireNeed > 0 ? Math.min(1, currentRetireFV / retireNeed) : 1;

  // 보너스(정근수당·명절휴가비) 순액: 정근수당은 70%를 연금계좌로, 명절휴가비는 절반을 명절에 쓰고 절반을 가까운 목표로
  const seniorityNet = Math.max(0, pay.months[0].net - net);   // 1월(정근수당)
  const lunarNet = Math.max(0, pay.months[1].net - net);       // 2월(설 명절휴가비)
  const bonusToPension = Math.min(Math.floor((seniorityNet * 0.7) / 10000) * 10000 * 2, PA.annualLimit);
  const lunarToGoal = Math.floor((lunarNet * 0.5) / 10000) * 10000;   // 한 번에

  // 5. 목표 자금: 가까운 목표부터, 비상자금을 넘는 현금과 투자자산을 먼저 배정
  let lump = Math.max(0, ef.have - ef.target) + (finance.assets.invest || 0);
  const goalPlans = goals.filter(g => g.amount > 0 && g.years > 0)
    .map((g, i) => ({ ...g, order: i }))
    .sort((a, b) => a.years - b.years)
    .map((g, idx) => {
      const rate = g.years <= 3 ? 0.03 : g.years <= 7 ? 0.04 : R.longReturn;
      const pvNeed = g.amount / Math.pow(1 + rate, g.years);
      const assigned = Math.min(lump, pvNeed);
      lump -= assigned;
      // 가장 가까운 목표에는 명절휴가비 절반(연 2회)을 더한다
      const bonusMonthly = idx === 0 ? (lunarToGoal * 2) / 12 : 0;
      const remainFV = Math.max(0, g.amount - grow(assigned, rate, g.years));
      const need = monthlyForGoal(remainFV, rate, g.years);
      return { ...g, rate, assigned, bonusMonthly, monthlyNeed: Math.max(0, need - bonusMonthly) };
    });

  // 6. 월 저축 배분안 (평달 남는 돈 기준, 우선순위대로 채운다)
  const alloc = [];
  let left = Math.max(0, Math.floor(free / 10000) * 10000);
  const take = (key, label, want, product, why) => {
    const amount = Math.min(left, roundMan(want));
    if (amount <= 0) return 0;
    left -= amount;
    alloc.push({ key, label, amount, product, why });
    return amount;
  };
  if (ef.gap > 0) take('ef', '비상자금', ceilMan(ef.gap / 6), '파킹통장·CMA',
    `지출 ${efMonths}개월치(${man(ef.target)})까지 6개월 안에 채워요`);
  let extraDebt = 0, payoff = null;
  if (highDebts.length) {
    const d = highDebts[0];
    extraDebt = take('debt', `${d.name} 추가 상환`, Math.min(free * 0.3, d.balance / 12), '대출 계좌',
      `연 ${d.rate}%는 어떤 저축보다 비싸요. 갚는 만큼 확정 수익이에요`);
    payoff = payoffMonths(d.balance, d.rate / 100, d.monthly + extraDebt);
    if (payoff) payoff = { name: d.name, months: payoff, freed: d.monthly + extraDebt };
  }
  const pensionMonthlyWant = Math.min(free * 0.25, Math.max(0, (PA.annualLimit - bonusToPension) / 12));
  const pensionMonthly = take('pension', '연금저축·IRP', pensionMonthlyWant, '연금저축펀드 또는 IRP',
    `세액공제 ${pct(creditRate, 1)}를 받으면서 노후 공백기를 준비해요`);
  for (const g of goalPlans) {
    g.funded = take(`goal${g.order}`, g.name, g.monthlyNeed, g.years <= 3 ? '적금·예금' : '적립식 펀드·ETF',
      `${g.years}년 뒤 ${man(g.amount)} 목표, 연 ${pct(g.rate, 0)} 가정`);
    g.status = g.funded >= roundMan(g.monthlyNeed) - 5000 ? 'ok' : 'short';
  }
  const retireExtraWant = Math.max(0, retireMonthly - pensionMonthly - bonusToPension / 12);
  const retireExtra = take('retire', '노후 추가 적립', retireExtraWant, '장기 적립식 ETF(연금계좌 안)',
    '연금 개시 전 공백기와 생활비 부족분을 채워요');
  const invest = take('invest', '자유 투자', left, `${R.name} 자산배분 적립`, '남는 돈도 정해진 날 자동으로 굴려요');

  const totalPlanned = sum(alloc.map(a => a.amount));
  const annualPension = pensionMonthly * 12 + bonusToPension;
  const refund = Math.min(annualPension, PA.annualLimit) * creditRate;

  // 보너스(정근수당·명절휴가비) 활용
  const nearest = goalPlans[0];
  const bonusPlan = [
    { label: '1·7월 정근수당', amount: seniorityNet, use: bonusToPension > 0 ? `${man(bonusToPension / 2)}씩 연금계좌에 넣어 세액공제 한도를 채워요` : '비상자금과 목표 자금에 나눠 넣어요' },
    { label: '설·추석 명절휴가비', amount: lunarNet, use: `명절 지출에 절반을 쓰고, ${man(lunarToGoal)}은 ${nearest ? nearest.name : '목표'} 통장으로 보내요` },
  ];

  // 7. 재무 건강 점수
  const debtScore = dsr <= 0.2 ? 100 : dsr >= 0.6 ? 0 : Math.round(100 - ((dsr - 0.2) / 0.4) * 100);
  const parts = [
    { key: 'saving', name: '저축률', score: Math.round(Math.min(1, savingRate / targetSavingRate) * 100), note: `${pct(savingRate)} / 권장 ${pct(targetSavingRate)}` },
    { key: 'ef', name: '비상자금', score: Math.round(ef.ratio * 100), note: `${man(ef.have)} / ${man(ef.target)}` },
    { key: 'debt', name: '부채 부담', score: Math.max(0, debtScore - (highDebts.length ? 20 : 0)), note: `원리금 비율 ${pct(dsr)}${highDebts.length ? ' · 고금리 있음' : ''}` },
    { key: 'retire', name: '노후 준비', score: Math.round(retireCoverage * 100), note: `필요 ${man(retireNeed)} 중 ${pct(retireCoverage)}` },
    { key: 'tax', name: '절세 활용', score: Math.round(Math.min(1, pensionNowAnnual / PA.annualLimit) * 100), note: `연금계좌 연 ${man(pensionNowAnnual)} / ${man(PA.annualLimit)}` },
  ];
  const weights = { saving: 0.25, ef: 0.2, debt: 0.2, retire: 0.2, tax: 0.15 };
  const score = Math.round(sum(parts.map(p => p.score * weights[p.key])));
  const grade = score >= 80 ? '튼튼해요' : score >= 60 ? '보통이에요' : score >= 40 ? '보완이 필요해요' : '지금 손봐야 해요';

  // 8. 한 줄 진단
  let headline;
  if (free < 0) headline = `매달 ${man(-free)}씩 적자예요. 저축보다 지출 구조를 먼저 손봐야 해요.`;
  else if (unassigned >= 100000) headline = `평달 기준 ${man(unassigned)}이 계획 없이 남고 있어요. 이 돈에 이름을 붙이면 1년에 세금 ${man(refund)}을 돌려받고 목표도 앞당길 수 있어요.`;
  else if (ef.gap > 0) headline = `저축 습관은 좋아요. 비상자금 ${man(ef.gap)}을 먼저 채우면 갑작스러운 지출에도 적금을 깨지 않아도 돼요.`;
  else headline = `기본기가 잡혀 있어요. 연금계좌와 장기 투자 비중을 조금씩 늘리는 단계예요.`;

  // 9. 실행 계획
  const day = RULES.payday + 1;
  const now = [`급여일(${RULES.payday}일) 다음 날인 ${day}일로 자동이체를 몰아서 설정해요: ${alloc.filter(a => a.key !== 'debt').map(a => `${a.label} ${man(a.amount)}`).join(', ') || '저축 항목 없음'}.`];
  if (ef.gap > 0) now.push(`생활비 통장과 분리된 비상금 통장을 만들어요. 목표는 ${man(ef.target)}이에요.`);
  if (pensionMonthly > 0 && !(saving.pension > 0)) now.push('연금저축펀드 계좌를 증권사 앱에서 열어요. 공무원도 IRP에 가입할 수 있어요.');
  if (highDebts.length) now.push(`${highDebts[0].name}(연 ${highDebts[0].rate}%)는 매달 ${man(extraDebt)}씩 더 갚아요. 은행에 금리인하요구권도 신청해 보세요.`);
  const soon = [];
  if (payoff) soon.push(`${payoff.name}은 이대로면 약 ${payoff.months}개월 뒤 끝나요. 그때부터 매달 ${man(payoff.freed)}을 ${nearest ? nearest.name : '목표 자금'}으로 돌리면 목표가 빨라져요.`);
  if (unassigned >= 100000) soon.push(`3개월 동안 체크카드 한 장으로 생활비를 쓰고, 남는 ${man(unassigned)}이 실제로 저축으로 가는지 확인해요.`);
  for (const g of goalPlans.filter(x => x.status === 'short')) soon.push(`${g.name}은 지금 계획으로는 매달 ${man(g.monthlyNeed - (g.funded || 0))}이 모자라요. 기간을 늘리거나 금액을 조정해 보세요.`);
  soon.push('야간 근무 직후처럼 피곤할 때는 투자 결정을 미루고, 정해진 날 자동 적립만 해요.');
  const year = [
    `1월·7월 정근수당(각 약 ${man(seniorityNet)})과 설·추석 명절휴가비(각 약 ${man(lunarNet)})는 받기 전에 쓸 곳을 정해 둬요.`,
    `12월 전에 연금계좌 납입액을 확인해요. 연 ${man(annualPension)}을 넣으면 세액공제로 약 ${man(refund)}을 돌려받아요.`,
  ];
  if (needs.gapYears > 0) year.push(`${profile.retireAge}세 퇴직 후 ${needs.gapYears}년 동안은 연금이 없어요. 퇴직수당 약 ${man(pension.retirementAllowance)}과 연금계좌로 이 기간을 메우는 계획을 해마다 점검해요.`);

  // 10. AI에게 이어서 물어볼 질문 (개인 식별 정보 없이 숫자만)
  const aiPrompt = [
    '아래는 내 재무 상황 요약이야. 개인 식별 정보는 뺐어.',
    `- 직업: 경찰공무원 ${pay.rank.name} ${pay.step}호봉, 근무 ${pay.years}년, 근무 형태: ${profile.shiftName}`,
    `- 평달 실수령 ${man(net)}, 연간 실수령 ${man(pay.annualNet)} (정근수당·명절휴가비 포함)`,
    `- 매달 지출 ${man(spend)} (대출 상환 ${man(debtPay)} 포함), 현재 매달 저축 ${man(savingNow)}`,
    `- 현금성 자산 ${man(ef.have)}, 투자자산 ${man(finance.assets.invest || 0)}, 연금계좌 ${man(finance.assets.pension || 0)}`,
    `- 부채: ${debts.length ? debts.map(d => `${d.name} ${man(d.balance)}(연 ${d.rate}%)`).join(', ') : '없음'}`,
    `- 목표: ${goalPlans.length ? goalPlans.map(g => `${g.name} ${g.years}년 뒤 ${man(g.amount)}`).join(', ') : '없음'}`,
    `- 투자 성향: ${R.name}, 예상 공무원연금 월 ${man(pension.monthly)}(오늘 가치), ${pension.startAge}세부터`,
    '',
    '질문: (여기에 궁금한 점을 적어 주세요)',
    '조건: 특정 종목 추천 없이, 공무원 제도(공무원연금·퇴직수당·정근수당)를 고려해서 설명해 줘.',
  ].join('\n');

  return {
    headline, score, grade, parts,
    cashflow: { net, living, debtPay, spend, savingNow, free, unassigned, savingRate, targetSavingRate },
    ef, debts, highDebts, dsr,
    tax: { creditRate, annualPension, refund, bonusToPension, pensionMonthly },
    retire: { need: retireNeed, allowance: pension.retirementAllowance, gap: retireGap, monthly: retireMonthly, coverage: retireCoverage },
    goals: goalPlans,
    alloc, totalPlanned, leftover: Math.max(0, free) - totalPlanned, invest, retireExtra,
    bonusPlan, actions: { now, soon, year },
    portfolio: R,
    aiPrompt,
  };
}

// 원리금 균등으로 매달 payment씩 갚을 때 남은 개월 수 (갚을 수 없으면 null)
export function payoffMonths(balance, annualRate, payment) {
  if (balance <= 0) return 0;
  const i = annualRate / 12;
  if (payment <= balance * i) return null;
  if (i === 0) return Math.ceil(balance / payment);
  return Math.ceil(-Math.log(1 - (i * balance) / payment) / Math.log(1 + i));
}

// 매달 m씩 n년 적립했을 때 미래가치
function monthlyFV(m, r, years) {
  const n = Math.round(years * 12), i = r / 12;
  if (m <= 0 || n <= 0) return 0;
  return i === 0 ? m * n : m * ((Math.pow(1 + i, n) - 1) / i);
}
