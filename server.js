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

const roomFile = (r) => path.join(DATA, `${(r || '').replace(/[^a-z0-9_-]/gi, '')}.json`);

// Publicar comentario (SIN sanitizar: es la vulnerabilidad deliberada del lab).
app.post('/api/comments', (req, res) => {
  const { room, text } = req.body || {};
  if (!room || !text) return res.status(400).json({ error: 'room y text requeridos' });
  const f = roomFile(room);
  const list = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : [];
  list.push({ text, ts: Date.now() });
  fs.writeFileSync(f, JSON.stringify(list));
  res.json({ ok: true });
});

// Listar comentarios de una sala.
app.get('/api/comments', (req, res) => {
  const f = roomFile(req.query.room);
  res.json(fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : []);
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
  const room = (req.query.room || '').replace(/[^a-z0-9_-]/gi, '');
  const log = path.join(LOGS, 'collect.log');
  const lines = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n') : [];
  res
    .type('text/plain')
    .send(lines.filter((l) => l.includes(`"room":"${room}"`)).join('\n') || 'aun no hay botin');
});

// Front React compilado.
const dist = path.join(__dirname, 'dist');
app.use(express.static(dist));
// La SPA se sirve en /, /login y /board. Sin ?room= se muestra el login;
// con ?room= (o en /board) se muestra el muro de esa sala.
app.get(['/', '/login', '/board'], (req, res) => res.sendFile(path.join(dist, 'index.html')));

app.listen(PORT, () => console.log(`CTF XSS escuchando en :${PORT}`));
