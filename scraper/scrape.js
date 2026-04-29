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
  console.log('Uruchamianie Puppeteer...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 2 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

  // Ustaw cookies zgody PRZED załadowaniem strony
  // Usercentrics przechowuje zgodę w localStorage i cookies
  await page.evaluateOnNewDocument(() => {
    // Symuluj zgodę Usercentrics
    const consent = {
      controllerId: 'laczynaspilka',
      language: 'pl',
      version: { explicit: 1 },
      tcfTCString: '',
      consentedAll: true,
    };

    // localStorage
    try {
      localStorage.setItem('uc_user_interaction', '1');
      localStorage.setItem('uc_ui_mode', 'wall');
      localStorage.setItem('usercentrics-consent', JSON.stringify(consent));
    } catch(e) {}

    // Ukryj banner przez CSS zanim się załaduje
    const style = document.createElement('style');
    style.textContent = `
      #uc-center-container,
      [data-testid="uc-default-wall"],
      [data-testid="uc-overlay"],
      #app-focus-lock,
      .sc-cwHptR,
      [id^="usercentrics"],
      [class*="usercentrics"] { display: none !important; }
    `;
    document.head.appendChild(style);
  });

  console.log('Ładowanie strony PZPN...');
  try {
    await page.goto(PAGE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  } catch (e) {
    console.log('Timeout, kontynuuję...', e.message);
  }

  await new Promise(r => setTimeout(r, 5000));

  // Agresywne ukrycie wszystkiego co może być bannerem
  await page.evaluate(() => {
    // Ukryj przez data-testid
    document.querySelectorAll('[data-testid^="uc-"]').forEach(el => {
      el.style.setProperty('display', 'none', 'important');
    });

    // Ukryj przez treść
    document.querySelectorAll('button').forEach(btn => {
      if (btn.textContent.includes('Zaakceptuj') || btn.textContent.includes('Odrzuć')) {
        let el = btn;
        // Idź w górę drzewa DOM żeby znaleźć kontener bannera
        for (let i = 0; i < 10; i++) {
          if (!el.parentElement) break;
          el = el.parentElement;
          const s = getComputedStyle(el);
          if (s.position === 'fixed' || s.zIndex > 100) {
            el.style.setProperty('display', 'none', 'important');
            break;
          }
        }
      }
    });

    // Ukryj overlay
    document.querySelectorAll('*').forEach(el => {
      const s = getComputedStyle(el);
      if ((s.position === 'fixed' || s.position === 'absolute') &&
           parseInt(s.zIndex) > 100 &&
           el.offsetWidth > 500) {
        el.style.setProperty('display', 'none', 'important');
      }
    });

    // Reset body
    document.body.style.setProperty('overflow', 'auto', 'important');
    document.documentElement.style.setProperty('overflow', 'auto', 'important');
    document.body.style.background = '#fff';

    // Ukryj header/footer
    ['header', 'nav', 'footer', '[class*="navbar"]', '[class*="footer"]',
     '[class*="breadcrumb"]', '[class*="banner"]'].forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.style.setProperty('display', 'none', 'important');
      });
    });
  });

  await new Promise(r => setTimeout(r, 1000));

  const topY = await page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll('h2, h3'))
      .filter(el => el.textContent.includes('mecze') || el.textContent.includes('Mecze'));
    if (!headers.length) return 100;
    const rect = headers[0].getBoundingClientRect();
    return Math.max(0, rect.top + window.scrollY - 24);
  });

  console.log('Pozycja sekcji Y:', topY);

  await page.screenshot({
    path: IMG_FILE,
    clip: { x: 0, y: topY, width: 1200, height: 1050 },
  });

  await browser.close();

  fs.writeFileSync(META_FILE, JSON.stringify({ updatedAt: new Date().toISOString() }, null, 2));
  console.log(`✅ Screenshot: ${Math.round(fs.statSync(IMG_FILE).size / 1024)} KB`);
})();
