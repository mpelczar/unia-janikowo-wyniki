const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const TEAM_ID = '9008b895-5ef0-44bf-a9d7-88578096f3ab';
const PLAY_ID = '0fb7f0c2-ddb3-4d29-a130-90412a4a2393';
const PAGE_URL = `https://www.laczynaspilka.pl/rozgrywki/druzyna/${TEAM_ID}?tab=tab-mecz&playDictionary=${PLAY_ID}`;
const API_BASE = 'https://competition-api-pro.laczynaspilka.pl/api/bus/competition/v1/teams';
const PLAYED_URL   = `${API_BASE}/${TEAM_ID}/plays/${PLAY_ID}/played-matches`;
const UPCOMING_URL = `${API_BASE}/${TEAM_ID}/plays/${PLAY_ID}/not-played-matches`;

const OUTPUT_DIR  = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'matches.json');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

(async () => {
  console.log('Uruchamianie Puppeteer...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

  console.log('Ładowanie strony PZPN...');
  try {
    await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (e) {
    console.log('Strona załadowana częściowo, kontynuuję...');
  }

  await new Promise(r => setTimeout(r, 3000));
  console.log('Odpytuję API z przeglądarki...');

  const results = await page.evaluate(async (playedUrl, upcomingUrl) => {
    const fetchJson = async (url) => {
      try {
        const r = await fetch(url, { method: 'GET', credentials: 'omit', headers: { 'Accept': 'application/json' } });
        if (!r.ok) return { error: `HTTP ${r.status}` };
        return await r.json();
      } catch (e) {
        return { error: e.message };
      }
    };
    const [played, upcoming] = await Promise.all([fetchJson(playedUrl), fetchJson(upcomingUrl)]);
    return { played, upcoming };
  }, PLAYED_URL, UPCOMING_URL);

  await browser.close();

  console.log('played:', JSON.stringify(results.played).substring(0, 300));
  console.log('upcoming:', JSON.stringify(results.upcoming).substring(0, 300));

  if (results.played?.error && results.upcoming?.error) {
    console.error('Błąd API:', results.played.error, results.upcoming.error);
    process.exit(1);
  }

  const normalize = (raw) => {
    if (!raw || raw.error) return [];
    const arr = Array.isArray(raw) ? raw : (raw.data || raw.matches || raw.items || []);
    return arr.map(m => ({
      date:      m.matchDate || m.date || m.scheduledDate || null,
      time:      m.matchTime || m.time || null,
      home:      m.homeTeam?.name || m.home?.name || '?',
      away:      m.awayTeam?.name || m.away?.name || '?',
      homeGoals: m.homeTeam?.score ?? m.homeScore ?? null,
      awayGoals: m.awayTeam?.score ?? m.awayScore ?? null,
    }));
  };

  const played   = normalize(results.played).sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
  const upcoming = normalize(results.upcoming).sort((a,b) => new Date(a.date||0) - new Date(b.date||0));

  const output = { updatedAt: new Date().toISOString(), played, upcoming };
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(`✅ Zapisano: ${played.length} rozegranych, ${upcoming.length} planowanych`);
})();
