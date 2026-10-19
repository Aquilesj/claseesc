// =====================================================================
//  Intranet ACME (Node/Express) — Lab de LOG POISONING -> RCE
//  Portal corporativo DELIBERADAMENTE vulnerable, con fines docentes.
//  Entorno autorizado y desechable del curso.
// =====================================================================
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 80;
const LOGDIR = '/var/log/lab';
const SOLVED = '/var/www/solved';
fs.mkdirSync(LOGDIR, { recursive: true });
fs.mkdirSync(SOLVED, { recursive: true });

app.set('trust proxy', true);

const clean = (r) => (r || '').replace(/[^a-z0-9_-]/gi, '');
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// --- Log de accesos combinado (TODA petición, incluidos 404). Material para
//     el equipo azul: ráfagas de 404, rutas con ../, User-Agent raro, cmd=. ---
app.use((req, res, next) => {
  res.on('finish', () => {
    const ua = (req.headers['user-agent'] || '-').replace(/[\r\n]/g, ' ');
    const line = `${req.ip} - - [${new Date().toISOString()}] "${req.method} ${req.originalUrl}" ${res.statusCode} "${ua}"\n`;
    try {
      fs.appendFileSync(path.join(LOGDIR, 'access.log'), line);
    } catch (e) {
      /* ignore */
    }
  });
  next();
});

// --- Log por sala: guarda el User-Agent TAL CUAL (vía de "envenenamiento"). ---
function logVisit(req, room) {
  if (!room) return;
  const ua = req.headers['user-agent'] || '-';
  const line = `${new Date().toISOString()} ${req.ip} "${req.originalUrl}" "${ua}"\n`;
  try {
    fs.appendFileSync(path.join(LOGDIR, `${room}.log`), line);
  } catch (e) {
    /* ignore */
  }
}

// --- Motor de plantillas casero DELIBERADAMENTE inseguro: evalúa cada ${...}
//     como JavaScript del lado del servidor (SSTI). ---
function render(content, cmd) {
  return content.replace(/\$\{([^}]*)\}/g, (m, expr) => {
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('cmd', 'require', 'process', 'return (' + expr + ');');
      return String(fn(cmd, require, process));
    } catch (e) {
      return '[err:' + e.message + ']';
    }
  });
}

// ---------- plantillas de la UI (se ven como una web real) ----------
const NAV = [
  ['Inicio', 'pages/inicio.tmpl'],
  ['Comunicados', 'pages/comunicados.tmpl'],
  ['Directorio', 'pages/directorio.tmpl'],
  ['Soporte TI', 'pages/soporte.tmpl'],
  ['Acerca de', 'pages/acerca.tmpl']
];

function shell(inner, extraHead = '') {
  return `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ACME S.A. — Intranet corporativa</title>
<link rel="stylesheet" href="/style.css">${extraHead}</head><body>${inner}</body></html>`;
}

function loginHtml() {
  return shell(`
  <div class="auth">
    <div class="auth-card">
      <div class="logo">▰ ACME <span>S.A.</span></div>
      <h1>Portal de empleados</h1>
      <p class="muted">Acceso restringido a personal autorizado. Ingresa tu usuario corporativo.</p>
      <form method="get" action="/">
        <input class="inp" name="room" placeholder="usuario (ej. tu nombre)" autofocus required>
        <button class="btn" type="submit">Ingresar</button>
      </form>
      <p class="muted small">¿Problemas para acceder? Escribe a soporte@acme.local</p>
    </div>
    <div class="auth-foot">© ACME S.A. · Uso interno</div>
  </div>`);
}

