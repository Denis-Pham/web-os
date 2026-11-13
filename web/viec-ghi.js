// Ghi của màn «Việc & lịch» (B2): form thêm/sửa việc + lịch (hộp thoại), gửi gói POST /api/goi, Hoàn tác từng bước (LICH_SU), giữ focus sau ghi.
// viec-lich.js nối taiLai + tim qua noiGhi (R3: không import vòng). Thanh Hoàn tác dùng hienHoanTac của giao-dien.js (ganGiaoDien đã gắn data-act="hoan-tac").
import { el } from './dom.js';
import { goiApi, khoaLap, LoiApi, LoiChiDoc, LoiMang, LoiPhien } from './api.js';
import { bao, dangKyHanhDong, dongHop, hienHoanTac, moHop, oNgay } from './giao-dien.js';

export const LICH_SU = [];
export let ghiDuoc = false;
export const datGhi = v => { ghiDuoc = v; };
let taiLai = async () => {}, tim = () => null, dangGui = false, khoa = null, dauOps = null, dauHop = null, chup = null;
export const noiGhi = (tai, timDong) => { taiLai = tai; tim = timDong; };
// Rời màn (het_luc): xoá mọi biến giữ dữ liệu người dùng gõ/đọc (bản chụp hộp, gói ops của lần ghi lỗi, khoá lặp, Hoàn tác).
export function donGhi() { LICH_SU.length = 0; dauOps = khoa = dauHop = chup = null; ghiDuoc = dangGui = false; }

const NUT_GHI = '[data-act="them-viec"],[data-act="them-lich"],[data-act="sua"],[data-act="xoa"],[data-act="xong"],[data-act="mo-lai"]';
const TEN_TRUONG = { tieu_de: 'Tên', han: 'Hạn', ghi_chu: 'Ghi chú', bat_dau: 'Ngày giờ', dia_diem: 'Địa điểm', ca_ngay: 'Cả ngày' };
const TEN_BANG = { viec: 'việc', lich: 'lịch' };

function tinLoi(e) {
  if (e instanceof LoiChiDoc) return 'Ghi đang tắt — chỉ đọc.';
  if (e instanceof LoiMang) return 'Mất kết nối — chưa lưu được.';
  if (e instanceof LoiApi && e.ma === 409 && e.loi === 'phien_ban') return 'Dòng này vừa đổi ở chỗ khác — em tải lại.';
  if (e instanceof LoiApi && e.ma === 400 && e.loi === 'luoc_do') return `Chưa lưu: ô «${TEN_TRUONG[e.chi_tiet?.truong] ?? 'dữ liệu'}» chưa hợp lệ.`;
  return 'Máy chủ báo lỗi: ' + (e?.loi ?? e?.message ?? 'không rõ') + '.';
}

// khoa_lap sinh MỘT lần mỗi lần bấm: thử lại cùng thao tác thì giữ khoá (không nhân đôi gói).
export async function guiGoi(ops, tin) {
  if (dangGui) return false;
  dangGui = true;
  const dau = JSON.stringify(ops);
  if (dau !== dauOps) { dauOps = dau; khoa = khoaLap(); }
  let o;
  try { o = await goiApi('/api/goi', { method: 'POST', than: { khoa_lap: khoa, ops } }); }
  catch (e) {
    if (e instanceof LoiPhien) return false;
    if (e instanceof LoiChiDoc) { datGhi(false); for (const n of document.querySelectorAll(NUT_GHI)) n.disabled = true; }
    const t = tinLoi(e), cho = document.querySelector('#hop [data-loi]');
    bao(t);
    if (cho) cho.textContent = t;
    if (e instanceof LoiApi && e.loi === 'phien_ban') taiLai();
    return false;
  } finally { dangGui = false; }
  dauOps = null;
  nhanHoanTac(o.ma_hoan, tin);
  bao(tin);
  await taiLai();
  return true;
}

