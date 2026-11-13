// Hỏi AI CoS (B3, mạch `cos`): nút «Hỏi AI» ⇒ POST /api/hoi-ai (AI CHỈ đề xuất, không ghi) ⇒ hộp liệt kê mọi đề xuất chờ (GET /api/de-xuat?mach=cos).
// Bỏ qua ⇒ POST bo-qua. Áp dụng ⇒ POST ap-dung (máy chủ ghi gói + trả ma_hoan) ⇒ thanh Hoàn tác ⇒ taiLai. Mọi chữ từ máy chủ vào DOM bằng el()/textContent.
import { el, ngayVN } from './dom.js';
import { goiApi, khoaLap, LoiApi, LoiChiDoc, LoiMang, LoiPhien } from './api.js';
import { bao, dangKyHanhDong, dongHop, moHop } from './giao-dien.js';
import { nhanHoanTac, timDong } from './viec-ghi.js';
import { taiLai } from './viec-lich.js';

const POST = { method: 'POST', than: {} };

function tinLoi(e) {
  if (e instanceof LoiChiDoc) return 'Ghi đang tắt — chỉ đọc.';
  if (e instanceof LoiMang) return 'Mất kết nối — chưa hỏi được.';
  if (e instanceof LoiApi && (e.ma === 503 || e.ma === 429)) return 'AI đang bận / chưa sẵn';
  if (e instanceof LoiApi && e.ma === 409 && (e.loi === 'de_xuat_ai' || e.loi === 'de_xuat_da_xu_ly')) return 'Đề xuất không còn hợp lệ (việc đã đổi)';
  if (e instanceof LoiApi && e.ma === 409 && e.loi === 'de_xuat_khong_ap_dung') return 'Đề xuất này không áp dụng được — anh bấm Bỏ qua.';
  if (e instanceof LoiApi && e.ma === 409 && e.loi === 'phien_ban') return 'Việc đã đổi sau khi có đề xuất — anh Bỏ qua rồi hỏi lại.';
  return 'Máy chủ báo lỗi: ' + (e?.loi ?? e?.message ?? 'không rõ') + '.';
}

const gia = (bang, id) => timDong(bang, id)?.tieu_de ?? '';
function moTaOp(o) {
  if (o.loai === 'sua' && o.bang === 'viec' && o.truong && 'han' in o.truong) {
    const cu = timDong('viec', o.id)?.han;
    return `Dời hạn "${gia('viec', o.id)}" từ ${cu ? ngayVN(cu) : '(chưa có)'} sang ${o.truong.han ? ngayVN(o.truong.han) : '(bỏ hạn)'}`;
  }
  return `${o.loai} ${o.bang} "${gia(o.bang, o.id) || o.truong?.tieu_de || ''}"`;
}

const veMuc = d => el('li', { class: 'de-xuat', 'data-de-xuat': d.id },
  el('p', {}, el('span', { class: 'nhan' }, d.chu_the === 'ai' ? 'AI' : 'Neo'), ' ', d.noi_dung),
  el('p', { 'data-mo-ta': '' }, d.ops.map(moTaOp).join('; ')),
  el('div', { class: 'nut-dong' },
    el('button', { type: 'button', class: 'nut-chinh', 'data-act': 'ap-dung' }, 'Áp dụng'),
    el('button', { type: 'button', 'data-act': 'bo-qua' }, 'Bỏ qua')));

function veHop(ds, khongDeXuat) {
  moHop('Đề xuất đang chờ',
    khongDeXuat && el('p', { 'data-khong-de-xuat': '' }, 'AI chưa có đề xuất hợp lệ'),
    ds.length ? el('ul', { class: 'ds' }, ...ds.map(veMuc)) : el('p', { class: 'rong' }, 'Chưa có đề xuất nào chờ.'),
    el('p', { 'data-loi': '' }),
    el('div', { class: 'nut-hop' }, el('button', { type: 'button', 'data-act': 'dong-hop' }, 'Đóng')));
}

function baoLoi(e) {
  if (e instanceof LoiPhien) return;
  const t = tinLoi(e), cho = document.querySelector('#hop [data-loi]');
  bao(t);
  if (cho) cho.textContent = t;
}

async function hoiAI(n) {
  n.disabled = true;
  try {
    const r = await goiApi('/api/hoi-ai', POST);
    const ds = (await goiApi('/api/de-xuat?mach=cos')).de_xuat;
    veHop(ds, r.de_xuat === null);
  } catch (e) { baoLoi(e); }
  finally { n.disabled = false; }
}

async function boQua(n) {
  const li = n.closest('[data-de-xuat]'), id = li.dataset.deXuat;
  n.disabled = true;
  try {
    await goiApi('/api/de-xuat/' + id + '/bo-qua', POST);
    li.remove();
    bao('Đã bỏ qua đề xuất.');
    document.querySelector('#hop button')?.focus();
    await taiLai();
  } catch (e) { n.disabled = false; baoLoi(e); }
}

async function apDung(n) {
  const id = n.closest('[data-de-xuat]').dataset.deXuat, khoa_lap = khoaLap();
  const tin = 'Đã áp dụng đề xuất: ' + n.closest('[data-de-xuat]').querySelector('[data-mo-ta]').textContent;
  n.disabled = true;
  let o;
  try { o = await goiApi('/api/de-xuat/' + id + '/ap-dung', { method: 'POST', than: { khoa_lap } }); }
  catch (e) { n.disabled = false; baoLoi(e); return; }
  nhanHoanTac(o.ma_hoan, tin);
  bao(tin);
  dongHop();
  await taiLai();
}

dangKyHanhDong('hoi-ai', hoiAI);
dangKyHanhDong('bo-qua', boQua);
dangKyHanhDong('ap-dung', apDung);