function intranetHtml(room, bodyHtml, activePage) {
  const r = esc(room);
  const nav = NAV.map(
    ([label, file]) =>
      `<a class="${activePage === file ? 'active' : ''}" href="/?room=${r}&page=${file}">${label}</a>`
  ).join('');
  return shell(`
  <header class="site-head">
    <div class="bar">
      <div class="logo">▰ ACME <span>S.A.</span></div>
      <nav class="nav">${nav}</nav>
      <div class="user">👤 ${r} · <a href="/">salir</a></div>
    </div>
  </header>
  <main class="site-main">${bodyHtml}</main>
  <footer class="site-foot">
    <div>ACME S.A. · Intranet corporativa · Mesa de ayuda ext. 4040</div>
    <div class="muted small">Sistema interno — prohibida su divulgación.</div>
  </footer>

  <button class="mission-btn" id="missionBtn" title="Guía del reto">🎯<span>Misión CTF</span></button>
  <aside class="drawer" id="guia" data-room="${r}" data-logpath="/var/log/lab/${r}.log" hidden>
    <div class="drawer-head">
      <div><strong>Misión CTF</strong> <span class="prog" id="prog">0/6</span></div>
      <button class="x" id="closeGuia" title="Cerrar">✕</button>
    </div>
    <div class="drawer-intro">
      Esta es una intranet real y vulnerable. <b>Explórala</b>: navega el menú, mira la URL y
      descubre cómo funciona. La guía te orienta, pero el trabajo de investigación es tuyo.
    </div>
    <div class="exito" id="exito" hidden>🎉 ¡Flag válida! Misión completada.</div>
    <ol class="etapas" id="etapas"></ol>
    <div class="flagbox">
      <label for="flagInput">Enviar flag</label>
      <input class="inp" id="flagInput" placeholder="pega aquí tu flag">
      <button class="btn" id="flagBtn" type="button">Validar</button>
      <p class="flagmsg" id="flagMsg"></p>
    </div>
  </aside>
  <script src="/guide.js"></script>`);
}

// ---------- sitio + visor vulnerable ----------
app.get(['/', '/board'], (req, res) => {
  const room = clean(req.query.room);
  logVisit(req, room);
  if (!room) return res.send(loginHtml());

  const p = req.query.page;
  const raw = req.query.raw === '1';
  const isSitePage = typeof p === 'string' && p.startsWith('pages/');
  let bodyHtml;

  try {
    const file = p === undefined ? path.join(__dirname, 'pages', 'inicio.tmpl') : p;
    const content = fs.readFileSync(file, 'utf8'); // LFI deliberado
    if (raw) {
      // Lectura CRUDA: muestra el archivo sin evaluar (para inspeccionar/enumerar).
      bodyHtml = `<div class="doc"><div class="doc-bar">📄 ${esc(p)} <span class="muted">(lectura cruda)</span></div><pre class="dump">${esc(content)}</pre></div>`;
    } else if (p === undefined || isSitePage) {
      // Página propia del sitio: se renderiza como HTML (SSTI en ${...}).
      bodyHtml = render(content, req.query.cmd || '');
    } else {
      // Archivo ajeno renderizado (p. ej. un log): salida en texto.
      bodyHtml = `<div class="doc"><div class="doc-bar">📄 ${esc(p)} <span class="muted">(render)</span></div><pre class="dump">${esc(render(content, req.query.cmd || ''))}</pre></div>`;
    }
  } catch (e) {
    bodyHtml = `<div class="doc"><pre class="dump">[no se pudo abrir el documento: ${esc(e.message)}]</pre></div>`;
  }
  res.send(intranetHtml(room, bodyHtml, isSitePage ? p : ''));
});

// Progreso del reto (lee el log de la sala; NO lo renderiza).
app.get('/status', (req, res) => {
  const room = clean(req.query.room);
  let log = '';
  try {
    log = fs.readFileSync(path.join(LOGDIR, `${room}.log`), 'utf8');
  } catch (e) {
    /* sin log aún */
  }
  res.json({
    visited: log !== '',
    lfi: /page=[^ "&]*(passwd|\/etc\/|\.\.|\/var\/|\.env|server\.js)/i.test(log),
    logIncluded: /page=[^ "&]*\.log/i.test(log),
    poisoned: log.includes('${'),
    rce: /\.log[^ "]*cmd=/i.test(log),
    solved: room !== '' && fs.existsSync(path.join(SOLVED, room))
  });
});

// Validación de la flag (solo obtenible ejecutando getflag vía RCE).
app.get('/check', (req, res) => {
  const room = clean(req.query.room);
  const flag = (req.query.flag || '').trim();
  if (!room || !flag) return res.json({ ok: false });
  let expected = '';
  try {
    expected = require('child_process').execSync('/usr/local/bin/getflag ' + room).toString().trim();
  } catch (e) {
    /* ignore */
  }
  const ok = expected !== '' && expected === flag;
  if (ok) {
    try {
      fs.writeFileSync(path.join(SOLVED, room), '1\n');
    } catch (e) {
      /* ignore */
    }
  }
  res.json({ ok });
});

app.use(express.static(path.join(__dirname, 'public')));

// 404 real (genera ráfagas de 404 en el access.log durante el fuzzing).
app.use((req, res) => {
  res
    .status(404)
    .send(shell('<main class="site-main"><div class="doc"><h1>404</h1><p>Página no encontrada en la intranet ACME.</p></div></main>'));
});

app.listen(PORT, () => console.log(`Intranet ACME (lab log poisoning) en :${PORT}`));
