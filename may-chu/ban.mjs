// Cửa duyệt bản giao diện (thiết kế v0.2 mục 6, kế thừa B2a Learning): `neo` ĐẶT bản vào <thuMucCho>/ban/<SHA40> (trien-khai/do.sh dat-ban);
// máy chủ chỉ phục vụ bản anh đã duyệt, CHÉP vào <thuMucBan>/ban/<SHA40> (chủ = uid tiến trình = _webos) rồi lật hien-tai/truoc.
// Chép Learning 630a0bf:may-chu/ban.mjs (lỗi ⇒ LoiGoi; tệp ≤ 20 480 B) + phục vụ tĩnh (630a0bf:may-chu/may-chu.mjs tinh) + /phuc-hoi (mã máy chủ, không thuộc bản).
// CLI cho lễ (chạy dưới _webos): node may-chu/ban.mjs xem <cấu hình> | duyet <cấu hình> <SHA40> <manifest64>
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { LoiGoi } from './goi.mjs';
import { docCauHinh } from './cau-hinh.mjs';

export const TRAN_TEP = 20480, TRAN_SO_TEP = 64, TRAN_TONG = 1 << 20, SO_CHO = 10, TRAN_MUC = 256;
export const SHA = /^[0-9a-f]{40}$/, MANIFEST = /^[0-9a-f]{64}$/;
const TEN = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$/;
const DUOI = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
};
const loaiTep = t => { const d = path.extname(t); return Object.hasOwn(DUOI, d) ? DUOI[d] : null; };
// Tên tệp bản: docBan + route xem tệp dùng chung (chỉ tệp ở gốc bản, đuôi trong DUOI).
export const tenDung = t => typeof t === 'string' && TEN.test(t) && !t.includes('..') && !!loaiTep(t);
const BAN_JSON = 'ban.json';   // ban.json của neo KHÔNG tin: bỏ khi đọc bản chờ; máy chủ tự viết vào bản đã duyệt

class BanHong extends Error { constructor(lyDo) { super(lyDo); this.lyDo = lyDo; } }
const loiHong = e => (e instanceof BanHong ? new LoiGoi(422, 'ban_hong', { ly_do: e.lyDo }) : e);

// Bất biến ghi: bản đang phục vụ thuộc CHÍNH máy chủ (uidBan = uid tiến trình, không phải neo) VÀ cửa duyệt đã cấu hình.
export function ghiBat(ch) { return ch.uidBan === process.getuid() && ch.thuMucBan !== undefined && ch.thuMucCho !== undefined && ch.uidCho !== undefined; }

// MỘT tệp: mở KHÔNG theo symlink + O_NONBLOCK (FIFO không treo); fstat trên fd: tệp thường, chủ = uid, ≤ tran byte (đếm byte thật, không tin st.size).
async function docTep(duong, uid, tran) {
  let fh;
  try { fh = await fsp.open(duong, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK); }
  catch (e) { throw new BanHong(e?.code === 'ELOOP' ? 'symlink' : 'khong_mo'); }
  try {
    const st = await fh.stat();
    if (!st.isFile()) throw new BanHong('khong_phai_tep');
    if (st.uid !== uid) throw new BanHong('sai_chu');
    const buf = Buffer.alloc(tran + 1);
    let n = 0;
    for (;;) {
      const { bytesRead } = await fh.read(buf, n, tran + 1 - n, n);
      if (!bytesRead) break;
      n += bytesRead;
      if (n > tran) throw new BanHong('tep_lon');
    }
    return buf.subarray(0, n);
  } finally { await fh.close(); }
}

// Tên trong thư mục, DỪNG khi quá `tran` mục ⇒ null (neo tạo hàng triệu mục không làm kẹt hàng tuanTu). Lỗi mở ⇒ ném.
async function lietKe(thuMuc, tran) {
  const ten = [];
  for await (const e of await fsp.opendir(thuMuc)) { if (ten.length === tran) return null; ten.push(e.name); }   // thoát vòng ⇒ Dir tự đóng
  return ten;
}

