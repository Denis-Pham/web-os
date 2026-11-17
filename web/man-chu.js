// Màn chủ «Hôm nay» (thiết kế 8, 13 bản Sổ): MỘT lần GET /api/man-chu ⇒ 8 thẻ. Khối tệp { trang_thai, du_lieu, gio_dung }: tot ⇒ dữ liệu;
// cu ⇒ dữ liệu + «cũ, dựng lúc …»; hong ⇒ bản tốt cuối (nếu có) + «hỏng, dựng lúc …»; thieu / chua_noi ⇒ «chưa nối» (không số bịa).
// Thẻ chỉ «xem nhanh» vài dòng (XEM); còn nữa ⇒ nút «Xem cả N» mở hộp thoại liệt kê đủ (VE, như bản trước). Đầu trang (R9) không bao giờ
// tự ghi «ổn». Mọi chữ từ kho/tệp vào DOM bằng el() (nút chữ). Đệm duLieu bị don() xoá.
import { el, svg, gioVN } from './dom.js';
import { goiApi } from './api.js';
import { dangKyHanhDong, moHop } from './giao-dien.js';
import { daHetPhien } from './phien.js';

const NHAN = { chua_noi: 'chưa nối', thieu: 'chưa nối', hong: 'hỏng', cu: 'cũ' };
const KHOI = [
  ['cho_anh', 'Chờ anh hôm nay'], ['lich_hom_nay', 'Lịch hôm nay'], ['suc_khoe', 'Sức khoẻ hệ thống'], ['xai_duoc', 'Mở ra, dùng ngay'],
  ['tien_do', 'Đang xây đến đâu'], ['chi_phi_token', 'Chi phí token'], ['nhat_ky', 'Nhật ký 24 giờ'], ['agent_dang_chay', 'Trợ lý đang chạy'],
];
const TEN = Object.fromEntries(KHOI);
const XEM = { cho_anh: 3, lich_hom_nay: 3, suc_khoe: 3, xai_duoc: 4, tien_do: 3, nhat_ky: 3 };
const MO_SAN = ['lich_hom_nay', 'cho_anh'];   // ≤ 760 px: hai thẻ này mở sẵn, 6 thẻ còn lại gập
const CAN_XEM = new Set(['chua_noi', 'hong', 'cu', 'chưa nối', 'hỏng', 'cũ']);
const BANG = { viec: 'việc', lich: 'lịch', tien_do: 'tiến độ', de_xuat: 'đề xuất' };
let duLieu = null;

const chuaNoi = k => !k || k.trang_thai === 'chua_noi' || k.trang_thai === 'thieu';
const chuNhan = v => (Object.hasOwn(NHAN, v) ? NHAN[v] : v);
function nhan(k) {
  const n = NHAN[k?.trang_thai];
  if (!n) return null;
  return (k.trang_thai === 'cu' || k.trang_thai === 'hong') && k.gio_dung ? `${n}, dựng lúc ${gioVN(k.gio_dung)}` : n;
}
const nhanEl = k => { const n = nhan(k); return n && el('p', { class: k.trang_thai === 'hong' ? 'nhan-khoi nhan-loi' : 'nhan-khoi' }, n); };
const gio = s => (typeof s === 'string' && s.length > 10 ? s.slice(11, 16) : 'Cả ngày');
const hai = n => String(n).padStart(2, '0');
const mang = k => (Array.isArray(k?.du_lieu) ? k.du_lieu : []);
const ds = (m, veMuc, rong) => (m.length ? el('ul', { class: 'ds' }, ...m.map(veMuc)) : el('p', { class: 'rong' }, rong));
const cat = (chu, tuy = {}) => el('span', { class: 'cat', ...tuy }, chu);