// Gói đã ghi (guiGoi, hoặc Áp dụng đề xuất ở ai.js) ⇒ nhận mã hoàn tác + hiện thanh Hoàn tác.
export function nhanHoanTac(ma_hoan, tin) {
  LICH_SU.push({ ma_hoan, tin });
  hienHoanTac(tin, hoanTac);
}
export const timDong = (bang, id) => tim(bang, id);

export async function hoanTac() {
  const b = LICH_SU.pop();
  if (!b) return;
  try {
    await goiApi('/api/hoan', { method: 'POST', than: { ma_hoan: b.ma_hoan } });
    bao('Đã hoàn tác: ' + b.tin);
  } catch (e) {
    if (e instanceof LoiPhien) return;
    bao(e instanceof LoiApi && e.loi === 'da_sua_sau' ? 'Anh đã sửa sau — không hoàn tác được.' : tinLoi(e));
  }
  if (LICH_SU.length) hienHoanTac(LICH_SU.at(-1).tin, hoanTac);
  return taiLai();
}

// ----- focus: nút đã mở hộp (hoặc nút đầu dòng kế khi dòng mất, hết dòng ⇒ tiêu đề danh sách) -----
const man = () => document.querySelector('section[data-man="cos"]');
const dongCua = n => {
  const r = n.closest('[data-viec],[data-lich]');
  return r && { bang: r.dataset.viec !== undefined ? 'viec' : 'lich', id: r.dataset.viec ?? r.dataset.lich, r };
};
function dauVet(n) {
  const d = dongCua(n), act = n.dataset.act;
  if (!d) return { act, bang: act === 'them-lich' ? 'lich' : 'viec' };
  return { act, bang: d.bang, id: d.id, ke: d.r.nextElementSibling?.dataset[d.bang] };
}
function datFocus(v) {
  const g = man(), nut = v.act === 'xong' || v.act === 'mo-lai' ? '[aria-pressed]' : `[data-act="${v.act}"]`;
  const cu = g?.querySelector(v.id ? `[data-${v.bang}="${v.id}"] ${nut}` : nut);
  const ke = v.ke && g.querySelector(`[data-${v.bang}="${v.ke}"] button`);
  (cu ?? ke ?? g?.querySelector(`[data-tieu-de="${v.bang}"]`))?.focus();
}

// ----- form -----
const o = (nhan, ...con) => el('label', { class: 'o-form' }, el('span', {}, nhan), ...con);
const nutHop = () => el('div', { class: 'nut-hop' }, el('p', { 'data-loi': '', role: 'alert', class: 'nhan-loi' }),
  el('button', { type: 'submit', class: 'nut-chinh', 'data-act': 'luu' }, 'Lưu'), el('button', { type: 'button', 'data-act': 'huy' }, 'Huỷ'));

function hopViec(v) {
  moHop(v ? 'Sửa việc' : 'Thêm việc', el('form', { 'data-form': 'viec', 'data-id': v?.id },
    o('Tên việc', el('input', { name: 'tieu_de', maxlength: 200, value: v?.tieu_de, autocomplete: 'off' })),
    o('Hạn', oNgay('han', v?.han?.slice(0, 10))),
    o('Ghi chú', el('textarea', { name: 'ghi_chu', maxlength: 2000, rows: 3 }, v?.ghi_chu)),
    v && el('p', { 'data-tien-do': '' }, 'Tiến độ: đang tải…'), nutHop()));
  if (!v) return;
  goiApi('/api/tien-do?viec=' + encodeURIComponent(v.id)).then(r => {
    const t = r.tien_do.at(-1), p = document.querySelector('#hop [data-tien-do]');
    if (p) p.textContent = t ? `Tiến độ: ${t.phan_tram ?? '—'}% · ${t.ghi ?? ''}` : 'Tiến độ: chưa có';
  }, () => {});
}
function hopLich(l) {
  moHop(l ? 'Sửa lịch' : 'Thêm lịch', el('form', { 'data-form': 'lich', 'data-id': l?.id },
    o('Tên lịch', el('input', { name: 'tieu_de', maxlength: 200, value: l?.tieu_de, autocomplete: 'off' })),
    o('Ngày', oNgay('ngay', l?.bat_dau?.slice(0, 10))),
    o('Giờ (bỏ trống = cả ngày)', el('input', { type: 'time', name: 'gio', value: l?.bat_dau?.slice(11, 16) })),
    o('Địa điểm', el('input', { name: 'dia_diem', maxlength: 200, value: l?.dia_diem, autocomplete: 'off' })), nutHop()));
}

