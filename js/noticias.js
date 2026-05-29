/**
 * noticias.js — Sistema de noticias dinámicas desde Google Sheets
 * Clave Empresarial · 2026
 *
 * Fuente: opensheet.elk.sh (wrapper sin auth sobre Google Sheets)
 * Columnas: ID, Titulo, Seccion, Resumen, URL, Imagen_URL, Fecha, Fuente, Prioridad, Activa, Slug
 *
 * Flujo:
 *   1. Fetch → filtra Activa=TRUE → ordena por Prioridad desc
 *   2. Hero        → [data-noticia-hero]   (noticia de mayor prioridad global)
 *   3. Por sección → [data-seccion="X"]    (hasta 5 noticias por sección)
 *   4. Día         → [data-noticias-grid]  (12 más prioritarias, sin repetir hero)
 *   5. Recarga automática cada 5 minutos
 */

(function () {
  'use strict';

  /* ── CONFIGURACIÓN ──────────────────────────────────────────── */
  const OPENSHEET_URL = 'https://opensheet.elk.sh/1D4wNFDLuoMbuGtBWfW-PeTQPk-tOgQF8ezkVaFo71SY/NOTICIAS';
  const FALLBACK_IMG  = 'portada_mayo26.png';
  const MAX_POR_SEC   = 3;          // noticias máx por sección
  const MAX_DIA       = 12;         // tarjetas en "Noticias del Día"
  const RELOAD_MS     = 5 * 60 * 1000; // recarga cada 5 minutos

  /* ── SECCIONES VÁLIDAS (deben coincidir con columna Seccion del Sheet) ── */
  const SECCIONES = [
    'Empresarial', 'Economía', 'Tecnología', 'Movilidad',
    'Real Estate', 'Turismo', 'Líderes', 'Cúpulas', 'Salud y Cultura'
  ];

  /* ── ESTILOS DE TARJETAS ──────────────────────────────────── */
  const CSS = `
    /* Noticias del Día — grid de tarjetas */
    .nc-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
    }
    .nc-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(201,168,76,0.15);
      overflow: hidden;
      transition: border-color .25s, transform .25s;
    }
    .nc-card:hover { border-color: rgba(201,168,76,0.5); transform: translateY(-4px); }
    .nc-card-link { display:flex; flex-direction:column; height:100%; text-decoration:none; color:inherit; }
    .nc-card-img  { width:100%; height:185px; overflow:hidden; flex-shrink:0;
                    background:linear-gradient(135deg,#142030 0%,#0c1824 100%); }
    .nc-card-img img { width:100%; height:100%; object-fit:cover; display:block; transition:transform .5s; }
    .nc-card:hover .nc-card-img img { transform:scale(1.06); }
    .nc-card-body { padding:18px 16px 16px; display:flex; flex-direction:column; flex:1; }
    .nc-tag {
      display:inline-block; font-family:var(--ff-body,'Lora',Georgia,serif);
      font-size:9.5px; font-weight:600; letter-spacing:.13em; text-transform:uppercase;
      color:var(--gold,#C9A84C); border:1px solid rgba(201,168,76,0.28);
      padding:2px 8px; margin-bottom:10px; align-self:flex-start;
    }
    .nc-titulo {
      font-family:var(--ff-head,'Playfair Display',Georgia,serif);
      font-size:15px; font-weight:700; line-height:1.32; color:#fff;
      margin-bottom:9px; display:-webkit-box; -webkit-line-clamp:3;
      -webkit-box-orient:vertical; overflow:hidden; transition:color .2s;
    }
    .nc-card:hover .nc-titulo { color:var(--gold,#C9A84C); }
    .nc-resumen {
      font-family:var(--ff-body,'Lora',Georgia,serif); font-size:12.5px;
      color:#B0B8C1; line-height:1.58; display:-webkit-box; -webkit-line-clamp:3;
      -webkit-box-orient:vertical; overflow:hidden; flex:1; margin-bottom:14px;
    }
    .nc-meta {
      display:flex; align-items:center; justify-content:space-between; gap:8px;
      font-size:10.5px; color:#B0B8C1;
      border-top:1px solid rgba(176,184,193,0.1); padding-top:10px;
    }
    .nc-fecha { opacity:.65; }
    .nc-fuente {
      font-weight:600; letter-spacing:.03em; color:rgba(201,168,76,0.75);
      max-width:55%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
    }

    /* Miniaturas en stories laterales de cada sección */
    .story-side-thumb { width:100%; height:72px; overflow:hidden; margin-bottom:8px; }
    .story-side-thumb img { width:100%; height:100%; object-fit:cover; display:block; transition:transform .4s; }
    .story-side:hover .story-side-thumb img { transform:scale(1.06); }

    /* Estados de carga y vacío */
    .nc-estado {
      grid-column:1/-1; text-align:center; padding:48px 20px;
      font-family:var(--ff-body,'Lora',Georgia,serif); font-size:13px;
      color:#B0B8C1; opacity:.55;
    }
    .nc-estado-spinner {
      width:28px; height:28px; border:2px solid rgba(201,168,76,0.2);
      border-top-color:rgba(201,168,76,0.7); border-radius:50%;
      animation:nc-spin .8s linear infinite; margin:0 auto 14px;
    }
    .sec-vacio {
      grid-column:1/-1; text-align:center; padding:24px 0;
      font-family:var(--ff-body,'Lora',Georgia,serif);
      font-size:13px; color:#B0B8C1; opacity:.35;
    }
    @keyframes nc-spin { to { transform:rotate(360deg); } }

    /* ── Carrusel Ediciones Digitales ── */
    .edi-wrap {
      position: relative;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .edi-track {
      display: flex;
      gap: 16px;
      overflow-x: auto;
      scroll-behavior: smooth;
      scrollbar-width: none;
      padding: 8px 4px 16px;
      flex: 1;
      -webkit-overflow-scrolling: touch;
    }
    .edi-track::-webkit-scrollbar { display: none; }
    .edi-card {
      flex-shrink: 0;
      display: block;
      width: 140px;
      aspect-ratio: 70 / 100;
      overflow: hidden;
      border: 1px solid rgba(201,168,76,0.2);
      transition: border-color .25s, transform .25s, box-shadow .25s;
      background: #0c1824;
    }
    .edi-card:hover {
      border-color: rgba(201,168,76,0.6);
      transform: translateY(-5px);
      box-shadow: 0 14px 32px rgba(0,0,0,0.55);
    }
    .edi-card img { width:100%; height:100%; object-fit:cover; display:block; }
    .edi-btn {
      flex-shrink: 0;
      background: rgba(13,27,42,0.92);
      border: 1px solid rgba(201,168,76,0.3);
      color: var(--gold,#C9A84C);
      font-size: 30px;
      line-height: 1;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      opacity: 0;
      pointer-events: none;
      transition: opacity .3s, background .2s;
    }
    .edi-btn.visible { opacity: 1; pointer-events: auto; }
    .edi-btn:hover { background: rgba(201,168,76,0.14); }

    /* ── Sponsors sidebar ── */
    #sidebar-sponsors { margin-top: 32px; }
    .spons-label {
      font-family: var(--ff-body,'Lora',Georgia,serif);
      font-size: 9px; font-weight: 600; letter-spacing: .22em;
      text-transform: uppercase; color: rgba(176,184,193,0.45);
      margin-bottom: 12px;
    }
    .spons-img {
      display: block; width: 100%; height: auto;
      margin-bottom: 12px; opacity: .85;
      transition: opacity .25s;
    }
    .spons-img:hover { opacity: 1; }
    .spons-img:last-child { margin-bottom: 0; }

    /* Responsive */
    @media (max-width:1024px) { .nc-grid { grid-template-columns:repeat(2,1fr); } }
    @media (max-width:768px)  {
      .nc-grid { grid-template-columns:1fr; }
      .nc-card-img { height:200px; }
      .edi-card { width:120px; }
      /* Asegurar padding en tarjetas noticias del día */
      .nc-card-body { padding:14px 12px 12px; }
    }
  `;

  /* Inyectar estilos una sola vez */
  if (!document.getElementById('nc-styles')) {
    const s = document.createElement('style');
    s.id = 'nc-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ── HELPERS ─────────────────────────────────────────────── */

  /** Fecha ISO o YYYY-MM-DD → texto legible en español */
  function formatFecha(f) {
    if (!f) return '';
    try {
      const d = new Date(f.includes('T') ? f : f + 'T12:00:00');
      return isNaN(d.getTime()) ? f
        : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (_) { return f; }
  }

  /** Escapa caracteres peligrosos para atributos HTML */
  function esc(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  }

  /** Trunca texto a N caracteres con "…" — para previews en tarjetas del index */
  function truncar(s, n) {
    if (!s) return '';
    s = s.trim();
    return s.length <= n ? s : s.slice(0, n).trimEnd() + '…';
  }

  /** Genera <img> con fallback automático si la URL falla */
  function imgTag(url, alt) {
    const src = esc(url || FALLBACK_IMG);
    return `<img src="${src}" alt="${esc(alt)}" loading="lazy"
                 onerror="this.src='${FALLBACK_IMG}';this.onerror=null;">`;
  }

  /* ── RENDER HERO ─────────────────────────────────────────── */

  /** Rellena el bloque [data-noticia-hero] con la noticia de mayor prioridad */
  function renderHero(n) {
    const el = document.querySelector('[data-noticia-hero]');
    if (!el || !n) return;
    const href = `noticia.html?id=${encodeURIComponent(n.ID)}`;
    el.innerHTML = `
      <div class="hero-img">
        ${imgTag(n.Imagen_URL, n.Titulo)}
        <a href="${href}" class="hero-overlay" style="display:block;">
          <span class="tag">${esc(n.Seccion || 'Negocios')}</span>
          <h1>${n.Titulo || ''}</h1>
          <div class="hero-meta">
            <span class="author">${esc(n.Fuente || 'Redacción Clave')}</span>
            <span class="dot">·</span>
            <span>${formatFecha(n.Fecha)}</span>
          </div>
        </a>
      </div>`;
  }

  /* ── RENDER SECCIÓN ──────────────────────────────────────── */

  /**
   * Rellena [data-seccion="X"] con hasta 5 noticias de esa sección.
   * Layout: 1 story-main (imagen grande) + 2 columnas de 2 story-side (con miniatura).
   */
  function renderSeccion(seccion, noticias) {
    const el = document.querySelector('[data-seccion="' + seccion + '"]');
    if (!el) return;

    if (!noticias || noticias.length === 0) {
      // Ocultar la sección completa y su separador decorativo
      const section = el.closest('.section-block');
      if (section) {
        section.style.display = 'none';
        const next = section.nextElementSibling;
        const prev = section.previousElementSibling;
        if (next && next.classList.contains('section-sep')) next.style.display = 'none';
        else if (prev && prev.classList.contains('section-sep')) prev.style.display = 'none';
      }
      return;
    }

    // Columnas dinámicas: exactamente tantas como noticias reales (max 3)
    const count = noticias.length;
    el.style.gridTemplateColumns = count === 1 ? '1fr'
                                 : count === 2 ? '1.6fr 1fr'
                                 : '1.6fr 1fr 1fr';

    function mainCard(n) {
      const href = `noticia.html?id=${encodeURIComponent(n.ID)}`;
      return `
        <article class="story-main">
          <div class="story-main-img">
            <a href="${href}">${imgTag(n.Imagen_URL, n.Titulo)}</a>
          </div>
          <span class="tag">${esc(n.Seccion || seccion)}</span>
          <h3><a href="${href}">${n.Titulo || ''}</a></h3>
          <div class="meta">${formatFecha(n.Fecha)}</div>
          <a href="${href}" class="ver-mas">Ver más</a>
        </article>`;
    }

    function sideCard(n) {
      const href = `noticia.html?id=${encodeURIComponent(n.ID)}`;
      return `
        <article class="story-side">
          <div class="story-side-thumb">
            <a href="${href}">${imgTag(n.Imagen_URL, n.Titulo)}</a>
          </div>
          <span class="tag">${esc(n.Seccion || seccion)}</span>
          <h4><a href="${href}">${n.Titulo || ''}</a></h4>
          <div class="meta">${formatFecha(n.Fecha)}</div>
        </article>`;
    }

    // Cada artículo es hijo directo del grid — sin wrappers intermedios
    el.innerHTML = noticias.map((n, i) => i === 0 ? mainCard(n) : sideCard(n)).join('');
  }

  /* ── RENDER SIDEBAR — Últimas Noticias ──────────────────── */

  /** Popula .sidebar-latest con las 5 noticias más recientes, cada una clickeable */
  function renderSidebar(noticias) {
    const container = document.querySelector('.sidebar-latest');
    if (!container || !noticias || noticias.length === 0) return;

    const titulo = container.querySelector('.sidebar-title');
    const tituloHTML = titulo ? titulo.outerHTML : '<div class="sidebar-title">Últimas Noticias</div>';

    const items = noticias.slice(0, 5).map(n => {
      const href = `noticia.html?id=${encodeURIComponent(n.ID)}`;
      return `
        <article class="latest-item">
          <a href="${href}" style="display:block;text-decoration:none;color:inherit;">
            <span class="tag">${esc(n.Seccion || 'Negocios')}</span>
            <h5>${truncar(n.Titulo || '', 90)}</h5>
            <div class="meta">${formatFecha(n.Fecha)}</div>
          </a>
        </article>`;
    }).join('');

    container.innerHTML = tituloHTML + items;
  }

  /* ── RENDER NOTICIAS DEL DÍA ─────────────────────────────── */

  /** Rellena [data-noticias-grid] con las 12 noticias más prioritarias (sin el hero) */
  function renderGrid(noticias) {
    const grid = document.querySelector('[data-noticias-grid]');
    if (!grid) return;

    if (!noticias || noticias.length === 0) {
      grid.innerHTML = '<div class="nc-estado">No hay noticias disponibles en este momento.</div>';
      return;
    }

    grid.innerHTML = noticias.map(n => {
      const href = `noticia.html?id=${encodeURIComponent(n.ID)}`;
      return `
        <article class="nc-card">
          <a href="${href}" class="nc-card-link">
            <div class="nc-card-img">${imgTag(n.Imagen_URL, n.Titulo)}</div>
            <div class="nc-card-body">
              <span class="nc-tag">${esc(n.Seccion || 'Negocios')}</span>
              <h3 class="nc-titulo">${n.Titulo || ''}</h3>
              <div class="nc-meta">
                <span class="nc-fecha">${formatFecha(n.Fecha)}</span>
                <span class="nc-fuente">${esc(n.Fuente || '')}</span>
              </div>
            </div>
          </a>
        </article>`.trim();
    }).join('\n');
  }

  /* ── SPONSORS SIDEBAR ───────────────────────────────────── */

  async function renderSponsors() {
    const container = document.getElementById('sidebar-sponsors');
    if (!container) return;

    try {
      const SHEET_ID = '1D4wNFDLuoMbuGtBWfW-PeTQPk-tOgQF8ezkVaFo71SY';
      const res = await fetch(
        `https://opensheet.elk.sh/${SHEET_ID}/SPONSOR-WEB`,
        { cache: 'no-store' }
      );
      if (!res.ok) return;
      const rows = await res.json();

      const activos = (rows || []).filter(r => r.Imagen && r.Imagen.trim());
      if (!activos.length) return;

      const imgs = activos.map(r => {
        const src  = esc('assets/sponsors-web/' + r.Imagen.trim());
        const alt  = esc((r.Alt || '').trim());
        return `<img class="spons-img" src="${src}" alt="${alt}" loading="lazy"
                     onerror="this.style.display='none';">`;
      }).join('');

      container.innerHTML =
        `<div class="spons-label">Patrocinadores</div>${imgs}`;

    } catch (err) {
      console.warn('[Clave] Error al cargar sponsors:', err.message);
    }
  }

  /* ── CARRUSEL EDICIONES DIGITALES ───────────────────────── */

  async function renderEdiciones() {
    const track = document.querySelector('[data-ediciones]');
    if (!track) return;

    try {
      const res = await fetch('data/ediciones.json', { cache: 'no-store' });
      if (!res.ok) return;
      const ediciones = await res.json();
      if (!ediciones || !ediciones.length) return;

      track.innerHTML = ediciones.map(e => `
        <a class="edi-card" href="${esc(e.flipbook)}" target="_blank" rel="noopener"
           title="${esc(e.nombre)}">
          <img src="${esc(e.portada)}" alt="${esc(e.nombre)}" loading="lazy"
               onerror="this.src='portada_mayo26.png';this.onerror=null;">
        </a>`).join('');

      // Flechas prev / next
      const wrap = track.closest('.edi-wrap');
      const btnPrev = wrap && wrap.querySelector('.edi-prev');
      const btnNext = wrap && wrap.querySelector('.edi-next');

      const cardWidth = () => {
        const c = track.querySelector('.edi-card');
        return c ? c.offsetWidth + 16 : 160;
      };

      if (btnPrev) btnPrev.addEventListener('click', () =>
        track.scrollBy({ left: -cardWidth(), behavior: 'smooth' }));
      if (btnNext) btnNext.addEventListener('click', () =>
        track.scrollBy({ left:  cardWidth(), behavior: 'smooth' }));

      const updateArrows = () => {
        if (btnPrev) btnPrev.classList.toggle('visible', track.scrollLeft > 2);
        if (btnNext) btnNext.classList.toggle('visible',
          track.scrollLeft + track.clientWidth < track.scrollWidth - 2);
      };

      track.addEventListener('scroll', updateArrows, { passive: true });
      // Llamar después de que las imágenes carguen para medir correctamente
      requestAnimationFrame(updateArrows);

    } catch (err) {
      console.warn('[Clave] Error al cargar ediciones:', err.message);
    }
  }

  /* ── FETCH Y DISTRIBUCIÓN ────────────────────────────────── */

  let _cargando = false;

  async function cargarNoticias() {
    if (_cargando) return;
    _cargando = true;
    const gridDia = document.querySelector('[data-noticias-grid]');

    /* Spinner en Noticias del Día solo si está vacío (primera carga) */
    if (gridDia && gridDia.children.length === 0) {
      gridDia.innerHTML = `
        <div class="nc-estado">
          <div class="nc-estado-spinner"></div>
          Cargando noticias…
        </div>`;
    }

    try {
      const res = await fetch(OPENSHEET_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const datos = await res.json();

      /* 1. Filtrar Activa = TRUE */
      const activas = datos.filter(n =>
        String(n.Activa || '').trim().toUpperCase() === 'TRUE'
      );

      /* 2. Ordenar por Prioridad descendente */
      activas.sort((a, b) => (parseFloat(b.Prioridad) || 0) - (parseFloat(a.Prioridad) || 0));

      /* 3. Hero: noticia de mayor prioridad global */
      const hero = activas[0] || null;
      renderHero(hero);

      /* 4. Distribuir por sección (hasta MAX_POR_SEC por sección) */
      const buckets = {};
      for (const sec of SECCIONES) buckets[sec] = [];

      const heroId = hero ? hero.ID : null;
      for (const n of activas) {
        if (heroId && n.ID === heroId) continue;
        const sec = (n.Seccion || '').trim();
        if (buckets[sec] !== undefined && buckets[sec].length < MAX_POR_SEC) {
          buckets[sec].push(n);
        }
      }

      for (const [sec, arts] of Object.entries(buckets)) {
        renderSeccion(sec, arts);
      }

      /* 5. Noticias del Día: 12 más prioritarias sin repetir el hero */
      const paraDia = activas.filter(n => n.ID !== heroId).slice(0, MAX_DIA);
      renderGrid(paraDia);

      /* 6. Sidebar: 5 noticias más recientes (ordenadas ya por prioridad) */
      renderSidebar(activas.slice(0, 5));

      console.info(
        `[Clave] Noticias cargadas — hero: ${heroId || '(ninguno)'} | día: ${paraDia.length}`
      );

    } catch (err) {
      console.warn('[Clave] Error al cargar noticias:', err.message);
      if (gridDia && gridDia.querySelector('.nc-estado-spinner')) {
        gridDia.innerHTML = `
          <div class="nc-estado">
            No se pudieron cargar las noticias.<br>Intenta de nuevo más tarde.
          </div>`;
      }
    } finally {
      _cargando = false;
    }
  }

  /* ── INICIALIZACIÓN ──────────────────────────────────────── */
  function init() {
    renderEdiciones();
    renderSponsors();
    cargarNoticias();
    setInterval(cargarNoticias, RELOAD_MS); // recarga cada 5 minutos
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
