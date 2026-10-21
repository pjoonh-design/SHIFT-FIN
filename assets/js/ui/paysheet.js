// 급여명세 화면: 달마다 받는 돈, 지급·공제 항목, 수당 단가
import { RULES } from '../data/rules-2026.js';
import { won, man, manShort, pct, esc } from '../engine/format.js';

const VIEWS = [['regular', '평달'], ['1', '1·7월 (정근수당)'], ['2', '설·추석 달'], ['annual', '연간']];

function monthView(pay, key) {
  if (key === 'annual') return null;
  return key === 'regular' ? pay.regular : pay.months[Number(key) - 1];
}

export function renderPay(state, R) {
  const { pay } = R;
  const view = VIEWS.some(v => v[0] === state.payMonth) ? state.payMonth : 'regular';
  const m = monthView(pay, view);
  const shiftName = (RULES.shiftTypes.find(t => t.id === state.profile.shiftType) || {}).name || '';
  const D = pay.deductions;

  let head, body;
  if (m) {
    const extraRows = m.extras.map(e => `<tr class="extra"><td>${esc(e.name)}<small>${e.name === '정근수당' ? `봉급의 ${pct(pay.seniorityRate)}` : e.name.startsWith('명절') ? '봉급의 60%' : '연 1회'}</small></td><td>${won(e.amount)}</td></tr>`).join('');
    head = `<p class="eyebrow">${VIEWS.find(v => v[0] === view)[1]} 실수령</p>
      <p class="hero-num">${won(m.net)}</p>
      <p class="sub">지급 ${won(m.gross)} − 공제 ${won(m.deduction)}</p>`;
    body = `
      <div class="tbl-wrap"><table class="ps"><thead><tr><th>지급 항목</th><th>금액</th></tr></thead><tbody>
        ${pay.items.filter(i => i.amount > 0 || ['base', 'meal'].includes(i.key)).map(i => `<tr><td>${esc(i.name)}<small>${esc(i.note || '')}</small></td><td>${won(i.amount)}</td></tr>`).join('')}
        ${extraRows}
        <tr class="sum"><td>지급 합계</td><td>${won(m.gross)}</td></tr>
      </tbody></table></div>
      <div class="tbl-wrap"><table class="ps"><thead><tr><th>공제 항목</th><th>금액</th></tr></thead><tbody>
        <tr><td>일반기여금 (공무원연금)<small>기준소득월액 ${won(pay.standardIncome)} × 9%</small></td><td>${won(D.pension)}</td></tr>
        <tr><td>건강보험<small>7.19%의 절반</small></td><td>${won(D.health)}</td></tr>
        <tr><td>장기요양보험<small>0.9448%의 절반</small></td><td>${won(D.ltc)}</td></tr>
        <tr><td>소득세<small>간이세액 근사, 공제대상 ${pay.dependents}명</small></td><td>${won(m.incomeTax)}</td></tr>
        <tr><td>지방소득세<small>소득세의 10%</small></td><td>${won(m.localTax)}</td></tr>
        ${D.other ? `<tr><td>기타 공제</td><td>${won(D.other)}</td></tr>` : ''}
        <tr class="sum"><td>공제 합계</td><td>${won(m.deduction)}</td></tr>
      </tbody></table></div>`;
  } else {
    const deductTotal = pay.annualGross - pay.annualNet;
    head = `<p class="eyebrow">연간 실수령 (2026년 기준)</p>
      <p class="hero-num">${man(pay.annualNet)}</p>
      <p class="sub">한 달 평균 ${man(pay.avgMonthlyNet)} · 연봉(세전) ${man(pay.annualGross)}</p>`;
    body = `<div class="tbl-wrap"><table class="ps"><tbody>
      <tr><td>평달 지급 × 12개월</td><td>${won(pay.regularGross * 12)}</td></tr>
      <tr><td>정근수당 × 2회<small>1월·7월, 봉급의 ${pct(pay.seniorityRate)}</small></td><td>${won(pay.seniorityPay * 2)}</td></tr>
      <tr><td>명절휴가비 × 2회<small>설·추석, 봉급의 60%</small></td><td>${won(pay.holidayBonus * 2)}</td></tr>
      ${pay.performance ? `<tr><td>성과상여금</td><td>${won(pay.performance)}</td></tr>` : ''}
      <tr class="sum"><td>연 지급 합계</td><td>${won(pay.annualGross)}</td></tr>
      <tr><td>연 공제 합계<small>기여금·보험료·세금</small></td><td>−${won(deductTotal)}</td></tr>
      <tr class="sum"><td>연 실수령</td><td>${won(pay.annualNet)}</td></tr>
      <tr><td>연말정산 기준 연 소득세<small>자녀세액공제 등은 빠진 근사치</small></td><td>${won(pay.yearEnd.determined)}</td></tr>
    </tbody></table></div>`;
  }

  return `<div class="split rev">
    <div class="col">
      <div class="card">
        <div class="card-head"><h2>${esc(pay.rank.name)} ${pay.step}호봉 · ${esc(shiftName)}</h2><button type="button" class="btn btn-sm" data-goto="agent" data-step="1">근무·수당 바꾸기</button></div>
        <div class="chip-row" role="radiogroup" aria-label="보기">${VIEWS.map(([k, l]) => `<button type="button" class="chip" role="radio" data-action="pay-month" data-month="${k}" aria-pressed="${k === view}" aria-checked="${k === view}">${l}</button>`).join('')}</div>
        ${head}
        ${body}
      </div>
    </div>
    <div class="col">
      <div class="card">
        <h2>달마다 받는 돈</h2>
        <ul class="legend"><li><i class="sw" style="background:var(--c1)"></i>평달</li><li><i class="sw" style="background:var(--c4)"></i>정근수당·명절휴가비 달</li></ul>
        <div class="colchart" id="pay-chart"></div>
        <p class="note">세후 실수령 기준이에요. 정근수당은 1월·7월, 명절휴가비는 설·추석이 든 달(2026년 2월·9월)에 나와요.</p>
      </div>
      <div class="card">
        <h2>수당 단가</h2>
        <dl class="dl">
          <dt>봉급기준액</dt><dd>${won(pay.salaryBase)}</dd>
          <dt>시간외근무 1시간</dt><dd>${won(pay.rates.overtime)}</dd>
          <dt>야간근무 1시간 (22~06시)</dt><dd>${won(pay.rates.night)}</dd>
          <dt>휴일근무 1일</dt><dd>${won(pay.rates.holiday)}</dd>
          <dt>정근수당 (1·7월)</dt><dd>봉급의 ${pct(pay.seniorityRate)}</dd>
        </dl>
        <p class="note">봉급기준액은 ${esc(pay.rank.name)} ${pay.rank.overtimeBaseStep}호봉 봉급의 ${pct(pay.rank.overtimeRatio)}예요. 시간외는 ÷209×150%, 야간은 ÷209×50%, 휴일은 ÷26×150%로 계산해요.</p>
        ${pay.overtimeOverCap ? `<p class="warn">일반 근무명령의 시간외근무는 월 ${RULES.allowances.overtimeMonthlyCap}시간이 상한이에요. 현업·재난 대응은 예외라 명세서 시간을 그대로 넣으면 돼요.</p>` : ''}
      </div>
      <div class="card caveat">
        <h2>이렇게 계산했어요</h2>
        <ul>
          <li>봉급은 공무원보수규정 별표 10(2026년 1월 2일 개정) 경찰공무원 봉급표를 그대로 썼어요.</li>
          <li>소득세는 그 달 과세급여로 1년치 세금을 계산해 12로 나눈 근사치예요. 실제 간이세액표·연말정산과 조금 다를 수 있어요.</li>
          <li>기여금·건강보험료는 연 과세소득 ÷ 12를 기준소득월액·보수월액으로 봤어요. 실제로는 전년도 소득을 기준으로 정해요.</li>
          <li>맞춤형 복지포인트는 현금 급여가 아니라 빠져 있어요.</li>
          <li>명세서와 차이가 크면 시간외·야간 시간과 기타 수당을 명세서대로 고쳐 주세요.</li>
        </ul>
      </div>
    </div>
  </div>`;
}

