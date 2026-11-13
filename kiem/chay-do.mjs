// node kiem/chay-do.cjs demo/<bản> [--pha]   (đứng ở gốc repo)
// 375×812 và 1440×900, mỗi cỡ sáng + tối; mở bằng file://, chặn mọi gói mạng. rc 0 = cả 4 cỡ đạt.
// --pha: chèn CSS cố ý hỏng (nút nhỏ, chữ nhỏ) — phải ra TRƯỢT (đối chứng của cả bộ đo).
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const thuMuc = path.resolve(process.argv[2] || 'demo/claude');
const pha = process.argv.includes('--pha');
const PHA = 'button,a{min-height:0!important;min-width:0!important;padding:0!important;font-size:11px!important}';
(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  let sai = 0;
  try {
    for (const [width, height, colorScheme] of [[375, 812, 'light'], [375, 812, 'dark'], [1440, 900, 'light'], [1440, 900, 'dark']]) {
      const page = await browser.newPage({ viewport: { width, height }, colorScheme });
      const loi = [], mang = [];
      await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:') || u.startsWith('data:')) return r.continue(); mang.push(u); return r.abort(); });
      page.on('pageerror', e => loi.push(e.message));
      page.on('console', m => { if (m.type() === 'error') loi.push(m.text()); });
      await page.goto(pathToFileURL(path.join(thuMuc, 'index.html')).href + '#chu');
      await page.waitForTimeout(300);
      if (pha) await page.addStyleTag({ content: PHA });
      let kq;
      try { kq = await page.evaluate(fs.readFileSync(path.join(__dirname, 'do-demo.js'), 'utf8')); }
      catch (e) { kq = { dat: false, hong: ['bộ đo nổ: ' + e.message.slice(0, 160)], doiChung: {}, khoiDuoiNep: [], cos: [] }; }
      const dat = kq.dat && !loi.length && !mang.length;
      console.log(JSON.stringify({ co: width + 'x' + height + ' ' + colorScheme, dat, soHong: kq.hong.length, hong: kq.hong.slice(0, 8),
        doiChungTruot: Object.entries(kq.doiChung).filter(([, v]) => !v).map(([k]) => k), khoiDuoiNep: kq.khoiDuoiNep,
        cosDat: kq.cos.length, loi: loi.slice(0, 3), mang: mang.slice(0, 3) }));
      if (!dat) sai++;
      await page.close();
    }
  } finally { await browser.close(); }
  process.exitCode = sai ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
