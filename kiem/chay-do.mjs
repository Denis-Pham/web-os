// node kiem/chay-do.mjs [--pha]   (đứng ở gốc repo)
// B4 bước 1 (chép từ web-os-demo@6f544d4 kiem/chay-do.cjs): ESM tối thiểu + nạp TRANG THẬT — máy chủ thật + cầu vé 127.0.0.1 (dungMay),
// bản web/ qua đường duyệt A5 (datBan); bộ đo vẫn là do-demo.js nguyên bản (kiem/do-ban-that.js).
// 375×812 và 1440×900, mỗi cỡ sáng + tối; chặn mọi gói khác gốc cầu (ganCanh). rc 0 = cả 4 cỡ đạt.
// --pha: chèn CSS cố ý hỏng (nút nhỏ, chữ nhỏ) — phải ra TRƯỢT (đối chứng của cả bộ đo).
import fs from 'node:fs';
import { moTrinh, dungMay, datBan, trangMoi } from '../test-web/chung-web.mjs';
const pha = process.argv.includes('--pha');
const PHA = 'button,a{min-height:0!important;min-width:0!important;padding:0!important;font-size:11px!important}';
const browser = await moTrinh(), m = await dungMay({ cosGhi: true });
let sai = 0;
try {
  await datBan(m);
  for (const [width, height, colorScheme] of [[375, 812, 'light'], [375, 812, 'dark'], [1440, 900, 'light'], [1440, 900, 'dark']]) {
    const { ctx, page, loi, mang } = await trangMoi(browser, m.url, { viewport: { width, height }, colorScheme });
    await page.goto(m.url + '/#chu');
    await page.waitForTimeout(300);
    if (pha) await page.addStyleTag({ content: PHA });
    let kq;
    try { kq = await page.evaluate(fs.readFileSync(new URL('./do-ban-that.js', import.meta.url), 'utf8')); }
    catch (e) { kq = { dat: false, hong: ['bộ đo nổ: ' + e.message.slice(0, 160)], doiChung: {}, khoiDuoiNep: [], cos: [] }; }
    const dat = kq.dat && !loi.length && !mang.length;
    console.log(JSON.stringify({ co: width + 'x' + height + ' ' + colorScheme, dat, soHong: kq.hong.length, hong: kq.hong.slice(0, 8),
      doiChungTruot: Object.entries(kq.doiChung).filter(([, v]) => !v).map(([k]) => k), khoiDuoiNep: kq.khoiDuoiNep,
      cosDat: kq.cos.length, loi: loi.slice(0, 3), mang: mang.slice(0, 3) }));
    if (!dat) sai++;
    await ctx.close();
  }
} finally { await browser.close(); await m.dong(); }
process.exitCode = sai ? 1 : 0;
