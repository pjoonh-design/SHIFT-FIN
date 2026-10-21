// 오늘 밤 화면: 24시간 다이얼, 근무별 체크 시간, 시세 위젯, 자동 수집 데이터
import { marketStatus, openTimeChange, hm, dayLabel, countdown, partsIn } from '../engine/market.js';
import { esc } from '../engine/format.js';

const SHIFTS = { day: { from: 9, to: 18 }, night: { from: 18, to: 9 }, off: null, rest: null };
const CX = 130, CY = 130, R_MARKET = 96, R_SHIFT = 78;
const ang = h => (h / 24) * Math.PI * 2 - Math.PI / 2;
const pt = (r, h) => [CX + r * Math.cos(ang(h)), CY + r * Math.sin(ang(h))];
const hourOf = ms => { const p = partsIn(ms, 'Asia/Seoul'); return p.hh + p.mm / 60; };
const $ = s => document.querySelector(s);

function arcPath(r, h1, h2) {
  if (h2 <= h1) h2 += 24;
  const [x1, y1] = pt(r, h1), [x2, y2] = pt(r, h2);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${h2 - h1 > 12 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export function drawTicks() {
  const g = $('#d-ticks');
  if (!g || g.childElementCount) return;
  const NS = 'http://www.w3.org/2000/svg';
  for (let h = 0; h < 24; h++) {
    const major = h % 6 === 0;
    const [x1, y1] = pt(major ? 104 : 106, h), [x2, y2] = pt(111, h);
    const line = document.createElementNS(NS, 'line');
    Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => line.setAttribute(k, v));
    line.setAttribute('class', 'd-tick' + (major ? ' major' : ''));
    g.appendChild(line);
    if (major) {
      const [tx, ty] = pt(122, h);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', tx); t.setAttribute('y', ty);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'central');
      t.setAttribute('class', 'd-hour');
      t.textContent = String(h).padStart(2, '0');
      g.appendChild(t);
    }
  }
}

export function renderClock(todayShift) {
  const now = Date.now();
  const st = marketStatus(now);
  if (!st) return;
  const open = st.state === 'open';
  const cd = countdown((open ? st.closeMs : st.openMs) - now);
  $('#dial-label').textContent = open ? '정규장 진행 중 · 마감까지' : '개장까지';
  const c = $('#dial-count');
  c.textContent = cd.text;
  c.classList.toggle('long', !cd.mono);
  $('#dial-sub').textContent = open ? `${dayLabel(st.closeMs, now)} ${hm(st.closeMs)} 마감` : `${dayLabel(st.openMs, now)} ${hm(st.openMs)} 개장`;
  $('#d-market').setAttribute('d', arcPath(R_MARKET, hourOf(st.openMs), hourOf(st.closeMs)));
  $('#lg-market').textContent = `${hm(st.openMs)}–${hm(st.closeMs)}`;
  const sh = SHIFTS[todayShift];
  const sp = $('#d-shift');
  if (sh) {
    sp.setAttribute('d', arcPath(R_SHIFT, sh.from, sh.to));
    $('#lg-shift').textContent = `${String(sh.from).padStart(2, '0')}:00–${String(sh.to).padStart(2, '0')}:00`;
  } else {
    sp.removeAttribute('d');
    $('#lg-shift').textContent = todayShift === 'off' ? '없음(비번)' : '없음(휴무)';
  }
  const nh = hourOf(now);
  const [x1, y1] = pt(58, nh), [x2, y2] = pt(R_MARKET + 10, nh), [dx, dy] = pt(R_MARKET, nh);
  const n = $('#d-needle');
  n.setAttribute('x1', x1.toFixed(2)); n.setAttribute('y1', y1.toFixed(2)); n.setAttribute('x2', x2.toFixed(2)); n.setAttribute('y2', y2.toFixed(2));
  $('#d-now').setAttribute('cx', dx.toFixed(2)); $('#d-now').setAttribute('cy', dy.toFixed(2));
  $('#lg-now').textContent = hm(now);
  $('#dial').setAttribute('aria-label', `24시간 다이얼. 미국 정규장 한국 시간 ${hm(st.openMs)}부터 ${hm(st.closeMs)}까지, ${sh ? `내 근무 ${sh.from}시부터 ${sh.to}시까지` : '오늘 근무 없음'}, 지금 ${hm(now)}`);
  document.querySelectorAll('.roster [data-shift]').forEach(b => {
    const on = b.dataset.shift === todayShift;
    b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1;
  });

  const MIN = 60000;
  let at, text;
  if (todayShift === 'day') { at = st.openMs + 15 * MIN; text = '퇴근하고 쉬다가 개장 15분 뒤에 3분만 확인해요. 확인하고 바로 자도 충분해요.'; }
  else if (todayShift === 'night') { at = st.openMs + 30 * MIN; text = '근무 중 휴식 시간에 개장 30분 뒤 흐름을 3분만 확인해요.'; }
  else if (todayShift === 'off') { at = st.closeMs; text = '야간 근무 뒤엔 푹 자고, 일어나서 마감 결과부터 정리해서 봐요.'; }
  else { at = st.openMs - 60 * MIN; text = '쉬는 날엔 개장 1시간 전에 이번 주 경제 일정을 미리 점검해요.'; }
  if (open && now >= at && todayShift !== 'off') text = '지금 확인하기 좋은 시간이에요. ' + text;
  $('#timing-time').textContent = todayShift === 'off' ? `${hm(at)} 마감 이후` : hm(at);
  $('#timing-text').textContent = text;
  const notes = [];
  if (st.holidayName) notes.push(`오늘은 미국 증시 휴장일(${st.holidayName})이에요.`);
  if (st.early) notes.push(`${dayLabel(st.openMs, now)} 장은 미국 시간 오후 1시 조기 마감이라 한국 시간 ${hm(st.closeMs)}에 끝나요.`);
  const chg = openTimeChange(now);
  if (chg) notes.push(`${dayLabel(chg.openMs, now)} 장부터는 한국 시간 ${hm(chg.openMs)}에 개장해요. 미국 서머타임이 ${chg.later ? '끝나서' : '시작돼서'}예요.`);
  notes.push('미국 휴장일과 서머타임은 자동으로 반영돼요.');
  $('#market-notes').replaceChildren(...notes.map(t => { const li = document.createElement('li'); li.textContent = t; return li; }));
}

// ---------- TradingView 위젯 ----------
const TV = 'https://s3.tradingview.com/external-embedding/';
const theme = () => (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));

