// 노후 화면: 공무원연금·퇴직수당·소득 공백·필요한 돈
import { man, pct, esc } from '../engine/format.js';
import { retirementAllowanceRate } from '../engine/pension.js';
import { num } from './dom.js';

export function renderRetireResults(state, R) {
  const { pension: P, needs: N, plan, age, pay } = R;
  const p = { ...state.profile, retireAge: R.retireAge };
  const end = 90;
  const segs = [];
  if (p.retireAge > age) segs.push({ cls: 'tl-work', from: age, to: p.retireAge, label: '근무' });
  if (P.startAge > p.retireAge) segs.push({ cls: 'tl-gap', from: Math.max(p.retireAge, age), to: P.startAge, label: '소득 공백' });
  const pFrom = Math.max(P.startAge, p.retireAge, age);
  if (end > pFrom) segs.push({ cls: 'tl-pen', from: pFrom, to: end, label: '연금' });
  const first = segs.length ? segs[0].from : age, span = Math.max(1, end - first);
  const marks = [first, ...segs.map(s => s.to)];
  let lastPos = -100;
  const ages = marks.map((a, i) => {
    const pos = ((a - first) / span) * 100, isLast = i === marks.length - 1;
    if (!isLast && i > 0 && (pos - lastPos < 9 || 100 - pos < 9)) return '';
    lastPos = pos;
    return `<span class="${i === 0 ? 'first' : isLast ? 'last' : ''}" style="left:${pos}%">${a}세</span>`;
  }).join('');
  const color = { 'tl-work': 'var(--shift)', 'tl-gap': 'var(--caution)', 'tl-pen': 'var(--accent)' };
  const warn = [];
  if (p.hireYear >= P.retireYear) warn.push(`임용연도(${p.hireYear}년)가 퇴직하는 해(${P.retireYear}년)보다 앞서야 해요.`);
  if (p.retireAge <= age) warn.push(`퇴직 나이(${p.retireAge}세)가 지금 나이(${age}세)보다 커야 해요.`);

  return `
      ${warn.length ? `<p class="warn">${esc(warn.join(' '))}</p>` : ''}
      <div class="card">
        <p class="eyebrow">예상 공무원연금 · 오늘 돈 가치</p>
        <p class="hero-num">${P.eligible ? `월 ${man(P.monthly)}` : '일시금 대상'}</p>
        <p class="sub">${P.eligible ? `${P.startAge}세부터 · 재직 ${P.serviceYears}년 · 재직 기간 평균소득의 ${pct(P.replacementAvg)}` : `재직 ${P.serviceYears}년 · 10년 미만이면 연금 대신 일시금을 받아요`}</p>
        <div class="pillrow">
          ${N.gapYears > 0 ? `<span class="pill pill-caution">! 소득 공백 ${N.gapYears}년</span>` : '<span class="pill pill-good">✓ 퇴직하자마자 연금 시작</span>'}
          ${N.shortfall > 0 ? `<span class="pill pill-caution">! 연금이 매달 ${man(N.shortfall)} 부족</span>` : '<span class="pill pill-good">✓ 목표 생활비를 연금으로 충당</span>'}
        </div>
        <div><div class="timeline" aria-hidden="true">${segs.map(s => `<div class="tl-seg ${s.cls}" style="flex:${s.to - s.from}"></div>`).join('')}</div><div class="tl-ages" aria-hidden="true">${ages}</div></div>
        <ul class="tl-legend">${segs.map(s => `<li><i class="sw" style="background:${color[s.cls]}"></i>${s.label} ${s.from}→${s.to}세 · ${s.to - s.from}년</li>`).join('')}</ul>
      </div>
      <div class="card">
        <h2>노후에 필요한 돈 · 오늘 돈 가치</h2>
        <div>
          <div class="need-row"><span>${N.gapYears > 0 ? `소득 공백 ${N.gapYears}년 (${p.retireAge}→${P.startAge}세)` : '소득 공백'}</span><strong>${man(N.gapNeed)}</strong><small>${N.gapYears > 0 ? `월 ${man(p.targetSpend * 10000)} × 12개월 × ${N.gapYears}년` : '퇴직하는 해에 바로 연금이 시작돼요'}</small></div>
          <div class="need-row"><span>연금 시작 후 부족분 (${N.from}→${end}세)</span><strong>${man(N.afterNeed)}</strong><small>${N.shortfall > 0 ? `매달 ${man(N.shortfall)} × 12개월 × ${N.afterYears}년` : '연금이 목표 생활비 이상이에요'}</small></div>
          <div class="need-row"><span>퇴직수당으로 메우는 돈 (개략)</span><strong>−${man(P.retirementAllowance)}</strong><small>평균 기준소득월액 × 재직 ${Math.min(P.serviceYears, 33)}년(최대 33년) × ${(retirementAllowanceRate(P.serviceYears) * 100).toFixed(2).replace(/\.?0+$/, '')}%</small></div>
          <div class="need-row total"><span>더 준비할 돈</span><strong>${man(plan.retire.need)}</strong><small>퇴직까지 매달 ${man(plan.retire.monthly)}씩 모으면 돼요 (${esc(plan.portfolio.name)} 실질수익률 가정)</small></div>
        </div>
        <p class="note">은퇴 후에는 수익률 0%(오늘 가치 유지)로 단순 계산했어요. 연금은 물가에 맞춰 오르니 오늘 돈 가치로 그대로 봤어요.</p>
      </div>
      <div class="card">
        <h2>계산에 쓰인 숫자</h2>
        <dl class="dl">
          <dt>지금 매달 내는 기여금 (9%)</dt><dd>${man(pay.deductions.pension)}</dd>
          <dt>기준소득월액 (급여명세에서 자동)</dt><dd>${man(pay.standardIncome)}</dd>
          <dt>재직 기간</dt><dd>${P.serviceYears}년${P.capped ? ' (계산은 36년까지)' : ''}</dd>
          <dt>적용 지급률 합계</dt><dd>${P.rateSum.toFixed(1)}%</dd>
          <dt>평균기준소득월액 (오늘 가치)</dt><dd>${man(P.avgIncome)}</dd>
          <dt>퇴직 직전 소득 대비 연금</dt><dd>${pct(P.replacementFinal)}</dd>
        </dl>
      </div>
`;
}

