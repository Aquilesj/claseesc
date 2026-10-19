<?php
// =====================================================================
//  Intranet vulnerable del laboratorio de LOG POISONING (LFI -> RCE)
//  TODO en este archivo es DELIBERADAMENTE inseguro con fines docentes.
//  Entorno autorizado y desechable del curso.
// =====================================================================

$room = preg_replace('/[^a-z0-9_-]/i', '', $_GET['room'] ?? '');

// Registro de visitas por sala. Guardamos el User-Agent TAL CUAL (sin
// sanitizar): esa es, a propósito, la vía de "envenenamiento" del log.
if ($room !== '') {
    $dir = '/var/log/lab';
    @mkdir($dir, 0777, true);
    $ua  = $_SERVER['HTTP_USER_AGENT'] ?? '-';
    $uri = $_SERVER['REQUEST_URI'] ?? '-';
    @file_put_contents(
        "$dir/$room.log",
        date('c') . ' ' . ($_SERVER['REMOTE_ADDR'] ?? '-') . " \"$uri\" \"$ua\"\n",
        FILE_APPEND
    );
}
?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Intranet ACME — Lab Log Poisoning</title>
  <link rel="stylesheet" href="/assets/style.css">
</head>
<body>
<div class="lab-banner">
  ⚠️ Laboratorio educativo de seguridad web (Log Poisoning: LFI → RCE).
  Entorno autorizado y desechable del curso. No uses estas técnicas fuera de este laboratorio.
</div>

<?php if ($room === ''): ?>
  <!-- ---------- LOGIN ---------- -->
  <div class="wrap login">
    <div class="card">
      <h1>Intranet ACME</h1>
      <p class="muted">Escribe tu nombre para entrar a tu sala del laboratorio.</p>
      <form method="get" action="/">
        <input class="inp" name="room" placeholder="Tu nombre" autofocus required>
        <button class="btn" type="submit">Entrar</button>
      </form>
      <p class="muted small">Tu sala se deriva de tu nombre (ej. <code>Ana Pérez → anaperez</code>).</p>
    </div>
  </div>

<?php else: ?>
  <?php $r = htmlspecialchars($room, ENT_QUOTES); ?>
  <!-- ---------- INTRANET ---------- -->
  <div class="topbar">
    <div class="brand">Intranet ACME — <span class="muted">sala: <?= $r ?></span></div>
    <a class="btn ghost" href="/">Cerrar sesión</a>
  </div>

  <div class="layout">
    <!-- Guía del reto (se actualiza sola) -->
    <aside class="guia" id="guia"
           data-room="<?= $r ?>"
           data-logpath="/var/log/lab/<?= $r ?>.log">
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

    <!-- Visor de páginas de la intranet (el punto vulnerable) -->
    <main class="viewer">
      <nav class="nav">
        <a href="/?room=<?= $r ?>&page=pages/home.php">Inicio</a>
        <a href="/?room=<?= $r ?>&page=pages/about.php">Acerca de</a>
      </nav>
      <section class="content">
<?php
        // ===== LFI DELIBERADO =====
        // El visor incluye el archivo indicado por ?page= sin validarlo.
        $page = $_GET['page'] ?? null;
        if ($page === null) {
            include __DIR__ . '/pages/home.php';
        } else {
            include $page;   // <-- vulnerabilidad: Local File Inclusion
        }
?>
      </section>
    </main>
  </div>

  <script src="/guide.js"></script>
<?php endif; ?>
</body>
</html>
