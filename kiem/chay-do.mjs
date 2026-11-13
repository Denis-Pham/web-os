// node kiem/chay-do.mjs [--pha] [--cu R6,R7,…] [--co 375x812-light,…] [--va <tệp json>]   (đứng ở gốc repo)
// node kiem/chay-do.mjs --url <gốc> [--cookie-tep <tệp>] [--co …]   (trang thật, CHỈ ĐỌC — Pha C, xem dưới)
// Bộ đo bản thật (B4; chép từ web-os-demo@6f544d4 kiem/chay-do.cjs rồi vá): máy chủ thật + cầu vé 127.0.0.1 (dungMay, cos_ghi bật, goiAI GIẢ
// tất định trong tiến trình — dời hạn việc mở đầu tiên + 1 ngày; KHÔNG ra mạng), bản web/ (hoặc bản cấy --va { 'tệp': [[cũ, mới], …] }) qua
// đường duyệt A5 (datBan). Bộ dữ liệu chuẩn gieo qua POST /api/goi (datLai trong kiem/do-ban-that.js). 6 cỡ: 375×812, 768×1024, 1440×900 ×
// sáng + tối; cỡ cuối thêm màn Hết phiên (cầu bỏ vé). Mỗi cỡ in MỘT dòng JSON (co, dat, hong[], loi[], mang[]); yêu cầu khác gốc cầu hay lỗi
// console ⇒ trượt. rc 0 = mọi cỡ đạt · 1 = có cỡ trượt · 2 = bộ đo lỗi (tham số sai, nổ). --pha: CSS cố ý hỏng (nút nhỏ, chữ nhỏ) ⇒ phải rc 1.
// Lượt 4c: sau phép trong trang, mỗi cỡ chạy phép ngoài trang R8 (doLoiVao) và bàn phím (doBanPhim) — chuột/phím THẬT của Playwright;
// R11 (trong trang) bật goiAI giả trả hạn ngoài miền qua móc trang __aiNgoaiMien (biến đóng aiNgoaiMien ở đây, không dựng máy thứ hai).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { moTrinh, dungMay, datBan, trangMoi } from '../test-web/chung-web.mjs';
import { goi } from '../test-may-chu/chung.mjs';

