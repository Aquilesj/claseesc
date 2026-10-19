<?php
// Progreso del reto, calculado leyendo el log de la sala (NO lo incluye:
// usa file_get_contents, así que no ejecuta el PHP envenenado). Lo consume
// guide.js por polling.
header('Content-Type: application/json');

$room = preg_replace('/[^a-z0-9_-]/i', '', $_GET['room'] ?? '');
$log  = $room !== '' ? (@file_get_contents("/var/log/lab/$room.log") ?: '') : '';

// Milestones detectados desde las peticiones registradas (REQUEST_URI) y el
// contenido del log (User-Agent envenenado).
$lfi      = (bool) preg_match('#page=[^ "&]*(passwd|/etc/|\.\.|/var/)#i', $log);
$logInc   = (bool) preg_match('#page=[^ "&]*\.log#i', $log);
$rce      = (bool) preg_match('#\.log[^ "]*cmd=#i', $log);
$poisoned = strpos($log, '<?php') !== false;
$solved   = $room !== '' && is_file('/var/www/solved/' . $room);

echo json_encode([
    'visited'     => $log !== '',
    'lfi'         => $lfi,
    'logIncluded' => $logInc,
    'poisoned'    => $poisoned,
    'rce'         => $rce,
    'solved'      => $solved,
]);
