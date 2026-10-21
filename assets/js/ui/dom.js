// 입력 칸과 작은 화면 조각을 만드는 도우미
import { esc } from '../engine/format.js';

const idOf = (prefix, path) => `${prefix}-${path.replace(/[^a-zA-Z0-9]/g, '-')}`;

export function num(path, label, { unit = '', min, max, step = 1, hint = '', full = false, prefix = 'f' } = {}) {
  const id = idOf(prefix, path);
  return `<div class="field${full ? ' full' : ''}">
    <label for="${id}">${esc(label)}</label>
    <div class="ctl"><input id="${id}" data-path="${path}" data-kind="num" type="number" inputmode="decimal"${min != null ? ` min="${min}"` : ''}${max != null ? ` max="${max}"` : ''} step="${step}"><span class="unit">${esc(unit)}</span></div>
    ${hint ? `<span class="hint">${hint}</span>` : ''}
  </div>`;
}

export function sel(path, label, options, { hint = '', full = false, prefix = 'f' } = {}) {
  const id = idOf(prefix, path);
  return `<div class="field${full ? ' full' : ''}">
    <label for="${id}">${esc(label)}</label>
    <div class="ctl"><select id="${id}" data-path="${path}" data-kind="text">${options.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></div>
    ${hint ? `<span class="hint">${hint}</span>` : ''}
  </div>`;
}

export function tog(path, label, { full = false, prefix = 'f' } = {}) {
  const id = idOf(prefix, path);
  return `<label class="switch${full ? ' field full' : ''}" for="${id}"><span>${esc(label)}</span><input id="${id}" type="checkbox" role="switch" data-path="${path}" data-kind="bool"></label>`;
}

export function txt(path, label, { prefix = 'f', placeholder = '' } = {}) {
  const id = idOf(prefix, path);
  return `<div class="field"><label for="${id}">${esc(label)}</label><input class="txt" id="${id}" data-path="${path}" data-kind="text" type="text" maxlength="20" placeholder="${esc(placeholder)}"></div>`;
}

export const pill = (cls, text) => `<span class="pill ${cls}">${esc(text)}</span>`;

// 0~100 점수 링
export function ring(score, label) {
  const r = 44, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, score));
  const cls = v >= 80 ? 'good' : v < 40 ? 'low' : '';
  return `<div class="ring" role="img" aria-label="${esc(label)} ${v}점">
    <svg viewBox="0 0 104 104"><circle class="track" cx="52" cy="52" r="${r}"></circle>
    <circle class="val ${cls}" cx="52" cy="52" r="${r}" stroke-dasharray="${(c * v / 100).toFixed(1)} ${c.toFixed(1)}"></circle></svg>
    <div class="ring-text"><strong>${v}</strong><span>/ 100</span></div></div>`;
}

// 비율 막대(가로 누적). parts: [{label, value, color}]
export function stack(parts) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0) || 1;
  const bar = parts.filter(p => p.value > 0).map(p =>
    `<i style="flex:${(p.value / total).toFixed(4)};background:${p.color}" title="${esc(p.label)}"></i>`).join('');
  return `<div class="stack" aria-hidden="true">${bar}</div>`;
}

export const SERIES = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)', 'var(--c8)'];