// 12개월 실수령 막대 차트 (단일 지표, 보너스 달만 색으로 구분)
export function drawPayChart(box, pay) {
  if (!box || box.offsetParent === null) return;
  const w = Math.max(280, Math.floor(box.clientWidth)), h = 200;
  const M = { t: 16, r: 8, b: 24, l: 40 };
  const iw = w - M.l - M.r, ih = h - M.t - M.b;
  const vals = pay.months.map(x => x.net);
  const max = Math.max(...vals);
  const stepV = niceStep(max / 4);
  const top = Math.ceil(max / stepV) * stepV;
  const Y = v => M.t + ih - (v / top) * ih;
  const band = iw / 12, bw = Math.min(24, band * 0.62);
  let svg = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="월별 실수령 막대 그래프">`;
  for (let v = 0; v <= top + 1; v += stepV) {
    svg += `<line class="c-grid" x1="${M.l}" x2="${w - M.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"></line>`;
    svg += `<text class="c-tick" x="${M.l - 6}" y="${Y(v).toFixed(1)}" text-anchor="end" dominant-baseline="central">${manShort(v)}</text>`;
  }
  pay.months.forEach((mo, i) => {
    const x = M.l + band * i + (band - bw) / 2, y = Y(mo.net), bh = M.t + ih - y;
    const r = Math.min(4, bh);
    const d = `M${x} ${M.t + ih} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + bw - r} Q${x + bw} ${y} ${x + bw} ${y + r} V${M.t + ih} Z`;
    svg += `<path class="c-bar${mo.extras.length ? ' bonus' : ''}" d="${d}" tabindex="0" data-i="${i}" aria-label="${mo.month}월 ${man(mo.net)}"></path>`;
    svg += `<text class="c-tick" x="${(x + bw / 2).toFixed(1)}" y="${h - 6}" text-anchor="middle">${mo.month}</text>`;
  });
  svg += '</svg>';
  box.innerHTML = svg;
  const tip = document.createElement('div');
  tip.className = 'tip'; tip.hidden = true;
  box.appendChild(tip);
  const show = el => {
    const mo = pay.months[Number(el.dataset.i)];
    tip.replaceChildren();
    const s = document.createElement('span'); s.textContent = `${mo.month}월${mo.extras.length ? ' · ' + mo.extras.map(e => e.name).join(', ') : ''}`;
    const v = document.createElement('strong'); v.textContent = won(mo.net);
    tip.append(s, v);
    tip.hidden = false;
    const bb = el.getBBox();
    const left = Math.min(w - tip.offsetWidth, Math.max(0, bb.x + bb.width / 2 - tip.offsetWidth / 2));
    tip.style.left = left + 'px';
    tip.style.top = Math.max(0, bb.y - tip.offsetHeight - 8) + 'px';
  };
  box.querySelectorAll('.c-bar').forEach(el => {
    el.addEventListener('pointerenter', () => show(el));
    el.addEventListener('focus', () => show(el));
    el.addEventListener('pointerleave', () => { tip.hidden = true; });
    el.addEventListener('blur', () => { tip.hidden = true; });
  });
}

function niceStep(raw) {
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  return [1, 2, 2.5, 5, 10].map(s => s * mag).find(s => s >= raw);
}