// Phần từ một khối tệp: nhãn (nếu không tốt) + danh sách (nếu có dữ liệu, kể cả bản tốt cuối khi hỏng).
export function phanTep(k, veMuc) {
  return [nhanEl(k), Array.isArray(k?.du_lieu) && ds(k.du_lieu, veMuc, 'Chưa có mục nào.')];
}
const muc = (...con) => el('li', {}, ...con);
const chuNk = n => `${n.truoc ? (n.sau ? 'Sửa' : 'Xoá') : 'Thêm'} ${BANG[n.bang] ?? n.bang}: ${n.sau?.tieu_de ?? n.truoc?.tieu_de ?? n.dong_id}`;
// Liệt kê đủ (hộp «Xem cả N»), như bản trước.
const VE = {
  xai_duoc: k => phanTep(k, x => muc(el('strong', {}, x.ten), el('span', {}, x.lam_gi), el('small', {}, x.o_dau))),
  cho_anh: k => phanTep(k, x => muc(el('strong', {}, `${x.ma} · ${x.tieu_de}`), el('span', {}, x.hanh_dong))),
  suc_khoe: k => phanTep(k, x => muc(el('strong', {}, x.ten), el('span', {}, chuNhan(x.trang_thai)))),
  tien_do: k => phanTep(k, x => muc(el('strong', {}, x.mach), el('span', {}, x.dang_lam), el('small', {}, 'Bước kế: ' + x.buoc_ke))),
  nhat_ky: k => [
    ds(k.du_lieu?.kho ?? [], n => muc(el('time', {}, gioVN(n.luc)), el('span', {}, chuNk(n))), 'Kho chưa đổi gì trong 24 giờ.'),
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

// Dòng xem nhanh của lịch (lịch, việc hạn hôm nay, việc nhà) và nhật ký (kho + Tổng quan, mới nhất trước).
function dongLich(d) {
  const bo = mang(d.viec_bo);
  return [...(d.lich ?? []).map(l => ['data-lich', l.id, l.ca_ngay ? 'Cả ngày' : gio(l.bat_dau), l.tieu_de]),
    ...(d.viec ?? []).map(v => ['data-viec', v.id, gio(v.han), v.tieu_de]), ...bo.map(b => ['data-viec-bo', b.id, gio(b.han), b.ten])];
}
const dongNk = d => [...(d?.kho ?? []).map(n => [n.luc, chuNk(n)]), ...mang(d?.tong_quan).map(x => [x.luc, x.dong])]
  .sort((a, b) => (Date.parse(b[0]) || 0) - (Date.parse(a[0]) || 0));
const DEM = { lich_hom_nay: k => dongLich(k.du_lieu ?? {}).length, nhat_ky: k => dongNk(k.du_lieu).length };
const dem = (k, o) => (DEM[k] ?? (x => mang(x).length))(o[k] ?? {});

// Số tín hiệu cần xem của khối sức khoẻ (null = chưa nối) — một hàm cho đầu trang và con dấu trong thẻ.
function canXem(s) {
  if (chuaNoi(s) || !Array.isArray(s.du_lieu)) return null;
  return s.du_lieu.filter(x => CAN_XEM.has(x.trang_thai)).length + (s.trang_thai === 'tot' ? 0 : 1);
}
function trangThaiHe(o) {
  const s = o.suc_khoe, n = canXem(s);
  if (n === null) return ['Sức khoẻ: ' + (NHAN[s?.trang_thai] ?? NHAN.chua_noi), 'chua-noi'];
  return n ? [`Có ${n} tín hiệu cần xem`, 'can-xem'] : ['Dựng lúc ' + gioVN(s.gio_dung), 'tot'];
}

const xem = (k, m, veMuc, lop = 'xem') => (m.length ? el('ul', { class: lop }, ...m.slice(0, XEM[k]).map(veMuc)) : null);
const NHANH = {
  cho_anh: k => [nhanEl(k), xem('cho_anh', mang(k), x => el('li', {}, svg('cos'), cat(`${x.ma} · ${x.tieu_de}`)))
    ?? (Array.isArray(k.du_lieu) && el('p', { class: 'rong' }, 'Không có việc nào chờ anh.'))],
  lich_hom_nay: k => {
    const d = k.du_lieu ?? {}, n = nhan(d.viec_bo);
    return [xem('lich_hom_nay', dongLich(d), ([a, id, g, t]) => el('li', { class: 'dong-lich', [a]: id }, el('time', { 'data-phu': '' }, g), cat(t, { class: 'cat nhan-lich' })))
      ?? el('p', { class: 'rong' }, 'Hôm nay chưa có lịch hay việc đến hạn.'),
    n && el('p', { class: 'ghi-nho', 'data-phu': '', 'data-phan': 'viec_bo' }, 'Việc nhà · ' + n)];
  },
  suc_khoe: k => {
    const n = canXem(k);
    return [nhanEl(k), n !== null && el('p', { class: n ? 'dau-khien can-xem' : 'dau-khien' }, svg('khien'), el('strong', {}, n ? `Có ${n} tín hiệu cần xem` : 'Không có tín hiệu cần xem')),
      xem('suc_khoe', mang(k), x => el('li', { 'data-phu': '' }, cat(x.ten), el('strong', { class: 'cat' }, chuNhan(x.trang_thai))), 'xem so-do')];
  },
  xai_duoc: k => [nhanEl(k), xem('xai_duoc', mang(k), x => el('li', {}, svg('mui-ten'), cat(x.ten)), 'luoi-mo')],
  tien_do: k => [nhanEl(k), xem('tien_do', mang(k), x => el('li', { 'data-phu': '' }, el('strong', { class: 'cat' }, x.mach), cat('Bước kế: ' + x.buoc_ke)), 'xem ds-td')],
  chi_phi_token: k => (chuaNoi(k) ? [el('p', { class: 'so-lon' }, '—'), el('p', { class: 'ghi-nho', 'data-phu': '' }, 'chưa nối')] : nhanEl(k)),
  nhat_ky: k => [xem('nhat_ky', dongNk(k.du_lieu), ([luc, chu]) => el('li', { class: 'dong-nk' }, el('time', {}, gioVN(luc).slice(0, 5)), cat(chu)))
    ?? el('p', { class: 'rong' }, 'Chưa có gì trong 24 giờ.'), nhan(k.du_lieu?.tong_quan) && el('p', { class: 'ghi-nho', 'data-phu': '' }, 'Tổng quan · ' + nhan(k.du_lieu.tong_quan))],
  agent_dang_chay: k => (chuaNoi(k) ? el('p', { class: 'rong' }, 'Chưa có nguồn cho biết trợ lý nào đang chạy.') : nhanEl(k)),
};

const ngayDm = () => { const [, m, d] = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10).split('-'); return `${d} / ${m}`; };
const mark = (chu, lop = 'nhan-phai') => el('span', { class: lop, 'data-phu': '' }, chu);
const NHAN_PHAI = {
  cho_anh: (k, n) => !chuaNoi(k) && mark(hai(n) + ' việc', 'nhan-phai nhan-the'),
  lich_hom_nay: () => mark(ngayDm()),
  xai_duoc: (k, n) => !chuaNoi(k) && mark(n + ' món'),
  tien_do: (k, n) => !chuaNoi(k) && mark(n + ' mạch'),
  nhat_ky: () => mark('Gần nhất trước'),
  agent_dang_chay: (k, n) => mark(chuaNoi(k) ? 'chưa nối' : hai(n)),
};

function veLuoi(luoi, o) {
  luoi.replaceChildren(...KHOI.map(([k, ten], i) => {
    const mo = MO_SAN.includes(k), n = dem(k, o), than = el('div', { class: 'than-khoi', id: 'than-' + k }, ...[NHANH[k](o[k] ?? {})].flat());
    return el('section', { class: mo ? 'the khoi' : 'the khoi gap', 'data-khoi': k, 'data-chua-noi': chuaNoi(o[k]) ? '' : null, 'aria-labelledby': 'tk-' + k },
      el('div', { class: 'dau-khoi' }, el('span', { class: 'so-khoi', 'data-phu': '' }, hai(i + 1)), el('h2', { id: 'tk-' + k }, ten), NHAN_PHAI[k]?.(o[k] ?? {}, n),
        el('button', { type: 'button', class: 'nut-gap', 'data-act': 'gap', 'aria-expanded': String(mo), 'aria-controls': 'than-' + k, 'aria-label': ten + ': mở hoặc gập' }, mo ? '−' : '+')),
      n > XEM[k] && el('button', { type: 'button', class: 'xem-het', 'data-act': 'xem-het', 'data-xem': k, 'data-phu': '' }, `Xem cả ${n}`),
      than);
  }));
  const [chu, muc] = trangThaiHe(o);
  document.getElementById('trang-thai-he').textContent = chu;
  document.getElementById('cham-he')?.setAttribute('data-muc', muc);
}

dangKyHanhDong('gap', n => {
  const mo = n.getAttribute('aria-expanded') !== 'true';
  n.setAttribute('aria-expanded', String(mo));
  n.textContent = mo ? '−' : '+';
  n.closest('[data-khoi]').classList.toggle('gap', !mo);
});
dangKyHanhDong('xem-het', n => {
  const k = n.dataset.xem;
  if (!duLieu || !Object.hasOwn(VE, k)) return;
  n.focus();   // Safari không đưa focus vào nút khi bấm ⇒ hộp đóng trả focus về đúng nút này
  moHop(TEN[k], el('div', { class: 'nut-hop' }, el('button', { type: 'button', 'data-act': 'dong-hop' }, 'Đóng')), el('div', { class: 'than-hop' }, ...VE[k](duLieu[k] ?? {})));
});

// «THỨ BA, 17 THÁNG 11 · 2026» (chữ hoa bằng CSS), giờ VN.
function ngayChu() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return `${p.weekday}, ${p.day} tháng ${p.month} · ${p.year}`;
}

export const MAN = {
  id: 'chu', ten: 'Hôm nay',
  async ve(goc) {
    const luoi = el('div', { class: 'luoi-chu' });
    goc.append(el('div', { class: 'dau-man dau-chu' }, el('div', {}, el('p', { class: 'ngay-chu', 'data-phu': '' }, ngayChu()), el('h1', {}, 'Một ngày, rõ việc.')),
      el('p', { class: 'ghi-chu-phai', 'data-phu': '' }, el('strong', {}, 'Anh giữ nhịp. AI lo phần còn lại.'), el('span', {}, 'Đây là những gì cần biết hôm nay.'))), luoi);
    if (duLieu) veLuoi(luoi, duLieu); else luoi.append(el('p', { class: 'rong' }, 'Đang tải…'));
    const o = await goiApi('/api/man-chu');
    if (daHetPhien()) return;   // phản hồi về sau het_luc (đã don()) ⇒ không đưa lại vào đệm
    duLieu = o;
    if (luoi.isConnected) veLuoi(luoi, o);
  },
  don() { duLieu = null; },
};
