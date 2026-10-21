// SHIFT-FIN 앱: 상태 → 계산 → 화면
import { RULES } from './data/rules-2026.js';
import { computePay } from './engine/pay.js';
import { govPension, retirementNeeds } from './engine/pension.js';
import { makePlan } from './engine/plan.js';
import { seoulYear } from './engine/market.js';
import { toWon, clamp } from './engine/format.js';
import { loadState, saveState, freshState, getPath, setPath } from './state.js';
import { renderForm, renderReport, previewLine } from './ui/agent.js';
import { renderPay, drawPayChart } from './ui/paysheet.js';
import { drawTicks, renderClock, mountWidgets, loadLive } from './ui/tonight.js';
import { renderRetireResults, renderRetireForm } from './ui/retire.js';

const TABS = ['agent', 'pay', 'tonight', 'retire'];
const $ = s => document.querySelector(s);
let state = loadState();
let R = null;

// ---------- 계산 ----------
function compute(s) {
  const p = s.profile;
  const rank = RULES.ranks.find(r => r.id === p.rankId) || RULES.ranks[0];
  const n = (v, lo, hi, d = 0) => clamp(Number.isFinite(+v) ? +v : d, lo, hi);
  const year = seoulYear(Date.now());
  const birthYear = n(p.birthYear, 1950, 2008, 1995);
  const retireAge = n(p.retireAge, 45, 65, 60);
  const fam = {
    spouse: !!p.family.spouse, spouseNoIncome: !!(p.family.spouse && p.family.spouseNoIncome),
    children: n(p.family.children, 0, 6), otherDependents: n(p.family.otherDependents, 0, 4),
  };
  const pay = computePay({
    rankId: rank.id, step: n(p.step, 1, RULES.payTable[rank.name].length, 1), years: n(p.years, 0, 45),
    hazard: !!p.hazard, overtimeHours: n(p.overtimeHours, 0, 250), nightHours: n(p.nightHours, 0, 300),
    holidayDays: n(p.holidayDays, 0, 20), otherAllowance: toWon(n(p.otherAllowance, 0, 500)),
    performanceBonus: toWon(n(p.performanceBonus, 0, 2000)), otherDeduction: toWon(n(p.otherDeduction, 0, 300)),
    family: fam,
  });
  const pension = govPension({
    birthYear, hireYear: n(p.hireYear, 1975, 2035, 2021), retireAge,
    monthlyIncome: pay.standardIncome, realGrowth: n(p.realGrowth, -2, 6, 2), thisYear: year,
  });
  const needs = retirementNeeds({ retireAge, startAge: pension.startAge, targetMonthly: toWon(n(p.targetSpend, 0, 2000, 350)), pensionMonthly: pension.monthly, planToAge: 90 });
  const wonObj = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, toWon(Math.max(0, +v || 0))]));
  const f = s.finance;
  const finance = {
    spending: wonObj(f.spending), saving: wonObj(f.saving), assets: wonObj(f.assets),
    debts: f.debts.map(d => ({ name: (d.name || '대출').trim() || '대출', balance: toWon(Math.max(0, +d.balance || 0)), rate: clamp(+d.rate || 0, 0, 30), monthly: toWon(Math.max(0, +d.monthly || 0)) })),
  };
  const goals = s.goals.map(g => ({ name: (g.name || '목표').trim() || '목표', amount: toWon(Math.max(0, +g.amount || 0)), years: clamp(+g.years || 0, 0, 40) }));
  const age = year - birthYear;
  const shiftName = (RULES.shiftTypes.find(t => t.id === p.shiftType) || {}).name || '';
  const plan = makePlan({ pay, pension, needs, profile: { age, retireAge, family: fam, shiftName }, finance, goals, risk: s.risk });
  return { pay, pension, needs, plan, age, year, retireAge };
}

// ---------- 그리기 ----------
function syncInputs() {
  document.querySelectorAll('[data-path]').forEach(el => {
    if (el === document.activeElement) return;
    const v = getPath(state, el.dataset.path);
    if (el.dataset.kind === 'bool') el.checked = !!v;
    else el.value = v ?? '';
  });
}

