// Màn «Bản giao diện» (#ban, thiết kế 6): bản đang chạy, bản trước (Lùi), bản chờ: danh sách tệp mới/sửa/giữ/xoá, xem tệp gắn với manifest
// anh thấy (GET /api/ban/tep mang manifest của danh sách; bản chờ đổi ⇒ 409 ⇒ tải lại danh sách), Duyệt. Tên SHA chỉ là nhãn neo đặt — anh
// duyệt theo nội dung + manifest. Nội dung tệp vào <pre> bằng nút chữ (el), không HTML. 423 (LoiChiDoc của api.js) ⇒ chỉ đọc, Duyệt/Lùi tắt.
// Duyệt/Lùi xong ⇒ tải lại trang (phien.js đọc SHA mới, SW của bản mới).
import { el } from './dom.js';
import { goiApi, LoiApi, LoiChiDoc, LoiMang, LoiPhien } from './api.js';
import { bao, dangKyHanhDong } from './giao-dien.js';
import { daHetPhien } from './phien.js';

const LOI = {
  ten_dat_truoc: 'có tệp trùng tên dành riêng ban.json', qua_nhieu_tep: 'quá 64 tệp', ten_sai: 'có tên tệp sai luật (tên, đuôi)',
  rong: 'bản rỗng', tong_lon: 'tổng dung lượng quá 1 MiB', tep_lon: 'có tệp quá 20 480 byte', symlink: 'có liên kết tượng trưng',
  khong_phai_tep: 'có mục không phải tệp thường', sai_chu: 'có tệp sai chủ sở hữu', khong_mo: 'không mở được thư mục bản',
};
const TRANG = { moi: 'mới', sua: 'sửa', giu: 'giữ', xoa: 'xoá' };
const NHAN_NEO = 'Duyệt theo nội dung và manifest bên dưới; tên SHA chỉ là nhãn neo đặt, không chứng minh gì.';
const CHI_DOC = 'Duyệt bản đang tắt (chỉ đọc).', DOI = 'Bản chờ đã đổi sau khi anh xem — em tải lại danh sách.';
let duLieu = null, goc = null, chiDoc = false;

const loiHong = ly => 'Bản hỏng: ' + (LOI[ly] ?? ly ?? 'không rõ') + '.';
const dong = (nhan, gt) => el('p', { class: 'dong-ban' }, nhan + ': ', el('code', {}, gt));
const tinBan = chu => goc?.querySelector('[data-ban-tin]')?.replaceChildren(chu);
function tatNut() { for (const n of goc?.querySelectorAll('[data-act="duyet-ban"], [data-act="lui-ban"]') ?? []) n.disabled = true; }

function theCho(b) {
  const the = el('div', { class: 'the the-ban', 'data-cho': b.sha, 'data-manifest': b.manifest ?? '' }, el('h2', {}, 'Bản chờ'), dong('Nhãn', b.sha));
  if (b.loi) { the.append(el('p', { class: 'nhan-loi', 'data-loi': b.loi }, loiHong(b.loi))); return the; }
  the.append(dong('Manifest', b.manifest),
    el('ul', { class: 'ds ds-tep' }, ...b.tep.map(f => el('li', { 'data-tep': f.ten, 'data-trang-thai': f.trang_thai },
      el('span', {}, `${f.ten} — ${TRANG[f.trang_thai] ?? f.trang_thai} · ${f.co} byte`),
      el('button', { type: 'button', 'data-act': 'xem-tep', 'data-sha': b.sha, 'data-ten': f.ten }, 'Xem')))),
    el('div', { class: 'xem-tep', 'data-xem': '', hidden: true }),
    el('button', { type: 'button', class: 'nut-chinh', 'data-act': 'duyet-ban', 'data-sha': b.sha, disabled: chiDoc }, 'Duyệt bản này'));
  return the;
}

function veDs(o) {
  const h = o.hien_tai, t = o.truoc;
  goc.querySelector('[data-hien-tai]').replaceChildren(...(h ? [dong('Nhãn', h.sha), dong('Manifest', h.manifest ?? 'không đọc được')] : [el('p', { class: 'rong' }, 'Chưa có bản nào được duyệt.')]));
  goc.querySelector('[data-truoc]').replaceChildren(t ? dong('Nhãn', t.sha) : el('p', { class: 'rong' }, 'Không có bản trước.'));
  goc.querySelector('[data-act="lui-ban"]').disabled = chiDoc || !t;
  goc.querySelector('[data-ds-cho]').replaceChildren(...o.cho.map(theCho),
    ...(o.qua_nhieu ? [el('p', { class: 'nhan-loi' }, 'Thư mục chờ có quá nhiều mục — anh dọn tay rồi mở lại.')] : []),
    ...(!o.cho.length && !o.qua_nhieu ? [el('p', { class: 'rong' }, 'Không có bản chờ.')] : []));
  tinBan(chiDoc ? CHI_DOC : '');
}