const thamSo = ten => { const i = process.argv.indexOf(ten); return i < 0 ? null : process.argv[i + 1]; };
const pha = process.argv.includes('--pha');
// Trang thật (Pha C, lễ W): --url <gốc> [--cookie-tep <tệp>] ⇒ CHỈ ĐỌC: không dựng máy, không datBan/datLai/goiAI; mọi yêu cầu tới gốc khác
// GET/HEAD bị huỷ và ghi vào `ghi` (cỡ trượt); phép cần ghi hay dữ liệu gieo ⇒ bỏ, liệt kê ở `bo` (dòng JSON có thêm ghi, bo). Giá trị cookie
// CF_Authorization KHÔNG in, KHÔNG vào JSON. Tham số sai hay lạ, DEBUG có «pw» cùng --cookie-tep ⇒ rc 2 trước khi mở trình duyệt.
const thoat = s => { console.error(s); process.exit(2); };
const docGoc = s => {   // chỉ gốc: https://host hay http://127.0.0.1:<cổng>; có đường khác /, truy vấn, #, tài khoản ⇒ null
  let u; try { u = new URL(s); } catch { return null; }
  const giao = u.protocol === 'https:' || (u.protocol === 'http:' && u.hostname === '127.0.0.1');
  return giao && u.pathname === '/' && !u.search && !u.hash && !u.username && !u.password ? u.origin : null;
};
const loiCheDo = (url, pha, va) => url && (pha || va) ? '--url: trang thật chỉ đo, không cấy (không đi cùng --pha/--va)' : null;
const quyenCookie = st => st.isFile() && st.uid === process.getuid() && (st.mode & 0o077) === 0;
const docCookie = t => {   // O_NOFOLLOW: symlink ⇒ lỗi · O_NONBLOCK: FIFO không treo (fstat loại) · đọc qua fd đã kiểm (không đổi tệp giữa chừng)
  let fd; try { fd = fs.openSync(t, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK); } catch { return null; }
  try {
    const st = fs.fstatSync(fd);
    if (!quyenCookie(st)) return null;
    const v = fs.readFileSync(fd, 'utf8').replace(/\r?\n$/, '');
    return /^[\w.~+/=-]+$/.test(v) ? v : null;
  } finally { fs.closeSync(fd); }
};
// Vòng sửa 1: thamSo khớp đúng chuỗi ⇒ `--url=https://h`, `-url`, cờ gõ sai từng bị bỏ lặng ⇒ chạy chế độ cũ, rc 0 mà trang thật không được đo.
// Tham số lạ ⇒ rc 2 TRƯỚC mọi kiểm khác. Dạng `--tên=…` cấm ở MỌI vị trí, kể cả chỗ giá trị (`--cu --url=…` ⇒ cu lạ, chạy chế độ cũ);
// thông báo không in phần sau `=` (có thể là giá trị bí mật gõ nhầm).
const CO_GIA_TRI = ['--url', '--cookie-tep', '--va', '--cu', '--co'];   // cờ nhận giá trị: phần tử kế là giá trị, không xét là cờ
const thamSoLa = a => a.find((x, i) => /^--[^=]+=/.test(x) || (x.startsWith('-') && x !== '--pha' && !CO_GIA_TRI.includes(x) && !CO_GIA_TRI.includes(a[i - 1])));
const la = thamSoLa(process.argv.slice(2));
if (la !== undefined) thoat(`tham số lạ: ${la.replace(/=.*/s, '=…')} — nhận --pha · --url <gốc> · --cookie-tep <tệp> · --va <tệp> · --cu <…> · --co <…> (không nhận dạng --tên=giá trị)`);
// Pha C Task 5 (L4): cờ nhận giá trị đứng cuối hay phần tử kế là cờ «-…» ⇒ thamSo trả undefined/cờ: --co bị bỏ lặng (đo cả 6 cỡ), --va thành {}
// ⇒ rc 2. Thông báo chỉ nêu tên cờ (từ CO_GIA_TRI), không in phần tử kế.
const thieuGiaTri = a => a.find((x, i) => CO_GIA_TRI.includes(x) && (a[i + 1] ?? '-').startsWith('-'));
const thieu = thieuGiaTri(process.argv.slice(2));
if (thieu !== undefined) thoat(`${thieu}: thiếu giá trị (đứng cuối hay phần tử kế là cờ) — viết ${thieu} <giá trị>`);
const coUrl = process.argv.includes('--url'), tepCookie = thamSo('--cookie-tep');
const loiCD = loiCheDo(coUrl, pha, process.argv.includes('--va')); if (loiCD) thoat(loiCD);
const goc = coUrl ? docGoc(thamSo('--url')) ?? thoat('--url: chỉ gốc https://<host> hay http://127.0.0.1:<cổng> (không đường, truy vấn, #)') : null;
if (tepCookie !== null && !coUrl) thoat('--cookie-tep chỉ đi cùng --url');
// DEBUG=pw:protocol (hay pw:*) ⇒ Playwright in thông điệp CDP ra stderr, có lệnh đặt cookie mang giá trị CF_Authorization ⇒ từ chối TRƯỚC khi đọc tệp.
if (tepCookie !== null && /pw/i.test(process.env.DEBUG ?? '')) thoat('--cookie-tep: biến DEBUG có «pw» ⇒ Playwright in giá trị cookie ra stderr; chạy lại bằng `env -u DEBUG node kiem/chay-do.mjs …`');
const cookie = tepCookie === null ? null : docCookie(tepCookie) ??
  thoat('--cookie-tep: phải là tệp thường của chính uid này, không quyền nhóm/khác (0600), không symlink, một dòng giá trị cookie');
