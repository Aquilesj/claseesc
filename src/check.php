<?php
// Valida la flag enviada por el alumno. La flag correcta se obtiene
// ejecutando el generador /usr/local/bin/getflag (que el alumno solo puede
// correr vía RCE). Aquí la recalculamos para comparar.
header('Content-Type: application/json');

$room = preg_replace('/[^a-z0-9_-]/i', '', $_GET['room'] ?? '');
$flag = trim($_GET['flag'] ?? '');

if ($room === '' || $flag === '') {
    echo json_encode(['ok' => false]);
    exit;
}

$expected = trim((string) shell_exec('/usr/local/bin/getflag ' . escapeshellarg($room)));
$ok = $expected !== '' && hash_equals($expected, $flag);

if ($ok) {
    @mkdir('/var/www/solved', 0775, true);
    @file_put_contents('/var/www/solved/' . $room, "1\n");
}

echo json_encode(['ok' => $ok]);
