// Phiên (B1): GET /api/phien ⇒ het_luc ⇒ hẹn giờ xoá dữ liệu khỏi DOM + bộ nhớ đúng lúc đó (không cần mạng). Trang treo nền / bfcache
// hiện lại (pageshow, visibilitychange) ⇒ kiểm lại ngay. 401/403/302 ở bất cứ /api/* nào (api.js datXuLy) ⇒ cùng một đường xoaDuLieu
// ⇒ màn Hết phiên; sau đó định tuyến không vẽ màn nào khác (daHetPhien). Mỗi màn đăng ký don() qua dangKyDon để xoá đệm của nó.
import { el } from './dom.js';
import { goiApi, datXuLy, LoiPhien, LoiMang } from './api.js';
import { bao, anHoanTac } from './giao-dien.js';

const $ = id => document.getElementById(id);
const DON = new Set();
let het = null, hen = 0, daHet = false;

export const dangKyDon = f => DON.add(f);
export const daHetPhien = () => daHet;

// Mili giây còn lại tới het_luc (thuần). het_luc hỏng ⇒ 0: xoá ngay (hỏng thì đóng).
export function hetSau(hetLuc, bayGio) {
  const t = Date.parse(hetLuc);
  return Number.isNaN(t) ? 0 : Math.max(0, t - bayGio);
}

function datHen(h) {
  het = h; clearTimeout(hen);
  hen = setTimeout(kiemHet, Math.min(hetSau(h, Date.now()), 2147483647));
}
// Hẹn giờ có thể gọi sớm (trần 2^31-1 ms) ⇒ hết thật mới xoá, chưa thì hẹn lại.
function kiemHet() { if (hetSau(het, Date.now()) > 0) datHen(het); else xoaDuLieu(); }

async function docPhien() {
  const o = await goiApi('/api/phien');
  datHen(o.het_luc);
}

// (1) đã quá het_luc ⇒ xoá NGAY, không cần mạng · (2) hỏi lại /api/phien ⇒ hẹn lại; LoiPhien đã xoá qua datXuLy;
// LoiMang / lỗi máy chủ ⇒ giữ, hẹn giờ het_luc cũ vẫn canh.
export async function kiemLai() {
  if (daHet) return;
  if (het !== null && hetSau(het, Date.now()) === 0) { xoaDuLieu(); return; }
  try { await docPhien(); } catch { /* xem chú thích trên */ }
}

function veHetPhien() {
  $('noi-dung').append(el('section', { 'data-man': 'het-phien', 'aria-label': 'Hết phiên' },
    el('div', { class: 'the het-phien' }, el('h1', {}, 'Hết phiên'),
      el('p', {}, 'Phiên đăng nhập đã hết hoặc không còn hợp lệ. Dữ liệu đã được gỡ khỏi trang.'),
      el('button', { type: 'button', class: 'nut-chinh', 'data-act': 'dang-nhap-lai' }, 'Đăng nhập lại'))));
  $('ten-man').textContent = 'Hết phiên';
  bao('Hết phiên — đăng nhập lại');
}

export function xoaDuLieu() {
  if (daHet) return;
  daHet = true; clearTimeout(hen);
  document.getElementById('noi-dung').replaceChildren();
  const h = $('hop'); if (h.open) h.close(); h.replaceChildren();
  anHoanTac();
  $('trang-thai-he').textContent = '';
  for (const f of DON) f();
  veHetPhien();
}

// Khởi động: gắn đường Hết phiên + hai sự kiện hiện lại, kiểm phiên. true ⇒ vẽ màn được; false ⇒ không vẽ dữ liệu.
export async function batDau() {
  datXuLy({ hetPhien: xoaDuLieu });
  window.addEventListener('pageshow', kiemLai);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') kiemLai(); });
  try { await docPhien(); return true; } catch (e) {
    if (e instanceof LoiMang) bao('Mất kết nối — chưa kiểm được phiên.');
    else if (!(e instanceof LoiPhien)) bao('Máy chủ báo lỗi khi kiểm phiên: ' + (e?.loi ?? e?.message ?? 'không rõ') + '.');
    return false;
  }
}