// Mọi yêu cầu tới gốc khác GET/HEAD ⇒ huỷ + ghi vào `ghi`. Gắn SAU ganCanh (trangMoi) ⇒ chạy TRƯỚC nó (Playwright: route gắn sau thắng);
// yêu cầu còn lại fallback về ganCanh (khác gốc ⇒ chặn + mang). Mức context: thấy cả yêu cầu do service worker gửi.
const chanGhi = (ctx, goc, ghi) => ctx.route('**/*', r => {
  const q = r.request(), u = new URL(q.url());
  if (u.origin !== goc || ['GET', 'HEAD'].includes(q.method())) return r.fallback();
  ghi.push(q.method() + ' ' + u.pathname);
  return r.abort();
});
const BO_HET = 'màn Hết phiên · cần cầu bỏ vé';
const cu =(thamSo('--cu') ?? '').split(',').filter(Boolean);
const va = thamSo('--va') ? JSON.parse(fs.readFileSync(thamSo('--va'), 'utf8')) : {};
const CO = [[375, 812], [768, 1024], [1440, 900]].flatMap(([w, h]) => ['light', 'dark'].map(c => [w, h, c]));
const tenCo = ([w, h, c]) => `${w}x${h}-${c}`;
const chon = thamSo('--co')?.split(',');
const cacCo = chon ? CO.filter(c => chon.includes(tenCo(c))) : CO;
if (!cacCo.length || (chon && cacCo.length !== chon.length)) { console.error('cỡ không có: ' + chon + ' (có: ' + CO.map(tenCo) + ')'); process.exit(2); }
const PHA = 'button,a{min-height:0!important;min-width:0!important;padding:0!important;font-size:11px!important}';
const SRC = fs.readFileSync(new URL('./do-ban-that.js', import.meta.url), 'utf8');
const HET = '#noi-dung > section[data-man="het-phien"]';
const MAU = fileURLToPath(new URL('../test-may-chu/mau/', import.meta.url));   // tệp xuất mẫu (như test-web/man-chu.test.mjs)

let m;
const ngayCong = (s, n) => new Date(Date.parse(s.slice(0, 10)) + n * 864e5).toISOString().slice(0, 10) + s.slice(10);
let aiNgoaiMien = false;   // R11: trang bật qua móc __aiNgoaiMien ⇒ đề xuất hạn 2101-01-01 (ngoài miền laNgay 2000–2100)
const goiAI = async () => {
  const v = (await goi(m.may, '/api/viec?mo=1')).json.viec[0];
  if (!v?.han) throw new Error('goiAI giả: không có việc mở có hạn');
  const han = aiNgoaiMien ? '2101-01-01' : ngayCong(v.han, 1);
  return JSON.stringify({ noi_dung: `Dời hạn «${v.tieu_de}» sang ${han}`, ops: [{ loai: 'sua', bang: 'viec', id: v.id, phien_ban: v.phien_ban, truong: { han } }] });
};
const doTrang = async (page, cheDo = null) => {
  try { return await page.evaluate(`(${SRC})(${JSON.stringify(cu)}, ${JSON.stringify(cheDo)})`); }
  catch (e) { return { dat: false, hong: ['bộ đo nổ: ' + e.message.slice(0, 160)], doiChung: {}, khoiDuoiNep: [], cos: [], bo: [] }; }
};
const dong = (co, kq, loi, mang, ghi = null, bo = null) => {   // ghi/bo chỉ ở chế độ --url
  const dat = kq.dat && !loi.length && !mang.length && !ghi?.length;
  console.log(JSON.stringify({ co, dat, hong: kq.hong, loi: loi.slice(0, 5), mang: mang.slice(0, 5),
    doiChungTruot: Object.entries(kq.doiChung).filter(([, v]) => !v).map(([k]) => k), khoiDuoiNep: kq.khoiDuoiNep, cosDat: kq.cos.length,
    ...(ghi ? { ghi: ghi.slice(0, 5), bo } : {}) }));
  return dat;
};

