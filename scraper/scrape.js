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
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );

  let playedMatches   = null;
  let upcomingMatches = null;

  page.on('response', async (response) => {
    const url = response.url();
    try {
      if (url.includes('played-matches') && !url.includes('not-played')) {
        const json = await response.json();
        playedMatches = json;
        console.log('✓ played-matches, rozmiar:', JSON.stringify(json).length);
      }
      if (url.includes('not-played-matches')) {
        const json = await response.json();
        upcomingMatches = json;
        console.log('✓ not-played-matches, rozmiar:', JSON.stringify(json).length);
      }
    } catch (e) {}
  });

  console.log('Ładowanie strony PZPN...');
  try {
    await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
  } catch (e) {
    console.log('Timeout goto:', e.message);
  }

  console.log('Czekam na dane API...');
  const start = Date.now();
  while ((!playedMatches || !upcomingMatches) && Date.now() - start < 30000) {
    await new Promise(r => setTimeout(r, 1000));
    process.stdout.write('.');
  }
  console.log('');

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
  console.log(`✅ Zapisano: ${played.length} rozegranych, ${upcoming.length} planowanych`);
})();
