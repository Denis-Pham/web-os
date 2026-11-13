// Dịch vụ giao diện chung (R1 — tên B2/B3 dùng): bao() chữ vào #tin (role=status, luôn có mặt) · moHop/dongHop (hộp thoại trả focus,
// neo duy nhất traVe?.focus();) · thanh Hoàn tác · sổ hành động data-act (một bộ nghe click) · MIEN_NGAY + oNgay() (miền R11 = laNgay 2000–2100).
import { el } from './dom.js';

const $ = id => document.getElementById(id);
export const bao = chu => { $('tin').textContent = chu; };

const HANH_DONG = new Map();
export const dangKyHanhDong = (ten, fn) => { HANH_DONG.set(ten, fn); };

let traVe = null;
function traFocus() { traVe?.focus(); traVe = null; }
export function moHop(tieuDe, ...con) {
  const h = $('hop');
  if (!h.open) traVe = document.activeElement;
  h.replaceChildren(el('h2', { id: 'tieu-de-hop' }, tieuDe), ...con);
  if (!h.open) h.showModal();
  h.querySelector('input, select, textarea, button')?.focus();
}
export function dongHop() { const h = $('hop'); if (h.open) h.close(); else traFocus(); }

let hoanTac = null;
export function hienHoanTac(chu, fn) {
  hoanTac = fn;
  $('noi-dung-hoan-tac').textContent = chu;
  $('thanh-hoan-tac').hidden = false;
}
export function anHoanTac() { hoanTac = null; $('thanh-hoan-tac').hidden = true; $('noi-dung-hoan-tac').textContent = ''; }

export const MIEN_NGAY = { min: '2000-01-01', max: '2100-12-31' };
export const oNgay = (name, giaTri) => el('input', { type: 'date', name, value: giaTri || null, min: MIEN_NGAY.min, max: MIEN_NGAY.max });

// Gắn một lần lúc khởi động: bộ nghe click data-act, hộp thoại đóng (kể cả Esc) ⇒ trả focus, nút Hoàn tác.
export function ganGiaoDien() {
  document.addEventListener('click', e => {
    const n = e.target.closest('[data-act]');
    const fn = n && HANH_DONG.get(n.dataset.act);
    if (fn) fn(n, e);
  });
  $('hop').addEventListener('close', () => { $('hop').replaceChildren(); traFocus(); });
  dangKyHanhDong('dong-hop', () => dongHop());
  dangKyHanhDong('hoan-tac', () => { const f = hoanTac; anHoanTac(); f?.(); });
}
