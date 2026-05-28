# Clave Empresarial — Sitio Web

Repositorio del sitio web de la revista Clave Empresarial.
Desplegado en Cloudflare Pages desde la rama `main`.

---

## Proceso mensual: publicar nueva edición

Al cerrar cada edición, seguir estos 3 pasos:

### 1. Orshot genera el PDF
- El PDF se guarda en: `revista-motor/output/pdf/revista_[mes][año].pdf`
- Orshot también genera la portada (imagen PNG)

### 2. Claude Code agrega los archivos y actualiza el JSON

```bash
# Copiar PDF dentro del repo
cp ../output/pdf/revista_[mes][año].pdf output/pdf/

# Copiar portada dentro del repo
cp portada_[mes][año].png assets/revista/
```

Luego actualizar `data/ediciones.json` — agregar un objeto al inicio del array:

```json
[
  {
    "nombre": "Junio 2026",
    "portada": "assets/revista/portada_jun26.png",
    "pdf": "output/pdf/revista_jun26.pdf",
    "flipbook": "revista.html?pdf=output/pdf/revista_jun26.pdf"
  },
  {
    "nombre": "Mayo 2026",
    "portada": "assets/revista/portada_mayo26.png",
    "pdf": "output/pdf/revista_mayo26.pdf",
    "flipbook": "revista.html?pdf=output/pdf/revista_mayo26.pdf"
  }
]
```

> La primera entrada del array es la edición más reciente.
> El carrusel del home y el visor la cargan automáticamente.

### 3. git push → Cloudflare despliega solo

```bash
git add output/pdf/revista_[mes][año].pdf assets/revista/portada_[mes][año].png data/ediciones.json
git commit -m "Edición [mes] [año]"
git push
```

Cloudflare detecta el push y despliega en ~1 minuto. No se requiere ningún paso adicional.

---

## Estructura del proyecto

```
sitio-web/
├── index.html          # Home — carga noticias y carrusel de ediciones
├── noticia.html        # Vista de artículo individual
├── revista.html        # Visor flipbook (PDF.js) — acepta ?pdf= en URL
├── js/
│   └── noticias.js     # Fetch desde Google Sheets, renderiza todo el home
├── data/
│   └── ediciones.json  # Fuente de verdad de ediciones digitales
├── assets/
│   ├── revista/        # Portadas de cada edición (PNG)
│   └── sponsors-web/   # Imágenes de patrocinadores
└── output/
    └── pdf/            # PDFs de cada edición
```

## Fuentes de datos

| Dato | Fuente |
|------|--------|
| Noticias | Google Sheet — pestaña `NOTICIAS` |
| Patrocinadores | Google Sheet — pestaña `SPONSOR-WEB` |
| Ediciones | `data/ediciones.json` en este repo |

Google Sheet ID: `1D4wNFDLuoMbuGtBWfW-PeTQPk-tOgQF8ezkVaFo71SY`

## Desarrollo local

El servidor debe correr desde `revista-motor/` (un nivel arriba de este repo):

```bash
cd revista-motor/
python -m http.server 8080
# Abrir: http://localhost:8080/sitio-web/
```
