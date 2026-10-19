const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const DATA = path.join(__dirname, 'data');
// En Docker el bot entra por http://localhost (mismo contenedor); en Codespaces, PORT=3000.
const BASE = process.env.BASE_URL || 'http://localhost';
// Si hay un Chromium del sistema (Docker/Codespaces) se usa su ruta; si no, el de Puppeteer.
const EXE = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

async function visitAll() {
  const rooms = fs.existsSync(DATA)
    ? fs
        .readdirSync(DATA)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace('.json', ''))
    : [];

  for (const room of rooms) {
    let browser;
    try {
      browser = await puppeteer.launch({
        executablePath: EXE,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      // El "admin" lleva la flag en su cookie (NO HttpOnly a propósito, para el laboratorio).
      await page.setCookie({
        name: 'flag',
        value: `FLAG{xss_stored_${room}}`,
        url: BASE,
        httpOnly: false
      });
      await page.goto(`${BASE}/board?room=${encodeURIComponent(room)}`, {
        waitUntil: 'networkidle2'
      });
      // Deja que la página renderice los comentarios (ahí corre el payload del alumno).
      await new Promise((r) => setTimeout(r, 2500));
    } catch (e) {
      console.error('bot: error en sala', room, '-', e.message);
    } finally {
      if (browser) await browser.close();
    }
  }
}

console.log('Bot admin iniciado. BASE =', BASE);
setInterval(() => visitAll().catch(console.error), 10000);
