// Màn «Việc & lịch» (B2, mạch `cos`): brief sáng (4 số từ GET /api/brief) · việc · lịch 14 ngày (hôm nay … +13, giờ VN) · nhóm Việc nhà (Hub, CHỈ ĐỌC,
// từ viec-bo.json qua GET /api/viec-bo) · hai liên kết xuất. Nút ghi disabled ngay khi vẽ nếu /api/phien báo cos_ghi ≠ true. Ghi nằm ở viec-ghi.js.
// Đệm (dem) chỉ ở bộ nhớ trang, don() xoá. Mọi chữ từ kho vào DOM bằng el() (nút chữ).
import { el, ngayVN } from './dom.js';
import { goiApi, LoiChiDoc, LoiMang, LoiPhien } from './api.js';
import { anHoanTac, bao } from './giao-dien.js';
import { daHetPhien } from './phien.js';
import { phanTep } from './man-chu.js';
import { chuaNoi, lienKet, lienKetNgoai, urlNgoai } from './mach.js';
import { datGhi, donGhi, ghiDuoc, noiGhi } from './viec-ghi.js';

const SO = [['qua_han', 'Quá hạn'], ['han_hom_nay', 'Hạn hôm nay'], ['lich_hom_nay', 'Lịch hôm nay'], ['de_xuat_cho', 'Đề xuất chờ']];
let goc = null, dem = null;
const homNay = (them = 0) => new Date(Date.now() + 7 * 3600e3 + them * 864e5).toISOString().slice(0, 10);
const gioHan = s => (s ? ngayVN(s) + (s.length > 10 ? ' ' + s.slice(11, 16) : '') : '');

const veBrief = b => el('div', { class: 'the', 'data-brief': '' }, el('h2', {}, 'Sáng nay'),
  el('div', { class: 'so-brief' }, ...SO.map(([k, ten]) => el('p', {}, el('span', { 'data-so': k }, String(b[k])), ' ', ten))));

const nutDong = (act, chu, ten, them = {}) => el('button', { type: 'button', 'data-act': act, 'aria-label': `${chu}: ${ten}`, disabled: !ghiDuoc, ...them }, chu);
const khung = (bang, tieuDe, ...con) => el('div', { class: 'the' }, el('h2', { 'data-tieu-de': bang, tabindex: '-1' }, tieuDe), ...con);

function veViec(v) {
  const xong = v.xong_luc !== null;
  return el('li', { 'data-viec': v.id, class: xong ? 'da-xong' : null },
    el('div', { class: 'chu-dong' }, el('strong', {}, v.tieu_de), v.han && el('time', {}, 'Hạn ' + gioHan(v.han)), v.ghi_chu && el('small', {}, v.ghi_chu)),
    el('div', { class: 'nut-dong' }, nutDong('sua', 'Sửa', v.tieu_de), nutDong(xong ? 'mo-lai' : 'xong', 'Xong', v.tieu_de, { 'aria-pressed': String(xong) }),
      nutDong('xoa', 'Xoá', v.tieu_de)));
}
const veLich = l => el('li', { 'data-lich': l.id },
  el('div', { class: 'chu-dong' }, el('strong', {}, l.tieu_de), el('time', {}, ngayVN(l.bat_dau) + (l.ca_ngay ? ' · cả ngày' : ' · ' + l.bat_dau.slice(11, 16))), l.dia_diem && el('small', {}, l.dia_diem)),
  el('div', { class: 'nut-dong' }, nutDong('sua', 'Sửa', l.tieu_de), nutDong('xoa', 'Xoá', l.tieu_de)));
const ds = (mang, ve, rong) => (mang.length ? el('ul', { class: 'ds ds-dong' }, ...mang.map(ve)) : el('p', { class: 'rong' }, rong));

function veViecNha(bo, hub) {
  const noi = !bo || bo.trang_thai === 'chua_noi' || bo.trang_thai === 'thieu' ? chuaNoi() : phanTep(bo, x => el('li', { 'data-viec-bo': x.id }, el('strong', {}, x.ten), x.han && el('time', {}, 'Hạn ' + gioHan(x.han)), x.lap && el('small', {}, x.lap)));
  return el('div', { class: 'the', 'data-nhom': 'viec-nha' }, el('h2', {}, 'Việc nhà (chỉ đọc)'), ...[noi].flat(),
    hub ? lienKetNgoai(hub, 'Mở ở Hub') : chuaNoi('Mở ở Hub: chưa nối'));
}

function ve(g) {
  const hub = urlNgoai(dem.hub), mo = [...dem.v.filter(x => x.xong_luc === null), ...dem.v.filter(x => x.xong_luc !== null)];
  g.replaceChildren(
    el('div', { class: 'dau-man' }, el('h1', {}, 'Việc & lịch'), el('div', { class: 'nut-dong' },
      el('button', { type: 'button', class: 'nut-chinh', 'data-act': 'them-viec', disabled: !ghiDuoc }, 'Thêm việc'),
      el('button', { type: 'button', 'data-act': 'them-lich', disabled: !ghiDuoc }, 'Thêm lịch'),
      el('button', { type: 'button', 'data-act': 'hoi-ai', hidden: true }, 'Hỏi AI'))),
    el('div', { class: 'luoi-cos' }, veBrief(dem.b),
      khung('viec', 'Việc', ds(mo, veViec, 'Chưa có việc nào.')),
      khung('lich', 'Lịch 14 ngày tới', ds(dem.l, veLich, 'Không có lịch nào trong 14 ngày tới.')),
      veViecNha(dem.bo, hub),
      el('div', { class: 'the' }, el('h2', {}, 'Xuất danh sách'), el('div', { class: 'nut-dong' },
        el('a', { class: 'nut-lk', href: '/api/xuat-viec?dang=csv', download: '' }, 'Tải CSV'),
        el('a', { class: 'nut-lk', href: '/api/xuat-viec?dang=json', download: '' }, 'Tải JSON')))));
}

function loiNap(e) {
  if (e instanceof LoiPhien || e instanceof LoiChiDoc) return;
  bao(e instanceof LoiMang ? 'Mất kết nối — chưa tải được dữ liệu.' : 'Máy chủ báo lỗi: ' + (e?.loi ?? e?.message ?? 'không rõ') + '.');
}

async function nap() {
  try {
    const b = await goiApi('/api/brief');
    const v = (await goiApi('/api/viec')).viec;
    const l = (await goiApi(`/api/lich?tu=${homNay()}&den=${homNay(13)}`)).lich;
    const bo = (await goiApi('/api/viec-bo')).viec_bo;
    const lk = await lienKet();
    if (daHetPhien() || !goc?.isConnected) return;   // phản hồi về sau het_luc / sau khi rời màn ⇒ không vào đệm
    dem = { b, v, l, bo, hub: lk.hub };
    ve(goc);
  } catch (e) { loiNap(e); }
}
export async function taiLai() { await nap(); }
const tim = (bang, id) => dem?.[bang === 'viec' ? 'v' : 'l'].find(x => x.id === id) ?? null;

export const MAN = {
  id: 'cos', ten: 'Việc & lịch',
  async ve(g) {
    goc = g;
    g.append(el('div', { class: 'dau-man' }, el('h1', {}, 'Việc & lịch')), el('p', { class: 'rong' }, 'Đang tải…'));
    noiGhi(taiLai, tim);
    try { datGhi((await goiApi('/api/phien')).cos_ghi === true); } catch (e) { loiNap(e); return; }
    await nap();
  },
  don() { donGhi(); dem = null; goc = null; anHoanTac(); },
};
