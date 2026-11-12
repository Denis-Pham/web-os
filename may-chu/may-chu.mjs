// Máy chủ web-os (thiết kế v0.2 mục 1, 5.3): nghe Unix socket ngheSocket (production, sau cloudflared + Cloudflare Access) hoặc
// 127.0.0.1:<cong> (CHỈ dev), và socket thứ hai ngheKernel cho Hermes Kernel. Mọi yêu cầu web qua bộ định tuyến chung api.mjs (vé ở MỌI yêu cầu).
// Khung chép từ Learning ~/dev/learning-that 630a0bf:may-chu/may-chu.mjs (nghe, khoiDong, lối chạy). Chạy: node may-chu/may-chu.mjs <cau-hinh.json>
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { docCauHinh } from './cau-hinh.mjs';
import { taoKiemJwt } from './xac-thuc.mjs';
import { moKho } from './kho.mjs';
import { henSaoLuu } from './sao-luu.mjs';
import { ghiSoDem } from './xuat.mjs';
import { xuLy, tra } from './api.mjs';

const sach = s => String(s).slice(0, 200).replace(/[^\x21-\x7e]/g, '?');

// Đường đã có chỉ gỡ khi là socket của chính uid này (bản cũ của tiến trình); tệp khác hay socket của uid khác ⇒ từ chối, không xoá.
function goSocketCu(duong) {
  let st = null;
  try { st = fs.lstatSync(duong); } catch (e) { if (e.code !== 'ENOENT') throw new Error('socket: không lstat được ' + duong); }
  if (!st) return;
  if (!st.isSocket() || st.uid !== process.getuid()) throw new Error('socket: đường đã có, không phải socket cũ của tiến trình — không xoá: ' + duong);
  fs.unlinkSync(duong);
}

// Production nghe Unix socket, KHÔNG TCP: cổng 127.0.0.1 bị nhả (máy chủ dừng) thì neo chiếm được và hứng vé từ đường hầm.
async function nghe(server, duong, cong) {
  const lang = (...a) => new Promise((ok, loi) => { server.once('error', loi); server.listen(...a, ok); });
  if (duong === null) return lang(cong, '127.0.0.1');
  goSocketCu(duong);
  await lang(duong);
  fs.chmodSync(duong, 0o660);
}

// kernel.sock ở A2: chưa có giao thức (A4) — khung đầu tiên (4 byte độ dài BE + JSON) nhận về MỘT khung { ok: false, loi: 'chua_co' } rồi đóng.
function kernelTam() {
  const ketNoi = new Set();
  const s = net.createServer(c => {
    ketNoi.add(c); c.on('close', () => ketNoi.delete(c)); c.on('error', () => {});
    c.once('data', () => {
      const ra = Buffer.from(JSON.stringify({ ok: false, loi: 'chua_co' })), l = Buffer.alloc(4);
      l.writeUInt32BE(ra.length);
      c.end(Buffer.concat([l, ra]));
    });
  });
  s.closeAllConnections = () => { for (const c of ketNoi) c.destroy(); };
  return s;
}

// dongHo (chỉ test): đồng hồ giả cho bộ hẹn sao lưu ({ now, setTimeout, clearTimeout }).
export async function khoiDong(duongCauHinh, { layJwks, ghiLog = s => process.stdout.write(s + '\n'), dongHo } = {}) {
  const ch = docCauHinh(duongCauHinh);
  const kiem = taoKiemJwt({ teamDomain: ch.teamDomain, aud: ch.aud, emails: ch.emails, ...(layJwks ? { layJwks } : {}) });
  const tepKho = path.join(ch.thuMucKho, 'kho.sqlite');
  fs.closeSync(fs.openSync(tepKho, 'a', 0o600));   // kho 0600 ngay từ lúc tạo (mục 1); SQLite tạo -wal/-shm theo mode tệp kho
  const db = moKho(tepKho);
  // so-dem.json cho dung-trang.py: ghi lúc khởi động + sau mỗi bản giờ; lỗi chỉ ghi log (tệp theo dõi, không phải cổng an ninh).
  const bayGio = () => dongHo ? dongHo.now() : Date.now();
  const moiGio = ch.thuMucXuat ? t => ghiSoDem(db, ch.thuMucXuat, t) : undefined;
  if (moiGio) { try { moiGio(bayGio()); } catch { ghiLog('LỖI ghi so đếm'); } }
  const hen = henSaoLuu(db, ch, { dongHo, ghiLog, moiGio });   // bản giờ + bản ngày 03:00 (A6)
  const ctx = { ch, kiem, db };
  const server = http.createServer((req, res) => {
    const t0 = performance.now(), p = (req.url || '').split('?')[0];
    // Log: phương thức, đường (bỏ query), mã, thời gian — không header (vé), không thân.
    res.on('close', () => ghiLog(`${new Date().toISOString()} ${sach(req.method)} ${sach(p)} ${res.statusCode} ${Math.round(performance.now() - t0)}ms`));
    xuLy(ctx, req, res).catch(() => { if (!res.headersSent) tra(res, 500); else res.destroy(); });   // không in lỗi: có thể mang dữ liệu
  });
  const kernel = kernelTam();
  let p;   // dong() nhiều lần (SIGTERM rồi SIGINT) dùng chung một lời hứa: không đóng kho hai lần
  const dong = () => (p ??= (async () => {
    hen.dung();
    for (const s of [server, kernel]) if (s.listening) await new Promise(r => { s.close(r); s.closeAllConnections(); });
    db.close();
  })());
  try { await nghe(server, ch.ngheSocket, ch.cong); await nghe(kernel, ch.ngheKernel); }
  catch (e) { await dong(); throw e; }
  const dc = server.address();
  return { server, kernel, cong: typeof dc === 'string' ? null : dc.port, ngheSocket: ch.ngheSocket, ngheKernel: ch.ngheKernel, dong };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const duong = process.argv[2];
  if (!duong) { process.stderr.write('thiếu đường cấu hình\n'); process.exit(2); }
  khoiDong(duong).then(
    ({ cong, ngheSocket, ngheKernel, dong }) => {
      // Tắt êm: dừng bộ hẹn sao lưu, gỡ socket, đóng kho (checkpoint WAL) rồi mới thoát.
      for (const tin of ['SIGTERM', 'SIGINT']) process.once(tin, () => dong().then(() => process.exit(0), () => process.exit(1)));
      process.stderr.write(`nghe ${ngheSocket ?? '127.0.0.1:' + cong} · kernel ${ngheKernel}\n`);
    },
    e => { process.stderr.write('không khởi động: ' + String(e?.message || 'lỗi').slice(0, 200).replace(/[\x00-\x1f\x7f]/g, ' ') + '\n'); process.exit(2); });
}