// Cả bản: CHỈ tệp ở gốc (thư mục con ⇒ khong_phai_tep / ten_sai), bỏ ban.json; [{ten, co, sha256, buf}] sắp theo tên.
async function docBan(thuMuc, uid) {
  let ten;
  try { ten = await lietKe(thuMuc, TRAN_SO_TEP + 1); } catch { throw new BanHong('khong_mo'); }   // +1: chỗ cho ban.json
  if (ten === null) throw new BanHong('qua_nhieu_tep');
  ten = ten.filter(t => t !== BAN_JSON).sort();
  if (!ten.length) throw new BanHong('rong');
  if (ten.length > TRAN_SO_TEP) throw new BanHong('qua_nhieu_tep');
  const ds = [];
  let tong = 0;
  for (const t of ten) {
    if (!tenDung(t)) throw new BanHong('ten_sai');
    const buf = await docTep(path.join(thuMuc, t), uid, TRAN_TEP);
    if ((tong += buf.length) > TRAN_TONG) throw new BanHong('tong_lon');
    ds.push({ ten: t, co: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), buf });
  }
  return ds;
}

// manifest = sha256 hex của JSON mảng [tên, cỡ, sha256] đã sắp theo tên (tên ASCII ⇒ thứ tự JS = Python).
function manifestCua(ds) {
  return crypto.createHash('sha256').update(JSON.stringify(ds.map(f => [f.ten, f.co, f.sha256]))).digest('hex');
}

function shaCua(goc, ten) {
  let d;
  try { d = fs.readlinkSync(path.join(goc, ten)); } catch { return null; }
  const m = /^ban\/([0-9a-f]{40})$/.exec(d);
  return m ? m[1] : null;
}
// Đổi symlink NGUYÊN TỬ: symlink tạm cạnh nó rồi rename đè (không lúc nào vắng link).
function doiLink(goc, ten, sha) {
  const tam = path.join(goc, `.${ten}.${crypto.randomBytes(6).toString('hex')}`);
  fs.symlinkSync(path.join('ban', sha), tam);
  try { fs.renameSync(tam, path.join(goc, ten)); } catch (e) { fs.rmSync(tam, { force: true }); throw e; }
}
// Lật sang `moi`: truoc ← bản đang phục vụ TRƯỚC, hien-tai ← moi SAU ⇒ chết giữa hai bước thì vẫn phục vụ bản cũ.
function lat(goc, moi) {
  const cu = shaCua(goc, 'hien-tai');
  if (cu && cu !== moi) doiLink(goc, 'truoc', cu);
  doiLink(goc, 'hien-tai', moi);
  return { hien_tai: moi, truoc: shaCua(goc, 'truoc') };
}

// Mọi thao tác cửa duyệt chạy tuần tự trong tiến trình (hai lần bấm không chép chồng nhau).
let hang = Promise.resolve();
export function tuanTu(viec) { const p = hang.then(viec); hang = p.catch(() => {}); return p; }

