const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.set('trust proxy', true);

// Puerto: 80 en Docker; en Codespaces se usa PORT=3000 (ver .devcontainer).
const PORT = process.env.PORT || 80;

const DATA = path.join(__dirname, 'data');
const LOGS = path.join(__dirname, 'logs');
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(LOGS, { recursive: true });

// Log de accesos (puente con el equipo azul: User-Agent + query de cada petición).
app.use((req, res, next) => {
  const ua = (req.headers['user-agent'] || '-').replace(/[\r\n]/g, ' ');
  fs.appendFileSync(
    path.join(LOGS, 'access.log'),
    `${req.ip} - [${new Date().toISOString()}] "${req.method} ${req.originalUrl}" "${ua}"\n`
  );
  next();
});

const clean = (r) => (r || '').replace(/[^a-z0-9_-]/gi, '');
const roomFile = (r) => path.join(DATA, `${clean(r)}.json`);
const readComments = (r) => {
  const f = roomFile(r);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : [];
};
const readLines = (f) =>
  fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean) : [];

// Publicar comentario (SIN sanitizar: es la vulnerabilidad deliberada del lab).
app.post('/api/comments', (req, res) => {
  const { room, text } = req.body || {};
  if (!room || !text) return res.status(400).json({ error: 'room y text requeridos' });
  const list = readComments(room);
  list.push({ text, ts: Date.now() });
  fs.writeFileSync(roomFile(room), JSON.stringify(list));
  res.json({ ok: true });
});

// Listar comentarios de una sala.
app.get('/api/comments', (req, res) => {
  res.json(readComments(req.query.room));
});

// Beacon: demuestra EJECUCIÓN de JS sin robar nada (etapa 4 de la guía).
app.get('/beacon', (req, res) => {
  fs.appendFileSync(
    path.join(LOGS, 'beacon.log'),
    `${new Date().toISOString()} ${JSON.stringify(req.query)}\n`
  );
  res.type('gif').send(Buffer.from('R0lGODlhAQABAAAAACw=', 'base64'));
});

// Buzón de exfiltración del lab: registra la query completa y responde un pixel 1x1.
app.get('/collect', (req, res) => {
  fs.appendFileSync(
    path.join(LOGS, 'collect.log'),
    `${new Date().toISOString()} ${JSON.stringify(req.query)}\n`
  );
  res.type('gif').send(Buffer.from('R0lGODlhAQABAAAAACw=', 'base64'));
});

// Botín por sala: muestra en texto lo que llegó a /collect para esa sala.
app.get('/loot', (req, res) => {
  const room = clean(req.query.room);
  const lines = readLines(path.join(LOGS, 'collect.log'));
  res
    .type('text/plain')
    .send(lines.filter((l) => l.includes(`"room":"${room}"`)).join('\n') || 'aun no hay botin');
});

// Estado del progreso de la guía interactiva (lo consume la UI por polling).
app.get('/status', (req, res) => {
  const room = clean(req.query.room);
  const texts = readComments(room).map((c) => c.text || '');
  const inRoom = (l) => l.includes(`"room":"${room}"`);
  const beacon = readLines(path.join(LOGS, 'beacon.log')).filter(inRoom);
  const collect = readLines(path.join(LOGS, 'collect.log')).filter(inRoom);
  const cookieHits = collect.filter((l) => /"c":"[^"]+"/.test(l));
  const flagMatch = collect.map((l) => l.match(/FLAG\{[^}]*\}/)).find(Boolean);

  res.json({
    hasComments: texts.length > 0,
    htmlInjected: texts.some((t) => /<\/?[a-z][^>]*>/i.test(t)),
    scriptTried: texts.some((t) => /<script/i.test(t)),
    eventHandlerUsed: texts.some((t) => /on[a-z]+\s*=/i.test(t)),
    jsExecuted: beacon.length > 0 || collect.length > 0,
    cookieCaptured: cookieHits.length > 0,
    flagCaptured: !!flagMatch,
    flag: flagMatch ? flagMatch[0] : ''
  });
});

// Front React. Al servir la página dejamos una cookie de invitado (NO HttpOnly)
// para que en la etapa 5 el alumno capture "una" cookie... pero sin la flag.
function servePage(req, res) {
  res.cookie('session', 'invitado', { httpOnly: false, sameSite: 'lax' });
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
}

// Las rutas de página van ANTES del static para poder fijar la cookie.
app.get(['/', '/login', '/board'], servePage);
app.use(express.static(path.join(__dirname, 'dist'), { index: false }));

app.listen(PORT, () => console.log(`CTF XSS escuchando en :${PORT}`));
