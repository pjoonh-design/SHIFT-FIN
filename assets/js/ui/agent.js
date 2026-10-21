// 에이전트 화면: 5단계 입력 + 실시간 재무설계 리포트
import { RULES } from '../data/rules-2026.js';
import { RISK } from '../engine/plan.js';
import { man, pct, esc } from '../engine/format.js';
import { num, sel, tog, txt, ring, stack, pill, SERIES } from './dom.js';

export const STEPS = ['근무·급여', '지출', '자산·부채', '목표', '성향·노후'];
const GOAL_PRESETS = [['결혼 자금', 3000, 3], ['내 집 마련', 10000, 8], ['차 구입', 2500, 2], ['자녀 교육', 5000, 10], ['여행·자기계발', 500, 1]];

function stepBody(s, state) {
  const p = state.profile;
  if (s === 1) {
    const rank = RULES.ranks.find(r => r.id === p.rankId) || RULES.ranks[0];
    const maxStep = RULES.payTable[rank.name].length;
    return `
      <div class="fgrid">
        ${sel('profile.rankId', '계급', RULES.ranks.map(r => [r.id, r.name]))}
        ${num('profile.step', '호봉', { unit: '호봉', min: 1, max: maxStep, hint: `${rank.name}은 1~${maxStep}호봉` })}
        ${num('profile.years', '근무연수', { unit: '년', min: 0, max: 40, hint: '정근수당·가산금 기준' })}
        ${sel('profile.shiftType', '근무 형태', RULES.shiftTypes.map(t => [t.id, t.name]))}
        ${num('profile.overtimeHours', '시간외근무(추가근무)', { unit: '시간/월', min: 0, max: 200, hint: '명세서의 월 인정 시간' })}
        ${num('profile.nightHours', '야간근무 (22~06시)', { unit: '시간/월', min: 0, max: 250, hint: '근무 형태를 고르면 자동으로 채워져요' })}
        ${num('profile.holidayDays', '휴일근무', { unit: '일/월', min: 0, max: 15, step: 0.5 })}
        ${num('profile.otherAllowance', '기타 수당', { unit: '만원/월', min: 0, step: 1, hint: '112 출동·특수업무 등' })}
        ${tog('profile.hazard', '위험근무수당 받음', { full: true })}
        ${num('profile.performanceBonus', '성과상여금', { unit: '만원/년', min: 0, step: 10 })}
        ${num('profile.otherDeduction', '기타 공제', { unit: '만원/월', min: 0, step: 1, hint: '공제회비·노조비 등' })}
        ${tog('profile.family.spouse', '배우자 있음')}
        ${p.family.spouse ? tog('profile.family.spouseNoIncome', '배우자 소득 없음') : '<span></span>'}
        ${num('profile.family.children', '자녀 수', { unit: '명', min: 0, max: 6 })}
        ${num('profile.family.otherDependents', '그 밖의 부양가족', { unit: '명', min: 0, max: 4 })}
        ${num('profile.birthYear', '출생연도', { unit: '년', min: 1960, max: 2006 })}
        ${num('profile.hireYear', '임용연도', { unit: '년', min: 1980, max: 2030 })}
      </div>`;
  }
  if (s === 2) {
    return `
      <p class="sub">한 달에 나가는 돈을 넣어 주세요. 대출 상환은 다음 단계에서 따로 받아요.</p>
      <div class="fgrid">
        ${num('finance.spending.housing', '주거 (월세·관리비)', { unit: '만원' })}
        ${num('finance.spending.insurance', '보험료', { unit: '만원' })}
        ${num('finance.spending.transport', '통신·교통', { unit: '만원' })}
        ${num('finance.spending.living', '식비·생활비', { unit: '만원' })}
        ${num('finance.spending.other', '경조사·취미·기타', { unit: '만원', full: true })}
      </div>`;
  }
  if (s === 3) {
    const debts = state.finance.debts;
    return `
      <p class="group-label">지금 매달 하는 저축</p>
      <div class="fgrid">
        ${num('finance.saving.deposit', '예·적금', { unit: '만원/월' })}
        ${num('finance.saving.invest', '투자 적립', { unit: '만원/월' })}
        ${num('finance.saving.pension', '연금저축·IRP', { unit: '만원/월' })}
        ${num('finance.saving.subscription', '주택청약', { unit: '만원/월' })}
      </div>
      <p class="group-label">지금 가진 돈</p>
      <div class="fgrid">
        ${num('finance.assets.cash', '예금·파킹통장', { unit: '만원', hint: '바로 꺼낼 수 있는 돈' })}
        ${num('finance.assets.invest', '투자자산', { unit: '만원', hint: '주식·펀드·ETF' })}
        ${num('finance.assets.pension', '연금계좌 잔액', { unit: '만원' })}
        ${num('finance.assets.subscription', '청약 잔액', { unit: '만원' })}
        ${num('finance.assets.housingDeposit', '보증금·집', { unit: '만원', full: true })}
      </div>
      <p class="group-label">빚</p>
      <div class="rows">
        ${debts.map((d, i) => `<div class="row-item">
          ${txt(`finance.debts.${i}.name`, '이름', { placeholder: '신용대출' })}
          ${num(`finance.debts.${i}.balance`, '남은 금액', { unit: '만원' })}
          ${num(`finance.debts.${i}.rate`, '금리', { unit: '%', step: 0.1 })}
          ${num(`finance.debts.${i}.monthly`, '월 상환', { unit: '만원' })}
          <button type="button" class="icon-btn" data-action="remove-debt" data-index="${i}" aria-label="${esc(d.name || '빚')} 지우기">×</button>
        </div>`).join('')}
        ${debts.length < 4 ? '<button type="button" class="btn btn-ghost" data-action="add-debt">+ 빚 추가</button>' : ''}
      </div>`;
  }
  if (s === 4) {
    const goals = state.goals;
    return `
      <p class="sub">모으고 싶은 돈과 기간을 적어 주세요. 가까운 목표부터 채워요.</p>
      <div class="chip-row">${GOAL_PRESETS.map(([n, a, y]) => `<button type="button" class="chip" data-action="add-goal" data-name="${esc(n)}" data-amount="${a}" data-years="${y}">+ ${esc(n)}</button>`).join('')}</div>
      <div class="rows">
        ${goals.map((g, i) => `<div class="row-item goal">
          ${txt(`goals.${i}.name`, '목표', { placeholder: '결혼 자금' })}
          ${num(`goals.${i}.amount`, '금액', { unit: '만원', step: 100 })}
          ${num(`goals.${i}.years`, '기간', { unit: '년', min: 1, max: 40 })}
          <button type="button" class="icon-btn" data-action="remove-goal" data-index="${i}" aria-label="${esc(g.name || '목표')} 지우기">×</button>
        </div>`).join('')}
        ${goals.length < 4 ? '<button type="button" class="btn btn-ghost" data-action="add-goal">+ 목표 추가</button>' : ''}
      </div>`;
  }
  return `
    <p class="group-label">투자 성향</p>
    <div class="choice" role="radiogroup" aria-label="투자 성향">
      ${Object.entries(RISK).map(([k, r]) => `<button type="button" role="radio" data-radio="risk" data-value="${k}" aria-checked="${state.risk === k}"><b>${r.name}</b><span>${{ stable: '원금이 줄어드는 게 가장 싫어요', moderate: '조금 흔들려도 물가보다는 불리고 싶어요', aggressive: '10년 이상 묻어 둘 돈이라 변동은 괜찮아요' }[k]}</span></button>`).join('')}
    </div>
    <div class="fgrid">
      ${num('profile.targetSpend', '은퇴 후 월 생활비 목표', { unit: '만원', step: 10, hint: '참고: 적정 350만원 · 최소 248만원 (KB금융 2025 설문)' })}
      ${num('profile.retireAge', '퇴직 나이', { unit: '세', min: 45, max: 65, hint: '경찰 연령정년 60세' })}
    </div>`;
}