export async function xem(ch) {
  const goc = ch.thuMucBan, ht = shaCua(goc, 'hien-tai'), tr = shaCua(goc, 'truoc');
  let htDs = [], htManifest = null;
  if (ht) try { htDs = await docBan(path.join(goc, 'ban', ht), process.getuid()); htManifest = manifestCua(htDs); } catch (e) { if (!(e instanceof BanHong)) throw e; }
  const cuMap = new Map(htDs.map(f => [f.ten, f]));
  const thuMucCho = path.join(ch.thuMucCho, 'ban');
  let ten = [];
  try { ten = await lietKe(thuMucCho, TRAN_MUC); } catch { /* chưa có bản chờ */ }
  const htRa = ht ? { sha: ht, manifest: htManifest } : null, trRa = tr ? { sha: tr } : null;
  if (ten === null) return { hien_tai: htRa, truoc: trRa, cho: [], qua_nhieu: true };   // quá TRAN_MUC mục: không liệt kê, anh dọn tay
  const ung = [];
  for (const sha of ten) {
    if (!SHA.test(sha) || sha === ht) continue;
    try { ung.push([(await fsp.lstat(path.join(thuMucCho, sha))).mtimeMs, sha]); } catch { /* vừa bị xoá */ }
  }
  ung.sort((a, b) => b[0] - a[0] || (a[1] < b[1] ? -1 : 1));
  const cho = [];
  for (const [, sha] of ung.slice(0, SO_CHO)) {
    try {
      const ds = await docBan(path.join(thuMucCho, sha), ch.uidCho);
      const tep = ds.map(f => ({ ten: f.ten, co: f.co, sha256: f.sha256,
        trang_thai: !cuMap.has(f.ten) ? 'moi' : cuMap.get(f.ten).sha256 === f.sha256 ? 'giu' : 'sua' }));
      for (const f of htDs) if (!ds.some(g => g.ten === f.ten)) tep.push({ ten: f.ten, co: f.co, sha256: f.sha256, trang_thai: 'xoa' });
      cho.push({ sha, manifest: manifestCua(ds), loi: null, tep });
    } catch (e) {
      if (!(e instanceof BanHong)) throw e;
      cho.push({ sha, manifest: null, loi: e.lyDo, tep: [] });
    }
  }
  return { hien_tai: htRa, truoc: trRa, cho };
}

// Nội dung MỘT tệp để anh đọc trước khi duyệt: bản chờ `sha` (moi) + bản đang chạy (cu). Đọc CẢ bản bằng docBan (đúng mức kiểm của
// xem/duyệt) rồi CHỌN theo tên ⇒ `ten` chỉ để so, không bao giờ ghép vào đường. Chỉ đọc ⇒ không cần ghiBat.
// Tệp chữ: noi_dung = UTF-8 nguyên byte (giữ BOM; không phải UTF-8 ⇒ null); đuôi ảnh ⇒ nhi_phan, không nội dung.
const NHI_PHAN = ['.png', '.webp', '.ico'], UTF8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
function moTa(f, nhi) {
  if (!f) return null;
  if (nhi) return { sha256: f.sha256 };
  try { return { sha256: f.sha256, noi_dung: UTF8.decode(f.buf) }; } catch { return { sha256: f.sha256, noi_dung: null }; }
}
// manifest: cái anh thấy ở danh sách; tính từ CÙNG lượt đọc `ds` (cùng manifestCua của duyệt) ⇒ lệch thì 409, không trả nội dung.
export async function tepBan(ch, sha, ten, manifest) {
  if (ch.thuMucCho === undefined) throw new LoiGoi(404, 'khong_co_ban');
  let ds;
  try { ds = await docBan(path.join(ch.thuMucCho, 'ban', sha), ch.uidCho); }
  catch (e) { throw e instanceof BanHong && e.lyDo === 'khong_mo' ? new LoiGoi(404, 'khong_co_ban') : loiHong(e); }
  if (manifestCua(ds) !== manifest) throw new LoiGoi(409, 'manifest_lech');
  const ht = shaCua(ch.thuMucBan, 'hien-tai'), moi = ds.find(f => f.ten === ten) ?? null;
  let cu = null;
  if (ht) try { cu = (await docBan(path.join(ch.thuMucBan, 'ban', ht), process.getuid())).find(f => f.ten === ten) ?? null; } catch (e) { if (!(e instanceof BanHong)) throw e; }
  if (!moi && !cu) throw new LoiGoi(404, 'khong_co_tep');
  const nhi = NHI_PHAN.includes(path.extname(ten));
  return { ten, ...(nhi ? { nhi_phan: true } : {}), moi: moTa(moi, nhi), cu: moTa(cu, nhi) };
}

