// =====================================================================
//  Intranet vulnerable (Node/Express) — Lab de LOG POISONING -> RCE
//  TODO aquí es DELIBERADAMENTE inseguro, con fines docentes.
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

// Registra cada visita por sala. Guarda el User-Agent TAL CUAL (sin sanitizar):
// esa es, a propósito, la vía de "envenenamiento" del log.
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

// Motor de plantillas casero DELIBERADAMENTE inseguro: evalúa cada ${...}
// como JavaScript del lado del servidor (SSTI). Es lo que convierte el log
// envenenado en ejecución de código.
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

function shell(room, inner) {
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Intranet ACME — Lab Log Poisoning</title>
<link rel="stylesheet" href="/style.css"></head><body>
<div class="lab-banner">⚠️ Laboratorio educativo de seguridad web (Log Poisoning → RCE).
Entorno autorizado y desechable del curso. No uses estas técnicas fuera de este laboratorio.</div>
${inner}
</body></html>`;
}

function loginHtml() {
  return shell('', `
  <div class="wrap login"><div class="card">
    <h1>Intranet ACME</h1>
    <p class="muted">Escribe tu nombre para entrar a tu sala del laboratorio.</p>
    <form method="get" action="/">
      <input class="inp" name="room" placeholder="Tu nombre" autofocus required>
      <button class="btn" type="submit">Entrar</button>
    </form>
    <p class="muted small">Tu sala se deriva de tu nombre (ej. <code>Ana Pérez → anaperez</code>).</p>
  </div></div>`);
}

function intranetHtml(room, out) {
  const r = esc(room);
  return shell(room, `
  <div class="topbar">
    <div class="brand">Intranet ACME — <span class="muted">sala: ${r}</span></div>
    <a class="btn ghost" href="/">Cerrar sesión</a>
  </div>
  <div class="layout">
    <aside class="guia" id="guia" data-room="${r}" data-logpath="/var/log/lab/${r}.log">
      <h2>Reto guiado <span class="prog" id="prog">0/6</span></h2>
      <div class="exito" id="exito" hidden>🎉 ¡Flag válida! Reto completado.</div>
      <ol class="etapas" id="etapas"></ol>
      <div class="flagbox">
        <label for="flagInput">Envía tu flag</label>
        <input class="inp" id="flagInput" placeholder="FLAG{...}">
        <button class="btn" id="flagBtn" type="button">Validar</button>
        <p class="flagmsg" id="flagMsg"></p>
      </div>
    </aside>
    <main class="viewer">
      <nav class="nav">
        <a href="/?room=${r}&page=pages/home.tmpl">Inicio</a>
        <a href="/?room=${r}&page=pages/about.tmpl">Acerca de</a>
      </nav>
      <section class="content"><pre class="salida">${esc(out)}</pre></section>
    </main>
  </div>
  <script src="/guide.js"></script>`);
}

// Página principal + visor vulnerable.
app.get(['/', '/board'], (req, res) => {
  const room = clean(req.query.room);
  logVisit(req, room);
  if (!room) return res.send(loginHtml());

  let out;
  try {
    const p = req.query.page;
    // ===== LECTURA ARBITRARIA DE ARCHIVOS (LFI/path traversal) =====
    const file = p === undefined ? path.join(__dirname, 'pages', 'home.tmpl') : p;
    const content = fs.readFileSync(file, 'utf8');
    // ===== RENDER INSEGURO (SSTI): evalúa ${...} =====
    out = render(content, req.query.cmd || '');
  } catch (e) {
    out = '[no se pudo leer el archivo: ' + e.message + ']';
  }
  res.send(intranetHtml(room, out));
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
    lfi: /page=[^ "&]*(passwd|\/etc\/|\.\.|\/var\/)/i.test(log),
    logIncluded: /page=[^ "&]*\.log/i.test(log),
    poisoned: log.includes('${'),
    rce: /\.log[^ "]*cmd=/i.test(log),
    solved: room !== '' && fs.existsSync(path.join(SOLVED, room))
  });
});

// Validación de la flag (se obtiene ejecutando getflag, solo posible vía RCE).
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
app.listen(PORT, () => console.log(`Intranet ACME (lab log poisoning) en :${PORT}`));
