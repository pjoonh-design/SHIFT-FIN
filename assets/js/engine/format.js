// 표기 도우미. 엔진은 원 단위로 계산하고, 화면에 보일 때만 만원·억 단위로 바꾼다.

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const won = v => (Number.isFinite(v) ? Math.round(v).toLocaleString('ko-KR') : '—') + '원';

// 원 → "325만원", "1억 2,300만원" (1억 이상은 100만원 단위로 반올림)
export function man(vWon) {
  if (!Number.isFinite(vWon)) return '—';
  const neg = vWon < 0;
  let a = Math.abs(vWon) / 10000;
  a = a >= 10000 ? Math.round(a / 100) * 100 : Math.round(a);
  if (a === 0) return '0원';
  const eok = Math.floor(a / 10000), rest = a % 10000;
  const s = eok
    ? `${eok.toLocaleString('ko-KR')}억${rest ? ` ${rest.toLocaleString('ko-KR')}만원` : '원'}`
    : `${rest.toLocaleString('ko-KR')}만원`;
  return (neg ? '−' : '') + s;
}

// 원 → 축 라벨 "1.2억", "3,500만"
export function manShort(vWon) {
  const a = Math.abs(vWon) / 10000, sign = vWon < 0 ? '−' : '';
  if (a === 0) return '0';
  if (a >= 10000) return sign + (Math.round(a / 1000) / 10) + '억';
  return sign + Math.round(a).toLocaleString('ko-KR') + '만';
}

export const pct = (x, digits = 0) => (Number.isFinite(x) ? (x * 100).toFixed(digits) : '—') + '%';
export const sum = arr => arr.reduce((s, v) => s + (Number(v) || 0), 0);
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const toWon = man => Math.round((Number(man) || 0) * 10000);