// Duyệt: chép vào thư mục tạm riêng, TÍNH LẠI manifest từ byte ĐÃ CHÉP; lệch với cái anh thấy ⇒ 409 (chặn tráo giữa xem và duyệt).
export async function duyet(ch, sha, manifest) {
  const goc = ch.thuMucBan, uidMay = process.getuid(), dich = path.join(goc, 'ban', sha);
  if (fs.existsSync(dich)) {                                   // từng duyệt: so với BẢN ĐÃ DUYỆT, không đọc lại thư mục chờ
    if (manifestCua(await docBan(dich, uidMay)) !== manifest) throw new LoiGoi(409, 'manifest_lech');
    return lat(goc, sha);
  }
  const nguon = path.join(ch.thuMucCho, 'ban', sha);
  try { await fsp.stat(nguon); } catch { throw new LoiGoi(404, 'khong_co_ban'); }
  const tam = fs.mkdtempSync(path.join(goc, '.tam-'));
  try {
    let ds;
    try { ds = await docBan(nguon, ch.uidCho); } catch (e) { throw loiHong(e); }
    for (const f of ds) fs.writeFileSync(path.join(tam, f.ten), f.buf, { flag: 'wx', mode: 0o600 });
    if (manifestCua(await docBan(tam, uidMay)) !== manifest) throw new LoiGoi(409, 'manifest_lech');
    fs.writeFileSync(path.join(tam, BAN_JSON), JSON.stringify({ ban: sha }) + '\n', { flag: 'wx', mode: 0o600 });
    fs.chmodSync(tam, 0o700);
    fs.mkdirSync(path.join(goc, 'ban'), { recursive: true });
    fs.renameSync(tam, dich);
  } finally { fs.rmSync(tam, { recursive: true, force: true }); }   // sau rename thì tam không còn ⇒ không làm gì
  return lat(goc, sha);
}

// Lùi: `sha` = truoc trang đang hiện; đã là hien-tai (bấm hai lần) ⇒ không đổi gì.
export function lui(ch, sha) {
  const goc = ch.thuMucBan, ht = shaCua(goc, 'hien-tai'), tr = shaCua(goc, 'truoc');
  if (sha === ht) return { hien_tai: ht, truoc: tr };
  if (!tr || !fs.existsSync(path.join(goc, 'ban', tr))) throw new LoiGoi(409, 'khong_co_truoc');
  if (sha !== tr) throw new LoiGoi(409, 'truoc_lech');
  return lat(goc, tr);
}