function renderBanner() {
  $('#banner-text').textContent = state.isExample
    ? '예시 값으로 채워져 있어요: 1995년생 경장 7호봉, 4조 2교대, 시간외 30시간, 미혼. 내 정보로 바꾸면 이 기기 브라우저에만 저장돼요.'
    : '내가 넣은 정보로 계산하고 있어요. 입력값은 서버로 보내지 않고 이 기기 브라우저에만 저장돼요.';
  document.querySelector('[data-action="reset"]').hidden = state.isExample;
}

function renderAgentForm() {
  $('#agent-form').innerHTML = renderForm(state, previewLine(state, R));
  syncInputs();
}

function renderAll() {
  R = compute(state);
  renderBanner();
  if (!$('#agent-form').innerHTML) renderAgentForm();
  else { const pv = $('#agent-preview'); if (pv) pv.innerHTML = previewLine(state, R); }
  $('#agent-report').innerHTML = renderReport(R);
  if (state.tab === 'pay') { $('#panel-pay').innerHTML = renderPay(state, R); drawPayChart($('#pay-chart'), R.pay); }
  if (state.tab === 'retire') {
    if (!$('#retire-form')) {
      $('#panel-retire').innerHTML = '<div class="split rev"><div class="col" id="retire-results"></div><div class="col sticky-col" id="retire-form"></div></div>';
      $('#retire-form').innerHTML = renderRetireForm();
    }
    $('#retire-results').innerHTML = renderRetireResults(state, R);
  }
  syncInputs();
}

let raf = 0;
const scheduleRender = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(renderAll); };

function setTab(t, focus) {
  if (!TABS.includes(t)) t = 'agent';
  state.tab = t;
  saveState(state);
  TABS.forEach(name => {
    const on = name === t;
    const b = $('#tab-' + name);
    b.setAttribute('aria-selected', on);
    b.tabIndex = on ? 0 : -1;
    $('#panel-' + name).hidden = !on;
  });
  if (t === 'tonight') { renderClock(state.todayShift); mountWidgets(); loadLive(); }
  renderAll();
  if (focus) $('#tab-' + t).focus();
}

// ---------- 입력 ----------
function onInput(e) {
  const el = e.target;
  if (!el.dataset || !el.dataset.path) return;
  const path = el.dataset.path;
  let v;
  if (el.dataset.kind === 'bool') v = el.checked;
  else if (el.dataset.kind === 'num') { v = parseFloat(el.value); if (!Number.isFinite(v)) return; }
  else v = el.value;
  setPath(state, path, v);
  state.isExample = false;
  // 근무 형태를 바꾸면 야간·휴일 시간을 추정치로 채운다
  if (path === 'profile.shiftType') {
    const t = RULES.shiftTypes.find(x => x.id === v);
    if (t && t.nightHours != null) { state.profile.nightHours = t.nightHours; state.profile.holidayDays = t.holidayDays; }
  }
  if (path === 'profile.rankId') {
    const rank = RULES.ranks.find(r => r.id === v);
    state.profile.step = Math.min(state.profile.step, RULES.payTable[rank.name].length);
  }
  saveState(state);
  // 입력 칸 구성이 바뀌는 경우만 폼을 다시 그린다
  if (['profile.rankId', 'profile.family.spouse'].includes(path)) { R = compute(state); renderAgentForm(); }
  scheduleRender();
}

