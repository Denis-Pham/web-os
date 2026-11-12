// Kiểm vé Cloudflare Access của web-os (thiết kế v0.2 mục 5.1): RS256 bằng node:crypto, JWKS của team cache; lấy lại khi gặp kid lạ
// hoặc bộ khoá quá 1 giờ. Nguồn: chép từ Learning ~/dev/learning-that 630a0bf:may-chu/xac-thuc.mjs (bản đó chép nguyên văn
// ~/dev/family-os aeeebf6:hub/xac-thuc.mjs). Đổi so với nguồn: `nguoi` (email → tên) thành `emails` (mảng) · trả { email, het_luc } ·
// mỗi cổng (chữ ký, iss, aud, hạn, email) tách thành hàm riêng để đột biến được cả hàm lẫn chỗ gọi · thêm kiemYeuCau.
import crypto from 'node:crypto';

export class LoiXacThuc extends Error {
  constructor(ma, lyDo) { super(lyDo); this.ma = ma; this.ly_do = lyDo; }
}
const B64 = /^[A-Za-z0-9_-]+$/;
function layJwksMacDinh(team) {
  return async () => {
    const r = await fetch(`https://${team}/cdn-cgi/access/certs`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error('jwks ' + r.status);
    return r.json();
  };
}
function kiemChuKy(phan, k) {
  if (!crypto.verify('sha256', Buffer.from(phan[0] + '.' + phan[1]), k, Buffer.from(phan[2], 'base64url'))) throw new LoiXacThuc(401, 'chu_ky');
}
function kiemIss(p, iss) {
  if (p.iss !== iss) throw new LoiXacThuc(401, 'iss');
}
function kiemAud(p, aud) {   // vé hợp lệ của app khác cùng team (Family Hub) ⇒ 401
  if (!(Array.isArray(p.aud) ? p.aud : [p.aud]).includes(aud)) throw new LoiXacThuc(401, 'aud');
}
function kiemHan(p, now) {
  if (typeof p.exp !== 'number' || p.exp <= now) throw new LoiXacThuc(401, 'het_han');
  if (typeof p.nbf === 'number' && p.nbf > now + 60) throw new LoiXacThuc(401, 'chua_hieu_luc');
}
function kiemEmail(p, emails) {
  if (typeof p.email !== 'string' || !emails.has(p.email.toLowerCase())) throw new LoiXacThuc(403, 'email_la');
}

export function taoKiemJwt({ teamDomain, aud, emails, layJwks = layJwksMacDinh(teamDomain), bayGio = () => Date.now(), khoangLamMoi = 60_000, hanKhoa = 3_600_000 }) {
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(teamDomain || '') || typeof aud !== 'string' || !aud) throw new Error('cấu hình: teamDomain / aud sai dạng');
  const iss = 'https://' + teamDomain, choPhep = new Set(emails.map(e => e.toLowerCase()));
  let khoa = new Map(), lanCuoi = -Infinity, napLuc = -Infinity, loiCuoi = null, dang = null;
  function napKhoa() {
    if (dang) return dang;                                          // nhiều yêu cầu cùng lúc ⇒ chung một lần lấy
    if (bayGio() - lanCuoi < khoangLamMoi) return loiCuoi ? Promise.reject(loiCuoi) : Promise.resolve();   // tối đa 1 lần mỗi 60 s; lần trước hỏng ⇒ vẫn 503
    lanCuoi = bayGio();
    dang = (async () => {
      try {
        const j = await layJwks();
        khoa = new Map((j?.keys || []).filter(k => k && k.kty === 'RSA' && typeof k.kid === 'string')
          .map(k => [k.kid, crypto.createPublicKey({ key: { kty: 'RSA', n: k.n, e: k.e }, format: 'jwk' })]));
        napLuc = bayGio(); loiCuoi = null;
      } catch (e) { loiCuoi = e; throw e; }
    })().finally(() => { dang = null; });
    return dang;
  }
  return async function kiem(token) {
    if (typeof token !== 'string' || !token || token.length > 8192) throw new LoiXacThuc(401, 'thieu_jwt');
    const phan = token.split('.');
    if (phan.length !== 3 || !phan.every(p => B64.test(p))) throw new LoiXacThuc(401, 'jwt_sai_dang');
    let h, p;
    try { h = JSON.parse(Buffer.from(phan[0], 'base64url')); p = JSON.parse(Buffer.from(phan[1], 'base64url')); } catch { throw new LoiXacThuc(401, 'jwt_sai_dang'); }
    if (h?.alg !== 'RS256' || typeof h.kid !== 'string') throw new LoiXacThuc(401, 'alg');
    // kid lạ, hoặc bộ khoá quá hạn (khoá Cloudflare đã gỡ thì sau ≤ 1 giờ hết được tin): lấy lại; không lấy được ⇒ 503, không dùng khoá cũ.
    if (!khoa.has(h.kid) || bayGio() - napLuc >= hanKhoa) { try { await napKhoa(); } catch { throw new LoiXacThuc(503, 'khong_lay_duoc_khoa'); } }
    const k = khoa.get(h.kid);
    if (!k) throw new LoiXacThuc(401, 'kid_la');
    kiemChuKy(phan, k);
    const now = bayGio() / 1000;
    kiemIss(p, iss);
    kiemAud(p, aud);
    kiemHan(p, now);
    kiemEmail(p, choPhep);
    return { email: p.email, het_luc: new Date(p.exp * 1000).toISOString() };
  };
}

// Cổng vé của MỌI yêu cầu (gọi ở bộ định tuyến chung api.mjs): { email, het_luc } hoặc ném LoiXacThuc 401/403/503.
// Chỉ đọc header Cf-Access-Jwt-Assertion; vé không được chuyển tiếp ra đâu, không ghi log. Lỗi lạ (vd thân vé không phải object) ⇒ 401.
export async function kiemYeuCau(kiem, req) {
  try { return await kiem(req.headers['cf-access-jwt-assertion']); }
  catch (e) { throw e instanceof LoiXacThuc ? e : new LoiXacThuc(401, 'jwt_sai_dang'); }
}