function fallback(el) {
  if (el.dataset.fallback) return;
  el.dataset.fallback = '1';
  el.innerHTML = '<div class="tv-fallback"><b>시세 위젯을 불러오지 못했어요</b><span>광고 차단 기능이나 네트워크 설정을 확인해 주세요. claude.ai 미리보기 화면에서는 외부 위젯이 막혀 있어서, 공개 사이트에서만 시세가 나와요.</span></div>';
}

function mount(el, file, config) {
  if (!el || el.dataset.mounted) return;
  el.dataset.mounted = '1';
  const box = document.createElement('div');
  box.className = 'tradingview-widget-container';
  const inner = document.createElement('div');
  inner.className = 'tradingview-widget-container__widget';
  box.appendChild(inner);
  const s = document.createElement('script');
  s.src = TV + file;
  s.async = true;
  s.text = JSON.stringify(config);
  s.onerror = () => fallback(el);
  box.appendChild(s);
  el.appendChild(box);
  setTimeout(() => { if (!el.querySelector('iframe')) fallback(el); }, 9000);
}

export function mountWidgets() {
  const colorTheme = theme();
  mount($('#tv-ticker'), 'embed-widget-ticker-tape.js', {
    symbols: [
      { proName: 'FOREXCOM:SPXUSD', title: 'S&P 500' }, { proName: 'FOREXCOM:NSXUSD', title: '나스닥 100' },
      { proName: 'FOREXCOM:DJI', title: '다우' }, { proName: 'FX_IDC:USDKRW', title: '원/달러' },
      { proName: 'TVC:US10Y', title: '미국 10년물' }, { proName: 'TVC:VIX', title: 'VIX' },
    ],
    showSymbolLogo: false, isTransparent: true, displayMode: 'adaptive', colorTheme, locale: 'kr',
  });
  mount($('#tv-mini'), 'embed-widget-mini-symbol-overview.js', {
    symbol: 'FOREXCOM:SPXUSD', width: '100%', height: 220, locale: 'kr', dateRange: '1M',
    colorTheme, isTransparent: true, autosize: true,
  });
  mount($('#tv-events'), 'embed-widget-events.js', {
    colorTheme, isTransparent: true, width: '100%', height: 420, locale: 'kr',
    importanceFilter: '0,1', countryFilter: 'us,kr',
  });
}

// ---------- 자동 수집 데이터 ----------
const updated = d => (d && d.updatedAt ? `${d.updatedAt.slice(5, 10).replace('-', '/')} ${d.updatedAt.slice(11, 16)} 업데이트` : '');
const waiting = (title, what) => `<div class="card-head"><h2>${title}</h2><span class="pill pill-wait">자동 수집 준비 중</span></div><p class="note">${what}</p>`;
const signed = (v, d = 2) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);

