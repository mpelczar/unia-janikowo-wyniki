const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const TEAM_ID = '9008b895-5ef0-44bf-a9d7-88578096f3ab';
const PLAY_ID = '0fb7f0c2-ddb3-4d29-a130-90412a4a2393';
const URL     = `https://www.laczynaspilka.pl/rozgrywki/druzyna/${TEAM_ID}?tab=tab-mecz&playDictionary=${PLAY_ID}`;

const OUTPUT_DIR  = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'matches.json');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

(async () => {
  console.log('Uruchamianie Puppeteer...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  let playedMatches   = null;
  let upcomingMatches = null;

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('played-matches')) {
      try { playedMatches = await response.json(); console.log('✓ played-matches'); }
      catch (e) { console.warn('Błąd:', e.message); }
    }
    if (url.includes('not-played-matches')) {
      try { upcomingMatches = await response.json(); console.log('✓ not-played-matches'); }
      catch (e) { console.warn('Błąd:', e.message); }
    }
  });

  console.log('Ładowanie strony PZPN...');
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));
  await browser.close();

  if (!playedMatches && !upcomingMatches) {
    console.error('Brak danych!');
    process.exit(1);
  }

  const normalize = (raw) => {
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : (raw.data || raw.matches || raw.items || []);
    return arr.map(m => ({
      date:      m.matchDate || m.date || m.scheduledDate || null,
      time:      m.matchTime || m.time || null,
      home:      m.homeTeam?.name  || m.home?.name  || '?',
      away:      m.awayTeam?.name  || m.away?.name  || '?',
      homeGoals: m.homeTeam?.score ?? m.homeScore ?? null,
      awayGoals: m.awayTeam?.score ?? m.awayScore ?? null,
    }));
  };

  const played   = normalize(playedMatches).sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
  const upcoming = normalize(upcomingMatches).sort((a,b) => new Date(a.date||0) - new Date(b.date||0));

  const output = { updatedAt: new Date().toISOString(), played, upcoming };
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(`✅ ${played.length} rozegranych, ${upcoming.length} planowanych`);
})();
