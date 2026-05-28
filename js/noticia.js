/**
 * noticia.js — Renderizado dinámico de noticia individual
 * Clave Empresarial · 2026
 *
 * Lee el parámetro ?id= de la URL, busca la fila en Google Sheets
 * y rellena todos los elementos de noticia.html, incluyendo meta tags.
 */

(function () {
  'use strict';

  const OPENSHEET_URL = 'https://opensheet.elk.sh/1D4wNFDLuoMbuGtBWfW-PeTQPk-tOgQF8ezkVaFo71SY/NOTICIAS';
  const FALLBACK_IMG  = 'portada_mayo26.png';

  /* ── HELPERS ────────────────────────────────────────────── */

  /**
   * Formatea fecha a texto largo en español.
   * Ej: "jueves, 21 de mayo de 2026"
   */
  function formatFechaLarga(fechaStr) {
    if (!fechaStr) return '';
    try {
      const d = new Date(fechaStr.includes('T') ? fechaStr : fechaStr + 'T12:00:00');
      if (isNaN(d.getTime())) return fechaStr;
      return d.toLocaleDateString('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (_) {
      return fechaStr;
    }
  }

  /**
   * Establece o crea una etiqueta <meta> por nombre de propiedad o name.
   */
  function setMeta(atributo, valor, contenido) {
    if (!contenido) return;
    let el = document.querySelector(`meta[${atributo}="${valor}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(atributo, valor);
      document.head.appendChild(el);
    }
    el.setAttribute('content', contenido);
  }

  /**
   * Establece el contenido de un elemento por ID.
   */
  function setText(id, texto) {
    const el = document.getElementById(id);
    if (el) el.textContent = texto || '';
  }

  /* ── RELLENAR PÁGINA ────────────────────────────────────── */

  /**
   * Popula todos los elementos de noticia.html con los datos de la fila.
   */
  function rellenarNoticia(n) {
    const imgSrc = n.Imagen_URL && n.Imagen_URL.trim() ? n.Imagen_URL.trim() : FALLBACK_IMG;

    /* ── Imagen destacada ── */
    const imgEl = document.getElementById('noticia-imagen');
    if (imgEl) {
      imgEl.src = imgSrc;
      imgEl.alt = n.Titulo || 'Noticia';
      imgEl.onerror = function () {
        this.src = FALLBACK_IMG;
        this.onerror = null;
      };
    }

    /* ── Sección / categoría ── */
    setText('noticia-seccion', n.Seccion || 'Noticias');

    /* ── Título ── */
    setText('noticia-titulo', n.Titulo || '');

    /* ── Fecha ── */
    setText('noticia-fecha', formatFechaLarga(n.Fecha));

    /* ── Fuente ── */
    setText('noticia-fuente', n.Fuente || '');

    /* ── Resumen ── */
    setText('noticia-resumen', n.Resumen || '');

    /* ── Botón "Ver noticia original" ── */
    const btnOriginal = document.getElementById('noticia-btn-original');
    if (btnOriginal) {
      if (n.URL && n.URL.trim()) {
        btnOriginal.href = n.URL.trim();
        btnOriginal.style.display = 'inline-flex';
      } else {
        btnOriginal.style.display = 'none';
      }
    }

    /* ── Enlace "Volver" ── */
    const btnBack = document.getElementById('noticia-btn-back');
    if (btnBack) {
      // Regresar al referrer si es del mismo sitio, si no al index
      const ref = document.referrer;
      btnBack.href = (ref && ref.includes(location.hostname)) ? ref : 'index.html';
    }

    /* ── Título de la pestaña ── */
    document.title = `${n.Titulo || 'Noticia'} — Clave Empresarial`;

    /* ── Meta tags de SEO y redes sociales ── */
    const descripcion = n.Resumen || n.Titulo || '';
    const urlCanonica = window.location.href;

    // SEO básico
    setMeta('name', 'description', descripcion);

    // Open Graph (Facebook, WhatsApp, LinkedIn…)
    setMeta('property', 'og:type',        'article');
    setMeta('property', 'og:site_name',   'Clave Empresarial');
    setMeta('property', 'og:url',         urlCanonica);
    setMeta('property', 'og:title',       n.Titulo || '');
    setMeta('property', 'og:description', descripcion);
    setMeta('property', 'og:image',       imgSrc);
    setMeta('property', 'og:locale',      'es_MX');

    // Open Graph – datos del artículo
    if (n.Fecha) setMeta('property', 'article:published_time', n.Fecha);
    if (n.Seccion) setMeta('property', 'article:section', n.Seccion);

    // Twitter Cards
    setMeta('name', 'twitter:card',        'summary_large_image');
    setMeta('name', 'twitter:title',       n.Titulo || '');
    setMeta('name', 'twitter:description', descripcion);
    setMeta('name', 'twitter:image',       imgSrc);
  }

  /* ── ERROR ──────────────────────────────────────────────── */

  /**
   * Muestra un mensaje de error dentro del contenedor principal.
   */
  function mostrarError(msg) {
    const cont = document.getElementById('noticia-contenido');
    if (!cont) return;
    cont.innerHTML = `
      <div style="
        text-align:center;
        padding: 80px 24px;
        color: #B0B8C1;
        font-family: 'Lora', Georgia, serif;
      ">
        <p style="font-size:15px; line-height:1.6; margin-bottom:28px; opacity:.75;">${msg}</p>
        <a href="index.html" style="
          display: inline-block;
          background: #C9A84C;
          color: #0D1B2A;
          font-family: 'Lora', Georgia, serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: .14em;
          text-transform: uppercase;
          padding: 9px 24px;
          text-decoration: none;
        ">← Volver al inicio</a>
      </div>`;
  }

  /* ── FETCH ──────────────────────────────────────────────── */

  /**
   * Lee el parámetro ?id= de la URL, hace fetch al Sheet y rellena la página.
   */
  async function cargarNoticia() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id || !id.trim()) {
      mostrarError('No se especificó una noticia.');
      return;
    }

    try {
      const res = await fetch(OPENSHEET_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const datos = await res.json();

      // Buscar la fila cuyo ID coincide exactamente
      const noticia = datos.find(n => String(n.ID).trim() === String(id).trim());

      if (!noticia) {
        mostrarError('Esta noticia ya no está disponible o el enlace es incorrecto.');
        return;
      }

      rellenarNoticia(noticia);

    } catch (err) {
      console.error('[Clave Noticia] Error al cargar noticia:', err.message);
      mostrarError('No se pudo cargar la noticia. Intenta de nuevo más tarde.');
    }
  }

  /* ── INIT ───────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cargarNoticia);
  } else {
    cargarNoticia();
  }

})();