// R8 (lượt 4c, ngoài trang): bấm THẬT liên kết thanh trái (☰ hiện ⇒ bấm ☰ mở ngăn trước) ⇒ location.hash = '#<id>' VÀ section[data-man=<id>] hiện.
// Không tự đặt hash. Bắt đầu từ cos, kết ở chu (phép trong trang để trang ở #chu) ⇒ mỗi cú bấm đều phải đổi màn; trượt ở liên kết đầu ⇒ dừng.
// CŨ (CU R8; demo :47 toi()): đặt location.hash rồi chờ màn — lọt liên kết bị chặn.
const LIEN_KET = ['cos', 'hoc', 'y-tuong', 'tri-thuc', 'factory', 'sia', 'toa-an', 'tai-chinh', 'dau-tu', 'creator', 'nao-chung', 'chu'];
const doLoiVao = async page => {
  const menu = page.locator('[data-act="mo-menu"]');
  for (const id of LIEN_KET) {
    const man = page.locator(`#noi-dung > section[data-man="${id}"]`);
    try {
      if (cu.includes('R8')) await page.evaluate(h => { location.hash = h; }, '#' + id);
      else { if (await menu.isVisible()) await menu.click({ timeout: 5000 }); await page.locator(`#cac-mach a[href="#${id}"]`).click({ timeout: 5000 }); }
      await man.waitFor({ timeout: 3000 }).catch(() => {});
      const hash = await page.evaluate(() => location.hash);
      if (hash !== '#' + id || !(await man.isVisible())) return [`bấm liên kết không đổi màn: #${id} (hash ${hash || 'rỗng'})`];
    } catch (e) { return [`bấm liên kết không đổi màn: #${id} (${e.message.split('\n')[0].slice(0, 100)})`]; }
  }
  return [];
};

// Bàn phím (lượt 4c, ngoài trang, phím THẬT). ☰ hiện: Tab tới ☰, Enter ⇒ focus vào ngăn; Tab 15 rồi Shift+Tab 15 ⇒ focus không ra ngoài ngăn
// (ngăn = #danh-sach-mach + nút che #che-menu của nó; body = focus đã rời trang sang khung trình duyệt — đo thật 375: sau 13 Tab ⇒ body ⇒ #che-menu
// ⇒ vòng lại ngăn; thứ phép canh là .workspace inert); Esc ⇒ ngăn đóng, focus về ☰. Mọi cỡ: Tab tới nút sửa việc đầu, Enter ⇒ hộp mở, focus trong
// hộp; Esc ⇒ hộp đóng, focus về ĐÚNG nút đó. Chờ hiệu ứng như choHieuUng của do-ban-that.js (mục 0 lượt 4b) trước mỗi lần đọc focus.
// Trang thật (Pha C Task 5, L3): có nút sửa BẬT thì đo như trên; không có ⇒ bỏ, lý do vào `bo` (kho trống, hay nút disabled vì cos_ghi tắt —
// web/viec-lich.js vẽ nút ghi disabled, Tab không tới). Đếm khi màn cos đã vẽ ([data-brief] vẽ cùng lượt với dòng việc), không đợi nút.
const choHieuUng = page => page.evaluate(async () => { const a = document.documentElement.getAnimations({ subtree: true });
  if (a.length) await Promise.race([Promise.allSettled(a.map(x => x.finished)), new Promise(r => setTimeout(r, 1000))]); });