export function renderForm(state, preview) {
  const s = state.step;
  return `<div class="card">
    <div class="card-head"><h2>내 정보</h2><span class="note">${s} / 5 단계</span></div>
    <ol class="steps">${STEPS.map((name, i) => `<li><button type="button" data-action="step" data-step="${i + 1}"${s === i + 1 ? ' aria-current="step"' : ''}${i + 1 < s ? ' class="done"' : ''}><b>${i + 1}</b><span>${name}</span></button></li>`).join('')}</ol>
    <h3>${STEPS[s - 1]}</h3>
    ${stepBody(s, state)}
    <p class="sub" id="agent-preview">${preview}</p>
    <div class="step-nav">
      <button type="button" class="btn btn-ghost" data-action="step" data-step="${s - 1}"${s === 1 ? ' disabled' : ''}>이전</button>
      ${s < 5 ? `<button type="button" class="btn btn-primary" data-action="step" data-step="${s + 1}">다음: ${STEPS[s]}</button>`
    : '<button type="button" class="btn btn-primary" data-action="to-report">리포트 보기</button>'}
    </div>
  </div>`;
}

export function previewLine(state, R) {
  const { pay, plan } = R;
  if (state.step === 1) return `→ 평달 실수령 <strong>${man(pay.regular.net)}</strong> · 연 실수령 ${man(pay.annualNet)}`;
  if (state.step === 2 || state.step === 3) return `→ 매달 지출 <strong>${man(plan.cashflow.spend)}</strong> · 지출 후 남는 돈 ${man(plan.cashflow.free)}`;
  if (state.step === 4) return `→ 목표에 필요한 돈 매달 <strong>${man(plan.goals.reduce((s, g) => s + g.monthlyNeed, 0))}</strong>`;
  return `→ 재무 건강 점수 <strong>${plan.score}점</strong> · ${plan.grade}`;
}

