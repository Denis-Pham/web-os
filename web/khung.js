// Điểm vào giao diện (B1): thanh 12 mạch + #ban, ngăn ☰ (≤ 760 px: .workspace inert khi mở), định tuyến theo #, sổ màn (màn chưa có ⇒
// giữ chỗ «chưa nối», R6), màn Hết phiên (định tuyến không vẽ màn nào khác sau khi hết). Xong khởi động ⇒ <html data-san="1">.
import { el } from './dom.js';
import { datXuLy, LoiPhien, LoiChiDoc, LoiMang } from './api.js';
import { bao, dangKyHanhDong, ganGiaoDien, anHoanTac } from './giao-dien.js';
import { MAN as CHU } from './man-chu.js';
import { MAN as KHAC, MACH, lienKet, urlNgoai, chuaNoi } from './mach.js';

const $ = id => document.getElementById(id);
const TEN = new Map([...MACH, ['ban', 'Bản giao diện']]);
const SO_MAN = new Map([CHU, ...KHAC].map(m => [m.id, m]));
const giuCho = (id, ten) => ({ id, ten, ve(goc) { goc.append(el('div', { class: 'dau-man' }, el('h1', {}, ten)), el('div', { class: 'the' }, chuaNoi())); }, don() {} });
let daHet = false;

function idHienTai() { const id = location.hash.slice(1); return TEN.has(id) ? id : 'chu'; }

function loiMan(e) {
  if (e instanceof LoiPhien || e instanceof LoiChiDoc) return;   // đã xử lý qua datXuLy
  if (e instanceof LoiMang) bao('Mất kết nối — chưa tải được dữ liệu.');
  else bao('Máy chủ báo lỗi: ' + (e?.loi ?? e?.message ?? 'không rõ') + '.');
}

function veMan() {
  if (daHet) return;
  const id = idHienTai(), man = SO_MAN.get(id) ?? giuCho(id, TEN.get(id)), goc = el('section', { 'data-man': id, 'aria-label': TEN.get(id) });
  $('noi-dung').replaceChildren(goc);
  $('ten-man').textContent = TEN.get(id);
  for (const a of $('cac-mach').querySelectorAll('a')) {
    if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  Promise.resolve().then(() => man.ve(goc)).catch(loiMan);
}

export function veHetPhien() {
  daHet = true;
  const h = $('hop');
  if (h.open) h.close();
  h.replaceChildren();
  anHoanTac();
  for (const m of SO_MAN.values()) m.don();
  $('noi-dung').replaceChildren(el('section', { 'data-man': 'het-phien', 'aria-label': 'Hết phiên' },
    el('div', { class: 'the het-phien' }, el('h1', {}, 'Hết phiên'),
      el('p', {}, 'Phiên đăng nhập đã hết hoặc không còn hợp lệ. Dữ liệu đã được gỡ khỏi trang.'),
      el('button', { type: 'button', class: 'nut-chinh', 'data-act': 'dang-nhap-lai' }, 'Đăng nhập lại'))));
  $('ten-man').textContent = 'Hết phiên';
  $('trang-thai-he').textContent = '';
  bao('Hết phiên — đăng nhập lại');
}

const nutMenu = () => document.querySelector('[data-act="mo-menu"]');
function datMenu(mo, veNut = true) {
  document.body.classList.toggle('mo-menu', mo);
  $('che-menu').hidden = !mo;
  document.querySelector('.workspace').inert = mo;
  nutMenu().setAttribute('aria-expanded', String(mo));
  if (mo) $('cac-mach').querySelector('a').focus();
  else if (veNut) nutMenu().focus();
}
const menuMo = () => document.body.classList.contains('mo-menu');

function batDau() {
  ganGiaoDien();
  datXuLy({ hetPhien: veHetPhien, chiDoc: () => bao('Chỉ đọc — máy chủ đang tắt ghi.') });
  $('cac-mach').replaceChildren(...MACH.map(([id, ten]) => el('a', { href: '#' + id, class: 'lk-mach' }, ten)));
  dangKyHanhDong('mo-menu', () => datMenu(true));
  dangKyHanhDong('dong-menu', () => datMenu(false));
  dangKyHanhDong('dang-nhap-lai', () => location.reload());
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menuMo()) datMenu(false); });
  $('danh-sach-mach').addEventListener('click', e => { if (menuMo() && e.target.closest('a[href^="#"]')) datMenu(false, false); });
  window.addEventListener('hashchange', veMan);
  lienKet().then(o => {
    const href = urlNgoai(o.hub), a = $('lk-hub');
    if (!href) return;
    for (const [k, v] of [['href', href], ['target', '_blank'], ['rel', 'noopener noreferrer']]) a.setAttribute(k, v);
    a.removeAttribute('data-chua-noi');
    a.textContent = 'Không gian gia đình ↗';
  });
  veMan();
  document.documentElement.dataset.san = '1';
}
batDau();