const tabToi = async (page, sel) => {   // Tab (vòng qua cả trang) tới phần tử ĐẦU khớp sel; trần 80 phím
  for (let i = 0; i < 80; i++) { await page.keyboard.press('Tab'); if (await page.evaluate(s => document.activeElement === document.querySelector(s), sel)) return true; }
  return false;
};
const doBanPhim = async (page, bo) => {
  const hong = [], ve = f => page.evaluate(f);
  try {
    if (await page.locator('[data-act="mo-menu"]').isVisible()) {
      if (!(await tabToi(page, '[data-act="mo-menu"]'))) throw Error('Tab không tới ☰');
      await page.keyboard.press('Enter'); await choHieuUng(page);
      if (!(await ve(() => !!document.activeElement?.closest('#danh-sach-mach')))) hong.push('Enter ở ☰: focus không vào ngăn');
      ngoai: for (const phim of ['Tab', 'Shift+Tab']) for (let i = 1; i <= 15; i++) {
        await page.keyboard.press(phim);
        const x = await ve(() => { const a = document.activeElement;
          return a && a !== document.body && !a.closest('#danh-sach-mach,#che-menu') ? (a.getAttribute('aria-label') || a.textContent.trim().slice(0, 20) || a.tagName) : null; });
        if (x) { hong.push(`Tab thoát khỏi ngăn: ${phim} lần ${i} tới «${x}»`); break ngoai; }
      }
      await page.keyboard.press('Escape'); await choHieuUng(page);
      if (await ve(() => document.body.classList.contains('mo-menu'))) hong.push('Esc không đóng ngăn ☰');
      else if (!(await ve(() => document.activeElement === document.querySelector('[data-act="mo-menu"]')))) hong.push('focus không về chỗ cũ: Esc ở ngăn ☰');
    }
    const SUA = '[data-man="cos"] [data-viec] [data-act="sua"]';
    await ve(() => { location.hash = '#cos'; });
    if (goc) {
      await page.locator('[data-man="cos"] [data-brief]').waitFor({ timeout: 5000 });
      const n = await page.locator(SUA).count(), bat = await page.locator(SUA + ':enabled').count();
      if (!bat) { bo.push('bàn phím hộp sửa việc · trang thật ' + (n ? 'có dòng việc nhưng nút sửa tắt (cos_ghi tắt)' : 'không có dòng việc')); return hong; }
    }
    await page.locator(SUA).first().waitFor({ timeout: 5000 });
    await ve(() => document.getElementById('noi-dung').focus());
    if (!(await tabToi(page, SUA))) throw Error('Tab không tới nút sửa việc đầu');
    const nut = await page.evaluateHandle(() => document.activeElement);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.getElementById('hop').open, null, { timeout: 3000 }).catch(() => {}); await choHieuUng(page);
    if (!(await ve(() => document.getElementById('hop').open && !!document.activeElement?.closest('#hop')))) hong.push('Enter ở nút sửa việc: hộp không mở hay focus không vào hộp');
    else {
      await page.keyboard.press('Escape'); await choHieuUng(page);
      await ve(() => new Promise(r => setTimeout(r, 0)));   // sự kiện close (traFocus) chạy xong rồi mới đọc focus
      if (await ve(() => document.getElementById('hop').open)) hong.push('Esc không đóng hộp sửa việc');
      else if (!(await page.evaluate(b => document.activeElement === b, nut))) hong.push('focus không về chỗ cũ: Esc ở hộp sửa việc');
    }
    await nut.dispose();
  } catch (e) { hong.push('bàn phím: ' + e.message.split('\n')[0].slice(0, 120)); }
  finally {   // về #chu: màn Hết phiên của cỡ cuối đổi hash sang #cos để gọi API
    await ve(() => { location.hash = '#chu'; }).catch(() => {});
    await page.locator('#noi-dung > section[data-man="chu"]').waitFor({ timeout: 5000 }).catch(() => {});
  }
  return hong;
};