const li = arr => arr.map(t => `<li><span>${esc(t)}</span></li>`).join('');

export function renderReport(R) {
  const { pay, plan, pension, needs } = R;
  const cf = plan.cashflow;
  const allocParts = plan.alloc.map((a, i) => ({ label: a.label, value: a.amount, color: SERIES[i % SERIES.length] }));
  const partCls = v => (v >= 80 ? 'good' : v < 40 ? 'low' : '');

  return `
  <div class="card">
    <div class="score-head">
      ${ring(plan.score, '재무 건강 점수')}
      <div class="col" style="gap:4px"><p class="eyebrow">재무 건강 점수 · ${esc(plan.grade)}</p><p class="headline">${esc(plan.headline)}</p></div>
    </div>
    <div class="kpis">
      <div class="kpi"><span>평달 실수령</span><strong>${man(cf.net)}</strong></div>
      <div class="kpi"><span>지출 후 남는 돈</span><strong>${man(cf.free)}</strong></div>
      <div class="kpi"><span>세액공제 환급</span><strong>연 ${man(plan.tax.refund)}</strong></div>
    </div>
  </div>

  <div class="card">
    <div class="card-head"><h2>이번 달 할 일</h2>${pill('pill-accent', '에이전트 제안')}</div>
    <ul class="actions">${li(plan.actions.now)}</ul>
  </div>

  <div class="card">
    <div class="card-head"><h2>월 저축 배분안</h2><span class="note">평달 남는 돈 ${man(Math.max(0, cf.free))} 기준</span></div>
    ${plan.alloc.length ? stack(allocParts) : ''}
    <div class="alloc">
      ${plan.alloc.map((a, i) => `<div class="alloc-row"><i class="sw" style="background:${SERIES[i % SERIES.length]}"></i><b>${esc(a.label)}</b><strong>${man(a.amount)}</strong><small>${esc(a.product)} · ${esc(a.why)}</small></div>`).join('')
      || (cf.free < 0
        ? `<p class="warn">지출이 실수령보다 ${man(-cf.free)} 많아요. 지출 단계에서 줄일 항목부터 찾아봐요.</p>`
        : '<p class="note">지출하고 남는 돈이 1만원이 안 돼요. 지출을 조금 줄이면 저축 계획을 세울 수 있어요.</p>')}
      ${plan.alloc.length ? `<div class="alloc-row total"><span></span><b>합계</b><strong>${man(plan.totalPlanned)}</strong></div>` : ''}
    </div>
    <p class="note">지금은 매달 ${man(cf.savingNow)}을 저축하고 있어요(실수령의 ${pct(cf.savingRate)}). 제안대로면 매달 ${man(plan.totalPlanned)}이 이름을 갖게 돼요.</p>
  </div>

  <div class="card">
    <div class="card-head"><h2>보너스 달 활용</h2><span class="note">평달보다 더 받는 순액</span></div>
    <div class="alloc">${plan.bonusPlan.map(b => `<div class="alloc-row"><span></span><b>${esc(b.label)}</b><strong>+${man(b.amount)}</strong><small>${esc(b.use)}</small></div>`).join('')}</div>
  </div>

  <div class="card">
    <h2>진단 5가지</h2>
    <div class="parts">${plan.parts.map(p => `<div class="part"><span>${esc(p.name)}</span><div class="bar"><i class="${partCls(p.score)}" style="width:${p.score}%"></i></div><strong>${p.score}</strong><small>${esc(p.note)}</small></div>`).join('')}</div>
  </div>

  ${plan.goals.length ? `<div class="card">
    <h2>목표별 진단</h2>
    ${plan.goals.map(g => `<div class="goal-item">
      <div class="top"><b>${esc(g.name)}</b>${g.status === 'ok' ? pill('pill-good', '✓ 계획대로 가능') : pill('pill-caution', '! 매달 ' + man(Math.max(0, g.monthlyNeed - (g.funded || 0))) + ' 부족')}</div>
      <p class="sub">${g.years}년 뒤 ${man(g.amount)} · 매달 ${man(g.monthlyNeed)} 필요${g.assigned > 0 ? ` · 지금 있는 돈 ${man(g.assigned)} 배정` : ''}${g.bonusMonthly > 0 ? ' · 명절휴가비 일부 포함' : ''}</p>
    </div>`).join('')}
  </div>` : ''}

  <div class="card">
    <div class="card-head"><h2>노후 준비</h2><button type="button" class="btn btn-sm" data-goto="retire">자세히 보기</button></div>
    <dl class="dl">
      <dt>예상 공무원연금 (오늘 가치)</dt><dd>${pension.eligible ? `월 ${man(pension.monthly)}` : '일시금 대상'}</dd>
      <dt>연금 시작</dt><dd>${pension.startAge}세</dd>
      <dt>퇴직 후 소득 공백</dt><dd>${needs.gapYears}년</dd>
      <dt>퇴직수당 (개략)</dt><dd>${man(pension.retirementAllowance)}</dd>
      <dt>더 준비할 돈 (퇴직수당 뺀 뒤)</dt><dd>${man(plan.retire.need)}</dd>
      <dt>매달 준비해야 할 돈</dt><dd>${man(plan.retire.monthly)}</dd>
    </dl>
  </div>

  <div class="card">
    <h2>앞으로의 계획</h2>
    <p class="when">3개월 안에</p><ul class="actions">${li(plan.actions.soon)}</ul>
    <p class="when">올해 안에</p><ul class="actions">${li(plan.actions.year)}</ul>
  </div>

  <div class="card">
    <div class="card-head"><h2>투자 성향별 자산배분</h2>${pill('pill-accent', plan.portfolio.name)}</div>
    ${stack(plan.portfolio.mix.map(([l, v], i) => ({ label: l, value: v, color: SERIES[i] })))}
    <ul class="legend">${plan.portfolio.mix.map(([l, v], i) => `<li><i class="sw" style="background:${SERIES[i]}"></i>${esc(l)} ${v}%</li>`).join('')}</ul>
    <p class="note">10년 이상 굴릴 돈에 대한 교육용 예시예요. 특정 상품이나 종목을 권하는 게 아니에요. 지수형 상품을 정해진 날 나눠 사는 방식을 기본으로 봤어요.</p>
  </div>

  <div class="card">
    <h2>AI에게 이어서 물어보기</h2>
    <p class="sub">아래 요약을 복사해서 ChatKHU 같은 AI에 붙여 넣고 궁금한 점을 이어서 물어보세요. 이름·연락처 같은 개인 정보는 들어 있지 않아요.</p>
    <textarea class="prompt" id="ai-prompt" readonly aria-label="AI 질문 요약">${esc(plan.aiPrompt)}</textarea>
    <div class="chip-row"><button type="button" class="btn" data-action="copy-prompt">요약 복사하기</button><span class="note" id="copy-status" aria-live="polite"></span></div>
  </div>`;
}