export function renderRetireForm() {
  return `
      <div class="card">
        <h2>노후 계산 정보</h2>
        <div class="fgrid">
          ${num('profile.birthYear', '출생연도', { unit: '년', min: 1960, max: 2006, prefix: 'r' })}
          ${num('profile.hireYear', '임용연도', { unit: '년', min: 1980, max: 2030, prefix: 'r' })}
          ${num('profile.retireAge', '퇴직 나이', { unit: '세', min: 45, max: 65, prefix: 'r', hint: '경찰 연령정년 60세' })}
          ${num('profile.realGrowth', '소득이 물가보다 더 오르는 정도', { unit: '%/년', min: -2, max: 6, step: 0.1, prefix: 'r', hint: '호봉 승급·승진 효과, 기본 2%' })}
          ${num('profile.targetSpend', '은퇴 후 월 생활비 목표', { unit: '만원', step: 10, prefix: 'r', full: true, hint: '참고: 적정 350만원 · 최소 248만원 (KB금융 2025 설문)' })}
        </div>
      </div>
      <div class="card caveat">
        <h2>개략 추정이에요</h2>
        <ul>
          <li>지급률은 연도별(2016년 1.878% → 2035년 1.7%)로 더했어요. 2015년 이전 재직분은 1.9%로 단순화했어요.</li>
          <li>2016년 이후 재직분 지급률 1% 부분의 소득재분배는 빠져 있어요. 평균보다 소득이 낮으면 실제 연금이 조금 더 많고, 높으면 조금 적어요.</li>
          <li>퇴직수당은 공무원연금법 제62조 산식에 평균 기준소득월액을 넣은 개략값이에요.</li>
          <li>정확한 금액은 <a href="https://www.geps.or.kr" target="_blank" rel="noopener">공무원연금공단</a> 연금 모의계산으로 확인하세요.</li>
        </ul>
      </div>
`;
}
