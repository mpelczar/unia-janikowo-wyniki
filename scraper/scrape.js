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

  // Kliknij przycisk przez dokładny data-testid
  try {
    await page.waitForSelector('[data-testid="uc-accept-all-button"]', { timeout: 5000 });
    await page.click('[data-testid="uc-accept-all-button"]');
    console.log('✓ Kliknięto Zaakceptuj wszystkie');
  } catch (e) {
    console.log('Brak przycisku lub błąd:', e.message);
  }

  // Poczekaj aż banner zniknie
  await new Promise(r => setTimeout(r, 3000));

  // Ukryj header/footer
  await page.evaluate(() => {
    ['.pzpn-top-bar', '.l-cd', 'header', 'nav', 'footer',
     '[class*="navbar"]', '[class*="footer"]', '[class*="breadcrumb"]'].forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.style.setProperty('display', 'none', 'important');
      });
    });
    document.body.style.background = '#fff';
    document.body.style.setProperty('overflow', 'auto', 'important');
    document.documentElement.style.setProperty('overflow', 'auto', 'important');
  });

  await new Promise(r => setTimeout(r, 500));

   const topY = await page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll('h2, h3'))
      .filter(el => el.textContent.includes('mecze') || el.textContent.includes('Mecze'));
    if (!headers.length) return 1200;
    // Szukamy nagłówka który NIE jest wewnątrz elementu fixed/overlay
    for (const h of headers) {
      let el = h;
      let insideFixed = false;
      while (el.parentElement) {
        el = el.parentElement;
        const s = getComputedStyle(el);
        if (s.position === 'fixed' || parseInt(s.zIndex) > 100) {
          insideFixed = true;
          break;
        }
      }
      if (!insideFixed) {
        const rect = h.getBoundingClientRect();
        return Math.max(0, rect.top + window.scrollY - 24);
      }
    }
    return 1200;
  });

  console.log('Pozycja sekcji Y:', topY);

  await page.screenshot({
    path: IMG_FILE,
    clip: { x: 0, y: topY, width: 1200, height: 1800 },
  });

  await browser.close();

  fs.writeFileSync(META_FILE, JSON.stringify({ updatedAt: new Date().toISOString() }, null, 2));
  console.log(`✅ Screenshot: ${Math.round(fs.statSync(IMG_FILE).size / 1024)} KB`);
})();