export async function loadLive(base = 'data/live/') {
  const get = async name => {
    try {
      const r = await fetch(base + name, { cache: 'no-store' });
      return r.ok ? await r.json() : null;
    } catch (e) { return null; }
  };
  const [briefing, us, macro, rates, news] = await Promise.all(
    ['briefing.json', 'us-markets.json', 'macro.json', 'rates.json', 'news.json'].map(get));
  renderLive({ briefing, us, macro, rates, news });
}

export function renderLive({ briefing, us, macro, rates, news }) {
  const ok = d => d && d.status === 'ok';
  $('#brief-card').innerHTML = ok(briefing)
    ? `<div class="card-head"><h2>오늘 밤 3줄 브리핑</h2><span class="pill ${briefing.mode === 'ai' ? 'pill-accent' : 'pill-wait'}">${briefing.mode === 'ai' ? 'AI 작성 · 숫자 검증' : '자동 요약'}</span></div>
       <ul class="brief">${briefing.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
       <p class="note">${updated(briefing)} · 숫자는 수집한 데이터에서 가져오고, 문장에 데이터에 없는 숫자가 들어가면 버려요. 투자 권유가 아니에요.</p>`
    : waiting('오늘 밤 3줄 브리핑', '매일 07시·12시·21시에 미국장·환율·금리·뉴스를 모아 3줄로 정리해요.');

  $('#us-card').innerHTML = ok(us)
    ? `<div class="card-head"><h2>어젯밤 미국장 마감</h2><span class="note">${updated(us)}</span></div>
       <div class="stat-grid">${us.items.map(i => `<div class="stat"><span>${esc(i.name)}</span><strong>${i.value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}${esc(i.unit || '')}</strong><em class="${i.changePct >= 0 ? 'up' : 'down'}">${i.changePct >= 0 ? '▲' : '▼'} ${signed(i.changePct)}%</em></div>`).join('')}</div>
       <p class="note">${esc(us.items[0].date)} 마감 기준 · 출처 ${esc(us.source)}</p>`
    : waiting('어젯밤 미국장 마감', 'S&P 500·나스닥·다우·미국 10년물 금리·VIX의 전날 마감 값을 FRED에서 받아요.');

  $('#macro-card').innerHTML = ok(macro)
    ? `<div class="card-head"><h2>한국 경제 지표</h2><span class="note">${updated(macro)}</span></div>
       <div class="stat-grid">
         ${macro.cpi ? `<div class="stat"><span>물가 상승률</span><strong>${macro.cpi.yoy}%</strong><em>${esc(macro.cpi.month)} 전년 대비</em></div>` : ''}
         ${macro.items.map(i => `<div class="stat"><span>${esc(i.name)}</span><strong>${i.value.toLocaleString('ko-KR')}${i.unit === '%' ? '%' : ''}</strong><em>${esc(i.time)}</em></div>`).join('')}
       </div>
       <p class="note">출처 ${esc(macro.source)} · 내 예·적금 금리가 물가 상승률보다 낮으면 실질적으로는 돈이 줄어요.</p>`
    : waiting('한국 경제 지표', '기준금리·물가 상승률·환율·경제성장률을 한국은행 ECOS에서 받아요.');

  const rateRows = list => list.map(r => `<div class="rate-row"><span>${esc(r.bank)} · ${esc(r.product)}<small>12개월 ${esc(r.type)}${r.maxRate > r.rate ? ` · 우대 최고 ${r.maxRate}%` : ''}</small></span><strong>${r.rate}%</strong></div>`).join('');
  $('#rates-card').innerHTML = ok(rates)
    ? `<div class="card-head"><h2>은행 금리 상위</h2><span class="note">${updated(rates)}</span></div>
       <p class="group-label">정기예금 (기본금리 순)</p><div class="rate-list">${rateRows(rates.deposit || [])}</div>
       <p class="group-label">적금</p><div class="rate-list">${rateRows(rates.saving || [])}</div>
       <p class="note">가입 제한이 없는 은행 상품만 골랐어요. 출처 ${esc(rates.source)} (${esc(rates.month || '')} 공시). 상품 추천이 아니라 비교용이에요.</p>`
    : waiting('은행 금리 상위', '정기예금·적금 12개월 금리 상위 상품을 금융감독원 금융상품한눈에서 받아요.');

  $('#news-card').innerHTML = ok(news)
    ? `<div class="card-head"><h2>경제 뉴스</h2><span class="note">${updated(news)}</span></div>
       <ul class="news">${news.items.slice(0, 6).map(n => `<li><a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a><small>${esc(n.topic)} · ${esc(n.source)}</small></li>`).join('')}</ul>`
    : waiting('경제 뉴스', '미국 증시·환율·금리 헤드라인을 하루 세 번 모아요.');
}
