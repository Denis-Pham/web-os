// Vẽ biểu tượng cài ra màn hình chính (Khuôn L7) từ web/bieu-tuong.svg bằng Chrome thật (đường ở duong-pw.cjs):
// `node kiem/ve-bieu-tuong.mjs` ⇒ web/bieu-tuong-{180,192,512}.png (nền trong suốt ngoài góc bo). Commit tệp PNG; tinh.test kiểm chữ ký + cỡ.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import duong from './duong-pw.cjs';

const { chromium } = createRequire(import.meta.url)(duong.PW);
const WEB = new URL('../web/', import.meta.url), svg = fs.readFileSync(new URL('bieu-tuong.svg', WEB), 'utf8');
const trinh = await chromium.launch({ executablePath: duong.CHROME, headless: true });
try {
  for (const n of [180, 192, 512]) {
    const page = await trinh.newPage({ viewport: { width: n, height: n } });
    await page.setContent(`<!doctype html><style>html,body{margin:0}svg{display:block;width:${n}px;height:${n}px}</style>${svg}`);
    const tep = new URL(`bieu-tuong-${n}.png`, WEB);
    fs.writeFileSync(tep, await page.screenshot({ type: 'png', omitBackground: true }));
    console.log(`${tep.pathname} ${fs.statSync(tep).size} B`);
    await page.close();
  }
} finally { await trinh.close(); }