// /phuc-hoi (thiết kế 6): mã máy chủ, KHÔNG thuộc bản ⇒ bản hỏng JS vẫn lùi được. Chỉ /api/ban + /api/ban/lui; sau khi lùi gỡ service worker
// (của bản hỏng) để lần mở sau tải thẳng bản đã lùi. CSP default-src 'self': không script/style nội tuyến.
const PHUC_HOI_HTML = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Phục hồi giao diện</title>
<script src="/phuc-hoi.js" defer></script>
</head>
<body>
<h1>Phục hồi giao diện</h1>
<p>Trang này do máy chủ phục vụ, không thuộc bản giao diện: bản đang chạy hỏng vẫn lùi được từ đây.</p>
<p>Bản đang chạy: <code id="hien-tai">…</code></p>
<p>Bản trước: <code id="truoc">…</code></p>
<p><button id="lui" type="button" disabled>Lùi bản</button></p>
<p id="tin" role="status"></p>
<p><a href="/">Về trang chính</a></p>
</body>
</html>
`;
const PHUC_HOI_JS = `'use strict';
(() => {
  const $ = id => document.getElementById(id), bao = s => { $('tin').textContent = s; };
  let truoc = null;
  async function nap() {
    const r = await fetch('/api/ban', { cache: 'no-store' });
    if (!r.ok) { bao('Không đọc được trạng thái bản (HTTP ' + r.status + ').'); return; }
    const o = await r.json();
    truoc = o.truoc ? o.truoc.sha : null;
    $('hien-tai').textContent = o.hien_tai ? o.hien_tai.sha : '(chưa có)';
    $('truoc').textContent = truoc === null ? '(không có)' : truoc;
    $('lui').disabled = truoc === null;
  }
  async function lui() {
    $('lui').disabled = true;
    const sha = truoc, r = await fetch('/api/ban/lui', { method: 'POST', headers: { 'X-WebOS': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ sha }) });
    if (!r.ok) { bao('Lùi không được (HTTP ' + r.status + ').'); return nap(); }
    if (navigator.serviceWorker) for (const d of await navigator.serviceWorker.getRegistrations()) await d.unregister();
    bao('Đã lùi về bản ' + sha + '.');
    return nap();
  }
  $('lui').addEventListener('click', () => { lui().catch(() => bao('Lùi không được (lỗi mạng).')); });
  nap().catch(() => bao('Không đọc được trạng thái bản (lỗi mạng).'));
})();
`;
const PHUC_HOI = { '/phuc-hoi': [PHUC_HOI_HTML, 'text/html; charset=utf-8'], '/phuc-hoi.js': [PHUC_HOI_JS, 'text/javascript; charset=utf-8'] };

// Đường URL thô (CHƯA giải mã) → đường tương đối an toàn, hoặc null. Không %, \, NUL; không đoạn rỗng, '.', '..', tệp ẩn.
function kiemDuong(p) {
  if (p === '/') return 'index.html';
  if (!/^\/[A-Za-z0-9._~/-]{1,512}$/.test(p)) return null;
  const doan = p.slice(1).split('/');
  if (doan.some(d => d === '' || d.startsWith('.'))) return null;
  return doan.join('/');
}
// GET/HEAD ngoài /api/ ⇒ [mã, thân, loại?, đầu thêm?]. /phuc-hoi(.js) tra TRƯỚC bản ⇒ bản không đè được. Tệp bản: hien-tai phải là
// <thuMucBan>/ban/<SHA40> thật, tệp nằm trong bản (không symlink ra ngoài), tệp thường của uidBan (fstat trên fd).
export async function docTinh(ch, p) {
  if (Object.hasOwn(PHUC_HOI, p)) return [200, ...PHUC_HOI[p]];
  const rel = kiemDuong(p);
  if (rel === null) return [400, ''];
  const loai = loaiTep(rel);
  if (!loai) return [404, ''];
  let goc;
  try {
    goc = await fsp.realpath(path.join(ch.thuMucBan, 'hien-tai'));
    const sha = path.basename(goc);
    if (!SHA.test(sha) || goc !== path.join(await fsp.realpath(ch.thuMucBan), 'ban', sha)) return [503, ''];
  } catch { return [503, '']; }
  let that;
  try { that = await fsp.realpath(path.join(goc, rel)); } catch { return [404, '']; }
  if (!that.startsWith(goc + path.sep)) return [404, ''];   // symlink ra ngoài bản hiện tại
  let fh;
  try {
    fh = await fsp.open(that, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    const st = await fh.stat();
    if (!st.isFile() || st.uid !== ch.uidBan || st.size > TRAN_TEP) return [404, ''];
    return [200, await fh.readFile(), loai, { 'Cache-Control': 'no-cache' }];
  } catch { return [404, '']; } finally { await fh?.close(); }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [lenh, duong, sha, manifest] = process.argv.slice(2);
  const thoi = (ma, s) => { process[ma ? 'stderr' : 'stdout'].write(s + '\n'); process.exit(ma); };
  let ch;
  try { ch = docCauHinh(duong || ''); } catch (e) { thoi(2, 'LOI: ' + e.message); }
  if (!ghiBat(ch)) thoi(1, 'LOI: ghi_tat (uidBan phải = uid tiến trình, cần thuMucBan + thuMucCho + uidCho)');
  if (lenh === 'xem') xem(ch).then(kq => thoi(0, JSON.stringify(kq, null, 1)), () => thoi(1, 'LOI: không đọc được'));
  else if (lenh === 'duyet' && SHA.test(sha || '') && MANIFEST.test(manifest || '')) {
    duyet(ch, sha, manifest).then(kq => thoi(0, 'DUYET: ĐẠT ' + kq.hien_tai),
      e => thoi(1, 'LOI: ' + (e instanceof LoiGoi ? JSON.stringify({ loi: e.loi, chi_tiet: e.chi_tiet }) : 'không duyệt được')));
  } else thoi(2, 'dùng: ban.mjs xem <cấu hình> | duyet <cấu hình> <SHA40> <manifest64>');
}