const trinh = await moTrinh();
let sai = 0, xuat = null;
try {
  // Vòng sửa 1: máy có thư mục xuất vào (trang-thai.json giờ dựng = lúc chạy + viec-bo.json mẫu, như man-chu.test) ⇒ 4 khối màn chủ từ tệp xuất
  // và nhóm Việc nhà được đo CÓ dữ liệu (không còn chỉ ở trạng thái «chưa nối»).
  if (!goc) {   // trang thật (--url): không dựng máy, không datBan
    xuat = fs.mkdtempSync(path.join(process.env.WO_GOC || '/tmp', 'wo-x-'));
    fs.writeFileSync(path.join(xuat, 'trang-thai.json'), JSON.stringify({ ...JSON.parse(fs.readFileSync(path.join(MAU, 'trang-thai.json'), 'utf8')), gio_dung: new Date().toISOString() }));
    fs.copyFileSync(path.join(MAU, 'viec-bo.json'), path.join(xuat, 'viec-bo.json'));
    m = await dungMay({ cosGhi: true, goiAI, xuatVao: xuat });
    await datBan(m, { va });
  }
  const dau = goc ?? m.url;
  for (const [i, [width, height, colorScheme]] of cacCo.entries()) {
    const { ctx, page, loi, mang } = await trangMoi(trinh, dau, { viewport: { width, height }, colorScheme });
    const ghi = goc ? [] : null;
    try {
      if (goc) {
        await chanGhi(ctx, goc, ghi);
        // url ⇒ Playwright tự đặt domain/path và secure khi https · lỗi addCookies có thể mang cookie ⇒ ném lỗi đã làm sạch
        if (cookie) try { await ctx.addCookies([{ name: 'CF_Authorization', value: cookie, url: goc + '/', httpOnly: true, sameSite: 'Lax' }]); }
        catch { throw new Error('nạp cookie CF_Authorization vào context hỏng'); }
      } else await page.exposeFunction('__aiNgoaiMien', b => { aiNgoaiMien = b === true; });
      await page.goto(dau + '/#chu');
      await page.locator('html[data-san="1"]').waitFor({ timeout: 10000 });
      // CSSOM (không phải <style>): CSP chặn thẻ style nội tuyến, không chặn bảng kiểu dựng bằng mã.
      if (pha) await page.evaluate(css => { const s = new CSSStyleSheet(); s.replaceSync(css); document.adoptedStyleSheets = [...document.adoptedStyleSheets, s]; }, PHA);
      const kq = await doTrang(page, goc ? 'url' : null), ngoai = [];
      ngoai.push(...await doLoiVao(page));   // R8
      ngoai.push(...await doBanPhim(page, kq.bo));   // bàn phím
      kq.hong.push(...ngoai); kq.dat &&= !ngoai.length;
      const cuoi = i === cacCo.length - 1, bo = goc ? [...kq.bo, ...(cuoi ? [BO_HET] : [])] : null;
      if (!dong(tenCo([width, height, colorScheme]), kq, loi, mang, ghi, bo)) sai++;
      if (!cuoi || goc) continue;
      // Màn Hết phiên: cầu bỏ vé ⇒ 401 ở lần gọi API kế ⇒ trang tự chuyển màn. Lỗi «401» của trình duyệt ở bước này là chủ ý.
      const nL = loi.length, nM = mang.length;
      m.cau.datVe(null);
      await page.evaluate(() => { location.hash = '#cos'; });
      await page.locator(HET).waitFor({ timeout: 5000 }).catch(() => {});
      const loiHet = loi.slice(nL).filter(x => !x.includes('status of 401'));
      if (!dong(tenCo([width, height, colorScheme]) + '-het-phien', await doTrang(page, 'het-phien'), loiHet, mang.slice(nM))) sai++;
    } finally { aiNgoaiMien = false; m?.cau.datVe(); await ctx.close(); }
  }
} catch (e) { console.error(e); sai = -1; }
finally {
  await trinh.close(); await m?.dong();
  if (xuat) { for (const t of fs.readdirSync(xuat)) fs.unlinkSync(path.join(xuat, t)); fs.rmdirSync(xuat); }
}
process.exitCode = sai < 0 ? 2 : sai ? 1 : 0;
