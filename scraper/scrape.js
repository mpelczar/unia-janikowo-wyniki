const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const TEAM_ID  = '9008b895-5ef0-44bf-a9d7-88578096f3ab';
const PLAY_ID  = '0fb7f0c2-ddb3-4d29-a130-90412a4a2393';
const PAGE_URL = `https://www.laczynaspilka.pl/rozgrywki/druzyna/${TEAM_ID}?tab=tab-mecz&playDictionary=${PLAY_ID}`;

const OUTPUT_DIR = path.join(__dirname, '..', 'data');
const IMG_FILE   = path.join(OUTPUT_DIR, 'matches.png');
const META_FILE  = path.join(OUTPUT_DIR, 'meta.json');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 1 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

  try {
    await page.goto(PAGE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  } catch (e) {
    console.log('Timeout:', e.message);
  }

  await new Promise(r => setTimeout(r, 5000));

  // Wypisz pozycje WSZYSTKICH h2/h3
  const info = await page.evaluate(() => {
    const result = [];
    document.querySelectorAll('h1,h2,h3,h4').forEach(el => {
      const rect = el.getBoundingClientRect();
      result.push({
        tag: el.tagName,
        text: el.textContent.trim().substring(0, 50),
        y: Math.round(rect.top + window.scrollY),
        visible: rect.width > 0 && rect.height > 0,
      });
    });
    return result;
  });

  console.log('Nagłówki na stronie:', JSON.stringify(info, null, 2));

  // Zapisz pełny screenshot
  await page.screenshot({ path: IMG_FILE, fullPage: true });

  await browser.close();
  fs.writeFileSync(META_FILE, JSON.stringify({ updatedAt: new Date().toISOString() }, null, 2));
  console.log('✅ Gotowe');
})();