async function luu(n, e) {
  e.preventDefault();
  const f = n.closest('form'), bang = f.dataset.form, id = f.dataset.id, g = ten => f.elements[ten].value.trim() || null;
  const moi = bang === 'viec' ? { tieu_de: g('tieu_de') ?? '', han: g('han'), ghi_chu: g('ghi_chu') }
    : { tieu_de: g('tieu_de') ?? '', bat_dau: g('ngay') ? g('ngay') + (g('gio') ? 'T' + g('gio') : '') : '', ca_ngay: g('gio') ? 0 : 1, dia_diem: g('dia_diem') };
  let op;
  if (id) {
    const c = chup?.bang === bang && chup.id === id ? chup.c : null;   // dòng LÚC MỞ hộp, không phải dòng mới đọc: 409 thật ⇒ Lưu lần hai vẫn 409
    if (!c) return;
    const cu = bang === 'viec' ? { tieu_de: c.tieu_de, han: c.han?.slice(0, 10) ?? null, ghi_chu: c.ghi_chu ?? null }
      : { tieu_de: c.tieu_de, bat_dau: c.bat_dau.slice(0, 16), ca_ngay: c.ca_ngay, dia_diem: c.dia_diem ?? null };
    const doi = Object.fromEntries(Object.entries(moi).filter(([k, v]) => v !== cu[k]));
    if (!Object.keys(doi).length) { dongHop(); return; }
    op = { loai: 'sua', bang, id, phien_ban: c.phien_ban, truong: doi };
  } else op = { loai: 'them', bang, truong: Object.fromEntries(Object.entries(moi).filter(([, v]) => v !== null)) };
  const ten = `${TEN_BANG[bang]} «${(moi.tieu_de || '').slice(0, 40)}»`;
  if (await guiGoi([op], `Đã ${id ? 'sửa' : 'thêm'} ${ten}`)) { dongHop(); datFocus(dauHop); }
}

// Nút trong dòng: sửa (mở hộp) · xoá · xong/mở lại (gửi thẳng, có Hoàn tác).
async function tacDong(n) {
  const d = dongCua(n), c = d && tim(d.bang, d.id), act = n.dataset.act;
  if (!c) return;
  if (act === 'sua') { dauHop = dauVet(n); chup = { bang: d.bang, id: d.id, c: { ...c } }; if (d.bang === 'viec') hopViec(c); else hopLich(c); return; }
  const loai = act === 'xoa' ? 'xoa' : act === 'xong' ? 'xong' : 'mo_lai', v = dauVet(n);
  if (await guiGoi([{ loai, bang: d.bang, id: d.id, phien_ban: c.phien_ban }], `Đã ${{ xoa: 'xoá', xong: 'xong', mo_lai: 'mở lại' }[loai]} ${TEN_BANG[d.bang]} «${c.tieu_de.slice(0, 40)}»`)) datFocus(v);
}

for (const a of ['sua', 'xoa', 'xong', 'mo-lai']) dangKyHanhDong(a, tacDong);
dangKyHanhDong('them-viec', n => { dauHop = dauVet(n); hopViec(null); });
dangKyHanhDong('them-lich', n => { dauHop = dauVet(n); hopLich(null); });
dangKyHanhDong('luu', luu);
dangKyHanhDong('huy', () => dongHop());
