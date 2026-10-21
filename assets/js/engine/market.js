// 미국장 시계: 한국 시간 기준 개장·마감, NYSE 휴장일, 서머타임 자동 반영
const NY = 'America/New_York', SEOUL = 'Asia/Seoul';

// NYSE 2026 휴장일·조기마감 (ICE 공식 발표)
export const NYSE_HOLIDAYS = {
  '2026-01-01': '신정', '2026-01-19': '마틴 루서 킹 데이', '2026-02-16': '대통령의 날',
  '2026-04-03': '성금요일', '2026-05-25': '메모리얼 데이', '2026-06-19': '준틴스',
  '2026-07-03': '독립기념일 대체휴일', '2026-09-07': '노동절', '2026-11-26': '추수감사절',
  '2026-12-25': '크리스마스',
};
const NYSE_EARLY = { '2026-11-27': 780, '2026-12-24': 780 }; // 미국 시간 13:00 조기 마감
const CLOSE_MIN = 960;

const fmtCache = {};
export function partsIn(ms, tz) {
  const f = fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  const o = {};
  for (const p of f.formatToParts(new Date(ms))) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, hh: (+o.hour) % 24, mm: +o.minute, ss: +o.second };
}
function offsetAt(ms, tz) {
  const p = partsIn(ms, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - Math.floor(ms / 1000) * 1000;
}
export function zonedToMs(y, m, d, hh, mm, tz) {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const o1 = offsetAt(guess, tz);
  let ms = guess - o1;
  const o2 = offsetAt(ms, tz);
  if (o2 !== o1) ms = guess - o2;
  return ms;
}
const dkey = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const weekday = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();
function shiftDate(y, m, d, n) {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}
function isTradingDay(y, m, d) {
  const w = weekday(y, m, d);
  return w !== 0 && w !== 6 && !NYSE_HOLIDAYS[dkey(y, m, d)];
}
function session(y, m, d) {
  const c = NYSE_EARLY[dkey(y, m, d)] || CLOSE_MIN;
  return {
    openMs: zonedToMs(y, m, d, 9, 30, NY),
    closeMs: zonedToMs(y, m, d, Math.floor(c / 60), c % 60, NY),
    early: c !== CLOSE_MIN, date: { y, m, d },
  };
}
export function marketStatus(now) {
  const et = partsIn(now, NY);
  const info = { holidayName: NYSE_HOLIDAYS[dkey(et.y, et.m, et.d)] || null };
  if (isTradingDay(et.y, et.m, et.d)) {
    const s = session(et.y, et.m, et.d);
    if (now >= s.openMs && now < s.closeMs) return { state: 'open', ...s, ...info };
    if (now < s.openMs) return { state: 'pre', ...s, ...info };
  }
  for (let k = 1; k <= 14; k++) {
    const n = shiftDate(et.y, et.m, et.d, k);
    if (isTradingDay(n.y, n.m, n.d)) return { state: 'closed', ...session(n.y, n.m, n.d), ...info };
  }
  return null;
}
export function openTimeChange(now) {
  const st = marketStatus(now);
  if (!st) return null;
  const b = partsIn(st.openMs, SEOUL);
  const baseHm = b.hh * 60 + b.mm;
  for (let k = 1; k <= 21; k++) {
    const n = shiftDate(st.date.y, st.date.m, st.date.d, k);
    if (!isTradingDay(n.y, n.m, n.d)) continue;
    const s = session(n.y, n.m, n.d);
    const p = partsIn(s.openMs, SEOUL);
    const hm = p.hh * 60 + p.mm;
    if (hm !== baseHm) return { openMs: s.openMs, later: hm > baseHm };
  }
  return null;
}
const pad = n => String(n).padStart(2, '0');
export const hm = ms => { const p = partsIn(ms, SEOUL); return `${pad(p.hh)}:${pad(p.mm)}`; };
export function dayLabel(ms, now) {
  const a = partsIn(ms, SEOUL), b = partsIn(now, SEOUL);
  const diff = Math.round((Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(b.y, b.m - 1, b.d)) / 86400000);
  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  if (diff === -1) return '어제';
  return `${a.m}/${a.d}(${'일월화수목금토'[weekday(a.y, a.m, a.d)]})`;
}
export function countdown(ms) {
  const t = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(t / 60), m = t % 60;
  if (h >= 24) return { text: `${Math.floor(h / 24)}일 ${h % 24}시간`, mono: false };
  return { text: `${h}:${pad(m)}`, mono: true };
}
export const seoulYear = now => partsIn(now, SEOUL).y;
export const seoulHour = ms => { const p = partsIn(ms, SEOUL); return p.hh + p.mm / 60; };
