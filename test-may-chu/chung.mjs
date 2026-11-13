// Đồ nghề chung cho test máy chủ (task A2): khoá RSA tự sinh + JWKS giả (không gọi mạng), vé Access, cấu hình, gọi HTTP qua socket.
// Thư mục tạm đường NGẮN ở /tmp (đường Unix socket ≤ 103 byte); `dong()` tắt mọi máy chủ đã mở và dọn thư mục.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { khoiDong } from '../may-chu/may-chu.mjs';

export const TEAM = 'neo-thu.cloudflareaccess.com', AUD = 'aud-webos-' + 'a'.repeat(40), AUD_HUB = 'aud-hub-' + 'b'.repeat(40), EMAIL = 'anh@vi-du.vn';
const capKhoa = () => crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
export const K1 = capKhoa(), K_LA = capKhoa();
export const jwk = (k, kid) => ({ ...k.publicKey.export({ format: 'jwk' }), kid });
export const layJwks = async () => ({ keys: [jwk(K1, 'k1')] });
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
export const giayNay = () => Math.floor(Date.now() / 1000);
// Vé ký bằng `khoa` (mặc định K1, kid k1); `sua` đè trường thân; `than` thay cả thân (vd null).
export function ve(sua = {}, { khoa = K1, kid = 'k1', than } = {}) {
  const h = b64({ alg: 'RS256', kid, typ: 'JWT' });
  const p = b64(than !== undefined ? than : { iss: 'https://' + TEAM, aud: [AUD], email: EMAIL, exp: giayNay() + 600, iat: giayNay() - 5, ...sua });
  return `${h}.${p}.${crypto.sign('sha256', Buffer.from(h + '.' + p), khoa.privateKey).toString('base64url')}`;
}
export const VE = ve();
export const DAU_GHI = { 'X-WebOS': '1', 'Content-Type': 'application/json' };
// Nhóm socket (soát A8): web.sock ⇒ gid chính, kernel.sock ⇒ một nhóm khác tiến trình thuộc (ưu tiên everyone 12); GID_LA: nhóm tiến trình
// KHÔNG thuộc và khác nhóm thư mục tạm (socket mới đã mang nhóm đó ⇒ chown về chính nó không lỗi, phép đo EPERM không phân biệt được).
const NHOM = process.getgroups(), GOC_TAM = process.env.WO_GOC || '/tmp', NHOM_TAM = fs.statSync(GOC_TAM).gid;
export const GID_WEB = process.getgid(), GID_KERNEL = [12, ...NHOM].find(g => g !== GID_WEB && NHOM.includes(g));
export const GID_LA = [...Array(1000).keys()].find(g => g !== GID_WEB && g !== NHOM_TAM && !NHOM.includes(g));

export function moiTruong() {
  const tam = fs.mkdtempSync(path.join(GOC_TAM, 'wo-')), ds = [];   // WO_GOC: runner đột biến đặt thư mục riêng của lượt
  let so = 0;
  // Mỗi cấu hình một bộ socket + thư mục kho riêng (hai máy chủ cùng lúc không giẫm nhau).
  const cauHinh = (them = {}, bo = []) => {
    const n = so++, kho = path.join(tam, 'kho' + n);
    fs.mkdirSync(kho);
    const c = { teamDomain: TEAM, aud: AUD, emails: [EMAIL], ngheSocket: path.join(tam, `w${n}.s`), ngheKernel: path.join(tam, `k${n}.s`), thuMucKho: kho, thuMucSaoLuu: path.join(tam, 'sl' + n), cosGhi: false, gidWeb: GID_WEB, gidKernel: GID_KERNEL, ...them };
    for (const k of bo) delete c[k];
    const f = path.join(tam, `ch-${n}.json`); fs.writeFileSync(f, JSON.stringify(c)); return f;
  };
  const chay = (f, tuy = {}) => khoiDong(f, { layJwks, ghiLog: () => {}, ...tuy });
  return {
    tam, cauHinh,
    async may(them, bo, tuy) { const m = await chay(cauHinh(them, bo), tuy); ds.push(m); return m; },
    thuKhoi: (f, tuy) => chay(f, tuy).then(async m => { await m.dong(); return null; }, e => e),   // khởi động được thì đóng ngay
    async dong() { for (const m of ds) await m.dong(); fs.rmSync(tam, { recursive: true, force: true }); },
  };
}

export function goi(may, duong, { method = 'GET', jwt = VE, dau = {}, than } = {}) {
  return new Promise((ok, loi) => {
    const dich = may.ngheSocket ? { socketPath: may.ngheSocket } : { host: '127.0.0.1', port: may.cong };
    const r = http.request({ ...dich, path: duong, method, agent: false, headers: { ...(jwt ? { 'Cf-Access-Jwt-Assertion': jwt } : {}), ...(than === undefined ? {} : { 'Content-Length': Buffer.byteLength(than) }), ...dau } }, res => {
      const b = []; res.on('data', d => b.push(d));
      res.on('end', () => {
        const s = Buffer.concat(b).toString();
        let json = null; try { json = JSON.parse(s); } catch { /* thân chữ */ }
        ok({ ma: res.statusCode, than: s, json, dau: res.headers });
      });
    });
    r.on('error', loi); r.end(than);
  });
}
