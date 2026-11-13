// Màn chủ «Hôm nay» (thiết kế 8): MỘT lần GET /api/man-chu ⇒ 8 khối. Khối tệp { trang_thai, du_lieu, gio_dung }: tot ⇒ dữ liệu;
// cu ⇒ dữ liệu + «cũ, dựng lúc …»; hong ⇒ bản tốt cuối (nếu có) + «hỏng, dựng lúc …»; thieu / chua_noi ⇒ «chưa nối» (không số bịa).
// Đầu trang (R9) không bao giờ tự ghi «ổn». Mọi chữ từ kho/tệp vào DOM bằng el() (nút chữ). Đệm duLieu bị don() xoá.
import { el, gioVN } from './dom.js';
import { goiApi } from './api.js';
import { dangKyHanhDong } from './giao-dien.js';
import { daHetPhien } from './phien.js';

const NHAN = { chua_noi: 'chưa nối', thieu: 'chưa nối', hong: 'hỏng', cu: 'cũ' };
const KHOI = [
  ['lich_hom_nay', 'Lịch hôm nay'], ['cho_anh', 'Chờ anh hôm nay'], ['suc_khoe', 'Sức khoẻ hệ thống'], ['xai_duoc', 'Mở ra, dùng ngay'],
  ['tien_do', 'Đang xây đến đâu'], ['chi_phi_token', 'Chi phí token'], ['nhat_ky', 'Nhật ký 24 giờ'], ['agent_dang_chay', 'Trợ lý đang chạy'],
];
const MO_SAN = ['lich_hom_nay', 'cho_anh'];   // ≤ 760 px: hai thẻ này mở sẵn, 6 thẻ còn lại gập
const CAN_XEM = new Set(['chua_noi', 'hong', 'cu', 'chưa nối', 'hỏng', 'cũ']);
const BANG = { viec: 'việc', lich: 'lịch', tien_do: 'tiến độ', de_xuat: 'đề xuất' };
let duLieu = null;

const chuaNoi = k => !k || k.trang_thai === 'chua_noi' || k.trang_thai === 'thieu';
function nhan(k) {
  const n = NHAN[k?.trang_thai];
  if (!n) return null;
  return (k.trang_thai === 'cu' || k.trang_thai === 'hong') && k.gio_dung ? `${n}, dựng lúc ${gioVN(k.gio_dung)}` : n;
}
const gio = s => (typeof s === 'string' && s.length > 10 ? s.slice(11, 16) : 'Cả ngày');
const ds = (mang, veMuc, rong) => (mang.length ? el('ul', { class: 'ds' }, ...mang.map(veMuc)) : el('p', { class: 'rong' }, rong));

// Phần từ một khối tệp: nhãn (nếu không tốt) + danh sách (nếu có dữ liệu, kể cả bản tốt cuối khi hỏng).
export function phanTep(k, veMuc) {
  const n = nhan(k);
  return [n && el('p', { class: k.trang_thai === 'hong' ? 'nhan-khoi nhan-loi' : 'nhan-khoi' }, n),
    Array.isArray(k?.du_lieu) && ds(k.du_lieu, veMuc, 'Chưa có mục nào.')];
}
const muc = (...con) => el('li', {}, ...con);
const VE = {
  xai_duoc: k => phanTep(k, x => muc(el('strong', {}, x.ten), el('span', {}, x.lam_gi), el('small', {}, x.o_dau))),
  cho_anh: k => phanTep(k, x => muc(el('strong', {}, `${x.ma} · ${x.tieu_de}`), el('span', {}, x.hanh_dong))),
  suc_khoe: k => phanTep(k, x => muc(el('strong', {}, x.ten), el('span', {}, x.trang_thai))),
  tien_do: k => phanTep(k, x => muc(el('strong', {}, x.mach), el('span', {}, x.dang_lam), el('small', {}, 'Bước kế: ' + x.buoc_ke))),
  chi_phi_token: k => phanTep(k, () => null),
  agent_dang_chay: k => phanTep(k, () => null),
  nhat_ky: k => [
    ds(k.du_lieu?.kho ?? [], n => muc(el('time', {}, gioVN(n.luc)),
      el('span', {}, `${n.truoc ? (n.sau ? 'Sửa' : 'Xoá') : 'Thêm'} ${BANG[n.bang] ?? n.bang}: ${n.sau?.tieu_de ?? n.truoc?.tieu_de ?? n.dong_id}`)), 'Kho chưa đổi gì trong 24 giờ.'),
    el('div', { class: 'phan', 'data-phan': 'tong_quan' }, el('h3', {}, 'Tổng quan'), ...phanTep(k.du_lieu?.tong_quan, x => muc(el('time', {}, gioVN(x.luc)), el('span', {}, x.dong)))),
  ],
  lich_hom_nay: k => {
    const d = k.du_lieu ?? {}, lich = d.lich ?? [], viec = d.viec ?? [];
    return [
      lich.length || viec.length ? el('ul', { class: 'ds' },
        ...lich.map(l => el('li', { 'data-lich': l.id }, el('time', {}, l.ca_ngay ? 'Cả ngày' : gio(l.bat_dau)), el('span', {}, l.tieu_de))),
        ...viec.map(v => el('li', { 'data-viec': v.id }, el('time', {}, gio(v.han)), el('span', {}, v.tieu_de)))) : el('p', { class: 'rong' }, 'Hôm nay chưa có lịch hay việc đến hạn.'),
      el('div', { class: 'phan', 'data-phan': 'viec_bo' }, el('h3', {}, 'Việc nhà'), ...phanTep(d.viec_bo, b => el('li', { 'data-viec-bo': b.id }, el('span', {}, b.ten)))),
    ];
  },
};