// Lỗi của mọi lệnh ở màn này. Chỉ đọc nhận ra DUY NHẤT qua LoiChiDoc (api.js phân loại 423), không đoán từ mã lỗi.
function xuLyLoi(e) {
  if (e instanceof LoiPhien) return;   // phien.js đã hiện Hết phiên
  if (e instanceof LoiChiDoc) { chiDoc = true; tatNut(); tinBan(CHI_DOC); return; }
  if (e instanceof LoiMang) { bao('Mất kết nối — chưa tải được dữ liệu.'); return; }
  const loi = e instanceof LoiApi ? e.loi : null;
  if (loi === 'manifest_lech') bao(DOI);
  else if (loi === 'ban_hong') bao(loiHong(e.chi_tiet?.ly_do));
  else if (loi === 'khong_co_ban') bao('Bản chờ không còn — em tải lại danh sách.');
  else if (loi === 'khong_co_truoc' || loi === 'truoc_lech') bao('Bản trước đã đổi — em tải lại danh sách.');
  else { bao('Máy chủ báo lỗi: ' + (e?.loi ?? e?.message ?? 'không rõ') + '.'); return; }
  taiLai();
}

async function taiLai() {
  const g = goc;
  let o;
  try { o = await goiApi('/api/ban'); } catch (e) { if (g?.isConnected) xuLyLoi(e); return; }
  if (daHetPhien()) return;   // phản hồi về sau het_luc (đã don()) ⇒ không đưa lại vào đệm
  duLieu = o;
  if (g?.isConnected) veDs(o);
}

const timCho = n => duLieu?.cho.find(c => c.sha === n.dataset.sha && c.manifest);

async function xemTep(n) {
  const b = timCho(n), ten = n.dataset.ten;
  if (!b) return;
  const q = new URLSearchParams({ sha: b.sha, ten, manifest: b.manifest });
  let o;
  try { o = await goiApi('/api/ban/tep?' + q); } catch (e) { xuLyLoi(e); return; }
  const xem = n.isConnected && !daHetPhien() ? n.closest('[data-cho]').querySelector('[data-xem]') : null;
  if (!xem) return;
  const f = o.moi ?? o.cu, nhan = o.moi ? 'Bản chờ' : 'Bản đang chạy (tệp bị xoá ở bản chờ)';
  xem.replaceChildren(el('h3', {}, o.ten), el('p', { class: 'phu' }, `${nhan} · sha256 ${f?.sha256 ?? '—'}`),
    o.nhi_phan ? el('p', { class: 'phu' }, 'Tệp nhị phân — không hiện nội dung.')
      : typeof f?.noi_dung === 'string' ? el('pre', {}, f.noi_dung) : el('p', { class: 'phu' }, 'Không phải chữ UTF-8 — không hiện nội dung.'));
  xem.hidden = false;
}

async function ghi(n, duong, than) {
  n.disabled = true;
  try { await goiApi(duong, { method: 'POST', than }); } catch (e) { n.disabled = chiDoc; xuLyLoi(e); return; }
  location.reload();
}

dangKyHanhDong('xem-tep', xemTep);
dangKyHanhDong('duyet-ban', n => { const b = timCho(n); if (b) ghi(n, '/api/ban/duyet', { sha: b.sha, manifest: b.manifest }); });
dangKyHanhDong('lui-ban', n => { if (duLieu?.truoc) ghi(n, '/api/ban/lui', { sha: duLieu.truoc.sha }); });

export const MAN = {
  id: 'ban', ten: 'Bản giao diện',
  async ve(g) {
    goc = g; chiDoc = false;
    g.append(el('div', { class: 'dau-man' }, el('h1', {}, 'Bản giao diện')),
      el('p', { class: 'nhan-neo' }, NHAN_NEO),
      el('p', { class: 'phu', 'data-ban-tin': '' }, 'Đang tải…'),
      el('div', { class: 'the the-ban' }, el('h2', {}, 'Bản đang chạy'), el('div', { 'data-hien-tai': '' })),
      el('div', { class: 'the the-ban' }, el('h2', {}, 'Bản trước'), el('div', { 'data-truoc': '' }),
        el('button', { type: 'button', 'data-act': 'lui-ban', disabled: true }, 'Lùi về bản trước')),
      el('div', { class: 'ds-cho', 'data-ds-cho': '' }));
    // GET /api/ban trả 423 khi ghi tắt ⇒ không có thẻ bản chờ nào: hỏi ban_ghi ở /api/phien để vẫn vẽ nút Duyệt tắt («chỉ đọc» do chính lệnh 423 đó báo).
    try {
      if ((await goiApi('/api/phien')).ban_ghi === false) {
        goc.querySelector('[data-ds-cho]').append(el('div', { class: 'the the-ban' }, el('h2', {}, 'Bản chờ'),
          el('button', { type: 'button', class: 'nut-chinh', 'data-act': 'duyet-ban', disabled: true }, 'Duyệt bản này')));
      }
    } catch (e) { if (e instanceof LoiPhien) return; }
    if (duLieu) veDs(duLieu);
    await taiLai();
  },
  don() { duLieu = null; goc = null; },
};
