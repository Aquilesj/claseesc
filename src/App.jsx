import React, { useEffect, useState } from 'react';

// La sala se toma de ?room= en la URL. Por defecto, "general".
function getRoom() {
  const p = new URLSearchParams(window.location.search);
  const r = (p.get('room') || 'general').trim();
  return r || 'general';
}

export default function App() {
  const room = getRoom();
  const [text, setText] = useState('');
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/comments?room=${encodeURIComponent(room)}`);
      setComments(await res.json());
    } catch (e) {
      /* sin conexión: dejamos la lista como está */
    }
  }

  useEffect(() => {
    load();
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

  return (
    <div className="wrap">
      <div className="lab-banner">
        ⚠️ Laboratorio educativo de seguridad web (XSS almacenado). Entorno autorizado y
        desechable del curso. No uses estas técnicas fuera de este laboratorio.
      </div>

      <h1>Muro de Comentarios — Sala: {room}</h1>
      <p className="hint">
        Estás en la sala <strong>{room}</strong>. Para cambiar de sala, añade{' '}
        <code>?room=TU_NOMBRE</code> al final de la URL.
      </p>

      <textarea
        className="caja"
        placeholder="Escribe tu comentario aquí..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
      />
      <div>
        <button className="btn-azul" onClick={publicar} disabled={loading}>
          Publicar comentario
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