function trangThaiHe(o) {
  const s = o.suc_khoe;
  if (chuaNoi(s) || !Array.isArray(s.du_lieu)) return 'Sức khoẻ: ' + (NHAN[s?.trang_thai] ?? NHAN.chua_noi);
  const n = s.du_lieu.filter(x => CAN_XEM.has(x.trang_thai)).length + (s.trang_thai === 'tot' ? 0 : 1);
  return n ? `Có ${n} tín hiệu cần xem` : 'Dựng lúc ' + gioVN(s.gio_dung);
}

function veLuoi(luoi, o) {
  luoi.replaceChildren(...KHOI.map(([k, ten], i) => {
    const mo = MO_SAN.includes(k), than = el('div', { class: 'than-khoi', id: 'than-' + k }, ...VE[k](o[k] ?? {}));
    return el('section', { class: mo ? 'the khoi' : 'the khoi gap', 'data-khoi': k, 'data-chua-noi': chuaNoi(o[k]) ? '' : null, 'aria-labelledby': 'tk-' + k },
      el('div', { class: 'dau-khoi' }, el('span', { class: 'so-khoi' }, String(i + 1).padStart(2, '0')), el('h2', { id: 'tk-' + k }, ten),
        el('button', { type: 'button', class: 'nut-gap', 'data-act': 'gap', 'aria-expanded': String(mo), 'aria-controls': 'than-' + k, 'aria-label': ten + ': mở hoặc gập' }, mo ? '−' : '+')),
      than);
  }));
  document.getElementById('trang-thai-he').textContent = trangThaiHe(o);
}

dangKyHanhDong('gap', n => {
  const mo = n.getAttribute('aria-expanded') !== 'true';
  n.setAttribute('aria-expanded', String(mo));
  n.textContent = mo ? '−' : '+';
  n.closest('[data-khoi]').classList.toggle('gap', !mo);
});

const homNay = () => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());

export const MAN = {
  id: 'chu', ten: 'Hôm nay',
  async ve(goc) {
    const luoi = el('div', { class: 'luoi-chu' });
    goc.append(el('div', { class: 'dau-man' }, el('h1', {}, 'Một ngày, rõ việc.'), el('p', { class: 'phu' }, homNay())), luoi);
    if (duLieu) veLuoi(luoi, duLieu); else luoi.append(el('p', { class: 'rong' }, 'Đang tải…'));
    const o = await goiApi('/api/man-chu');
    if (daHetPhien()) return;   // phản hồi về sau het_luc (đã don()) ⇒ không đưa lại vào đệm
    duLieu = o;
    if (luoi.isConnected) veLuoi(luoi, o);
  },
  don() { duLieu = null; },
};
