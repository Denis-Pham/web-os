// node kiem/chay-do.mjs [--pha] [--cu R6,R7,…] [--co 375x812-light,…] [--va <tệp json>]   (đứng ở gốc repo)
// Bộ đo bản thật (B4; chép từ web-os-demo@6f544d4 kiem/chay-do.cjs rồi vá): máy chủ thật + cầu vé 127.0.0.1 (dungMay, cos_ghi bật, goiAI GIẢ
// tất định trong tiến trình — dời hạn việc mở đầu tiên + 1 ngày; KHÔNG ra mạng), bản web/ (hoặc bản cấy --va { 'tệp': [[cũ, mới], …] }) qua
// đường duyệt A5 (datBan). Bộ dữ liệu chuẩn gieo qua POST /api/goi (datLai trong kiem/do-ban-that.js). 6 cỡ: 375×812, 768×1024, 1440×900 ×
// sáng + tối; cỡ cuối thêm màn Hết phiên (cầu bỏ vé). Mỗi cỡ in MỘT dòng JSON (co, dat, hong[], loi[], mang[]); yêu cầu khác gốc cầu hay lỗi
// console ⇒ trượt. rc 0 = mọi cỡ đạt · 1 = có cỡ trượt · 2 = bộ đo lỗi (tham số sai, nổ). --pha: CSS cố ý hỏng (nút nhỏ, chữ nhỏ) ⇒ phải rc 1.
import fs from 'node:fs';
import { moTrinh, dungMay, datBan, trangMoi } from '../test-web/chung-web.mjs';
import { goi } from '../test-may-chu/chung.mjs';

const thamSo = ten => { const i = process.argv.indexOf(ten); return i < 0 ? null : process.argv[i + 1]; };
const pha = process.argv.includes('--pha');
const cu = (thamSo('--cu') ?? '').split(',').filter(Boolean);
const va = thamSo('--va') ? JSON.parse(fs.readFileSync(thamSo('--va'), 'utf8')) : {};
const CO = [[375, 812], [768, 1024], [1440, 900]].flatMap(([w, h]) => ['light', 'dark'].map(c => [w, h, c]));
const tenCo = ([w, h, c]) => `${w}x${h}-${c}`;
const chon = thamSo('--co')?.split(',');
const cacCo = chon ? CO.filter(c => chon.includes(tenCo(c))) : CO;
if (!cacCo.length || (chon && cacCo.length !== chon.length)) { console.error('cỡ không có: ' + chon + ' (có: ' + CO.map(tenCo) + ')'); process.exit(2); }
const PHA = 'button,a{min-height:0!important;min-width:0!important;padding:0!important;font-size:11px!important}';
const SRC = fs.readFileSync(new URL('./do-ban-that.js', import.meta.url), 'utf8');
const HET = '#noi-dung > section[data-man="het-phien"]';

let m;
const ngayCong = (s, n) => new Date(Date.parse(s.slice(0, 10)) + n * 864e5).toISOString().slice(0, 10) + s.slice(10);
const goiAI = async () => {
  const v = (await goi(m.may, '/api/viec?mo=1')).json.viec[0];
  if (!v?.han) throw new Error('goiAI giả: không có việc mở có hạn');
  const han = ngayCong(v.han, 1);
  return JSON.stringify({ noi_dung: `Dời hạn «${v.tieu_de}» sang ${han}`, ops: [{ loai: 'sua', bang: 'viec', id: v.id, phien_ban: v.phien_ban, truong: { han } }] });
};
const doTrang = async (page, cheDo = null) => {
  try { return await page.evaluate(`(${SRC})(${JSON.stringify(cu)}, ${JSON.stringify(cheDo)})`); }
  catch (e) { return { dat: false, hong: ['bộ đo nổ: ' + e.message.slice(0, 160)], doiChung: {}, khoiDuoiNep: [], cos: [] }; }
};
const dong = (co, kq, loi, mang) => {
  const dat = kq.dat && !loi.length && !mang.length;
  console.log(JSON.stringify({ co, dat, hong: kq.hong, loi: loi.slice(0, 5), mang: mang.slice(0, 5),
    doiChungTruot: Object.entries(kq.doiChung).filter(([, v]) => !v).map(([k]) => k), khoiDuoiNep: kq.khoiDuoiNep, cosDat: kq.cos.length }));
  return dat;
};

const trinh = await moTrinh();
let sai = 0;
try {
  m = await dungMay({ cosGhi: true, goiAI });
  await datBan(m, { va });
  for (const [i, [width, height, colorScheme]] of cacCo.entries()) {
    const { ctx, page, loi, mang } = await trangMoi(trinh, m.url, { viewport: { width, height }, colorScheme });
    try {
      await page.goto(m.url + '/#chu');
      await page.locator('html[data-san="1"]').waitFor({ timeout: 10000 });
      // CSSOM (không phải <style>): CSP chặn thẻ style nội tuyến, không chặn bảng kiểu dựng bằng mã.
      if (pha) await page.evaluate(css => { const s = new CSSStyleSheet(); s.replaceSync(css); document.adoptedStyleSheets = [...document.adoptedStyleSheets, s]; }, PHA);
      if (!dong(tenCo([width, height, colorScheme]), await doTrang(page), loi, mang)) sai++;
      if (i < cacCo.length - 1) continue;
      // Màn Hết phiên: cầu bỏ vé ⇒ 401 ở lần gọi API kế ⇒ trang tự chuyển màn. Lỗi «401» của trình duyệt ở bước này là chủ ý.
      const nL = loi.length, nM = mang.length;
      m.cau.datVe(null);
      await page.evaluate(() => { location.hash = '#cos'; });
      await page.locator(HET).waitFor({ timeout: 5000 }).catch(() => {});
      const loiHet = loi.slice(nL).filter(x => !x.includes('status of 401'));
      if (!dong(tenCo([width, height, colorScheme]) + '-het-phien', await doTrang(page, 'het-phien'), loiHet, mang.slice(nM))) sai++;
    } finally { m.cau.datVe(); await ctx.close(); }
  }
} catch (e) { console.error(e); sai = -1; }
finally { await trinh.close(); await m?.dong(); }
process.exitCode = sai < 0 ? 2 : sai ? 1 : 0;
