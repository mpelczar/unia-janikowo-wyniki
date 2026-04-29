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
  await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 2 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

  try {
    await page.goto(PAGE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  } catch (e) {
    console.log('Timeout, kontynuuję...', e.message);
  }

  await new Promise(r => setTimeout(r, 5000));

  // Znajdź pozycję sekcji z meczami
  const topY = await page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll('h2, h3'))
      .filter(el => el.textContent.includes('mecze') || el.textContent.includes('Mecze'));
    if (!headers.length) return 600;
    const rect = headers[0].getBoundingClientRect();
    return Math.max(0, rect.top + window.scrollY - 24);
  });

  console.log('Pozycja sekcji Y:', topY);

  // Ukryj header/footer (nie ruszamy bannera)
  await page.evaluate(() => {
    ['header', 'nav', '[class*="navbar"]', '[class*="breadcrumb"]',
     'footer', '[class*="footer"]'].forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.style.setProperty('display', 'none', 'important');
      });
    });
    document.body.style.background = '#fff';
  });

  // Screenshot przez clip — bierzemy obszar strony OD pozycji meczów
  // Banner jest fixed więc NIE jest w scroll position, jest zawsze na viewport
  // Używamy fullPage:true i clip żeby wziąć konkretny fragment dokumentu
  await page.screenshot({
    path: IMG_FILE,
    fullPage: true,
    clip: { x: 0, y: topY, width: 1200, height: 1050 },
  });

  await browser.close();

  fs.writeFileSync(META_FILE, JSON.stringify({ updatedAt: new Date().toISOString() }, null, 2));
  console.log(`✅ Screenshot: ${Math.round(fs.statSync(IMG_FILE).size / 1024)} KB`);
})();