function onClick(e) {
  const t = e.target.closest('button, [data-goto]');
  if (!t) return;
  if (t.dataset.tab) return setTab(t.dataset.tab);
  if (t.dataset.goto) {
    if (t.dataset.step) state.step = Number(t.dataset.step);
    setTab(t.dataset.goto);
    if (t.dataset.goto === 'agent') renderAgentForm();
    window.scrollTo({ top: 0 });
    return;
  }
  if (t.dataset.shift) { state.todayShift = t.dataset.shift; saveState(state); renderClock(state.todayShift); return; }
  if (t.dataset.radio) { setPath(state, t.dataset.radio, t.dataset.value); state.isExample = false; saveState(state); renderAgentForm(); scheduleRender(); return; }
  const a = t.dataset.action;
  if (!a) return;
  if (a === 'step') {
    const s = Number(t.dataset.step);
    if (s >= 1 && s <= 5) { state.step = s; saveState(state); renderAgentForm(); $('#agent-form').scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  } else if (a === 'to-report') {
    $('#agent-report').scrollIntoView({ block: 'start', behavior: 'smooth' });
  } else if (a === 'add-debt') {
    state.finance.debts.push({ name: '', balance: 0, rate: 0, monthly: 0 }); touch(); renderAgentForm(); scheduleRender();
  } else if (a === 'remove-debt') {
    state.finance.debts.splice(Number(t.dataset.index), 1); touch(); renderAgentForm(); scheduleRender();
  } else if (a === 'add-goal') {
    if (state.goals.length < 4) state.goals.push({ name: t.dataset.name || '', amount: Number(t.dataset.amount) || 0, years: Number(t.dataset.years) || 1 });
    touch(); renderAgentForm(); scheduleRender();
  } else if (a === 'remove-goal') {
    state.goals.splice(Number(t.dataset.index), 1); touch(); renderAgentForm(); scheduleRender();
  } else if (a === 'pay-month') {
    state.payMonth = t.dataset.month; saveState(state); scheduleRender();
  } else if (a === 'copy-prompt') {
    copyPrompt();
  } else if (a === 'reset') {
    resetExample(t);
  }
}

const touch = () => { state.isExample = false; saveState(state); };

async function copyPrompt() {
  const box = $('#ai-prompt'), status = $('#copy-status');
  try {
    await navigator.clipboard.writeText(box.value);
    status.textContent = '복사했어요. ChatKHU 같은 AI 대화창에 붙여 넣으세요.';
  } catch (e) {
    box.focus(); box.select();
    status.textContent = '선택해 두었어요. 길게 눌러 복사해 주세요.';
  }
}

let armed = false, armTimer = 0;
function resetExample(btn) {
  if (!armed) {
    armed = true; btn.textContent = '한 번 더 누르면 예시로 되돌려요';
    clearTimeout(armTimer);
    armTimer = setTimeout(() => { armed = false; btn.textContent = '예시로 되돌리기'; }, 4000);
    return;
  }
  armed = false; clearTimeout(armTimer); btn.textContent = '예시로 되돌리기';
  state = freshState({ tab: state.tab, todayShift: state.todayShift });
  saveState(state);
  R = compute(state);
  renderAgentForm();
  renderAll();
}

function onTabKeys(e) {
  const i = TABS.indexOf(document.activeElement?.dataset?.tab);
  if (i < 0) return;
  let n = null;
  if (e.key === 'ArrowRight') n = (i + 1) % TABS.length;
  if (e.key === 'ArrowLeft') n = (i - 1 + TABS.length) % TABS.length;
  if (n === null) return;
  e.preventDefault();
  setTab(TABS[n], true);
}

function renderFooter() {
  $('#foot').innerHTML = `
    <p>SHIFT-FIN은 정보 제공·교육용 서비스예요. 투자 권유가 아니며, 결과는 넣은 값과 가정에 따라 달라져요. 입력한 값은 서버로 보내지 않고 이 기기 브라우저에만 저장해요.</p>
    <h2>보수·제도 기준 (${RULES.year}년)</h2>
    <ul>${RULES.sources.map(s => `<li>${s.name}: ${s.url ? `<a href="${s.url}" target="_blank" rel="noopener">${s.text}</a>` : s.text}</li>`).join('')}</ul>
    <h2>자동 수집 데이터</h2>
    <ul><li>한국은행 경제통계시스템(ECOS) · FRED(세인트루이스 연준) · 금융감독원 금융상품한눈에 · Google 뉴스 · 시세 위젯 TradingView</li>
    <li>노후 생활비 참고값: KB금융 경영연구소 「2025 KB골든라이프 보고서」 · 미국 휴장일: NYSE 2026 일정</li></ul>
    <p>SHIFT-FIN v1.0 · 2026 KHU AI Challenge 출품작 · 기준일 ${RULES.updated}</p>`;
}

// ---------- 시작 ----------
document.addEventListener('input', onInput);
document.addEventListener('change', e => { if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox') onInput(e); });
document.addEventListener('click', onClick);
document.querySelector('.tabs').addEventListener('keydown', onTabKeys);
document.addEventListener('visibilitychange', () => { if (!document.hidden && state.tab === 'tonight') renderClock(state.todayShift); });
setInterval(() => { if (state.tab === 'tonight') renderClock(state.todayShift); }, 15000);
let resizeRaf = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => { if (state.tab === 'pay' && R) drawPayChart($('#pay-chart'), R.pay); });
});

drawTicks();
renderFooter();
R = compute(state);
renderAgentForm();
const fromHash = location.hash.replace('#', '');
setTab(TABS.includes(fromHash) ? fromHash : state.tab);
