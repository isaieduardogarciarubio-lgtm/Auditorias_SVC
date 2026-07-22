# 📊 Consolidado de Auditoría — Grid

Dashboard de consolidación en vivo para múltiples tipos de logs (Destino/Doca, FURY, Contenerizado, Linehaul) desde la herramienta de GitHub Pages.

## 🎯 Qué es

Un **dashboard interactivo en Grid** que:
- Ingiere **CSVs o ZIPs** cargados manualmente (drag & drop)
- **Auto-detecta** tipo de log por headers CSV
- Descomprime ZIPs con fotos integradas (JSZip)
- Deduplica automático por timestamp + identificadores de log
- Consolida en **4 State Buckets independientes** (uno por tipo de log)
- Muestra **KPIs + gráficos Plotly + tabla filtrable** por log en tiempo real
- Permite **refresh manual** con reintento automático en conflictos
- **Descarga consolidada** en JSON

## 📋 Tipos de Log Soportados

| Log | Campos | KPIs | Gráficos |
|-----|--------|------|----------|
| **Destino/Doca** | HU, Destino, Doca, Resultado (auto) | Total, Sin incidencia, Erroneo | Resultado (dona), Top Destinos (barras), Top Docas (barras) |
| **FURY** | Shipment, Foto, Situación, Valor (opt) | Total, por Situación | Situación (barras), Top Shipments (barras) |
| **Contenerizado** | Shipment, Situación, Foto (cond: si "Dañado") | Total, por Situación | Situación (barras), Top Shipments (barras) |
| **Linehaul** | HU, Área, Armado Sitio, Origen (cond), Canalización, Foto (opt), Comentarios (opt) | Total, por Área | Área (dona), Canalización (barras) |

## 🚀 Despliegue

### Paso 1: Crear documentos de datos en Grid

Este app requiere **un documento de datos dedicado** para los State Buckets.

```
UI de Grid:
1. Sube un archivo CSV vacío (o cualquier archivo pequeño)
2. Copia su doc_id de la URL: https://grid.melioffice.com/d/{DOC_ID}/...
```

Guarda ese `{DOC_ID}`.

### Paso 2: Subir el HTML a Grid

1. Descarga `grid/consolidado_auditoria.html`
2. Ve a https://grid.melioffice.com
3. Sube el archivo HTML como documento nuevo

Copia el `{HTML_DOC_ID}` de la URL.

### Paso 3: Abrir Dashboard

Abre con el data_doc_id en la URL:

```
https://grid.melioffice.com/d/{HTML_DOC_ID}/?data_doc_id={DATA_DOC_ID}
```

O hardcodeado en el HTML (editar línea ~490):
```javascript
this.docId = params.get('data_doc_id') || '{TU_DATA_DOC_ID}';
```

## 📋 Flujo de Uso

1. **Operador en GitHub Pages**: Llena forma (escanea, captura foto) → exporta CSV o ZIP
2. **Operador abre dashboard** con `?data_doc_id=...`
3. **Drag & drop del archivo CSV o ZIP** → auto-detecta tipo, descomprime, valida
4. **Dashboard actualiza** → tabs de cada log, KPIs, gráficos, tabla
5. **Busca/filtra** en la tabla
6. **Haz click en miniatura** de foto para ver en modal
7. **Descarga consolidado** como JSON con todos los logs

## 🎨 Paleta de Colores (dataviz)

| Elemento | Color | Hex | Job |
|---|---|---|---|
| Success (Verde) | — | `#008300` | Sin incidencia, Normal |
| Critical (Rojo) | — | `#d03b3b` | Erroneo, Dañado, Perdido |
| Series (Azul) | — | `#3987e5` | Barras, líneas |
| Accent (Amarillo) | — | `#ffd100` | Botones, tabs activos |
| Surface Dark | — | `#1a1a19` | Fondo charts |

**Validación:** Paleta Nocturne + dataviz (CVD ΔE ≥8.4, normal-vision ΔE ≥15).

## 🔒 Seguridad & Restricciones (Biblia)

✅ **Sin localStorage**: 4 State Buckets independientes  
✅ **Identidad**: `GET /api/v1/me` para obtener email/avatar  
✅ **Optimistic concurrency**: `if_updated_at` en PUT → 409 = reintento automático  
✅ **Modales propios**: No usa `alert/confirm/prompt`  
✅ **Librerías locales**: Plotly + JSZip desde `/d/_libs/`  
✅ **Sin CDNs externos**: CSS + JS autocontenidos en HTML  

## 💾 Almacenamiento

**4 State Buckets** en el documento de datos:

```json
{
  "destino_doca_master": {
    "version": 1,
    "records": [
      {
        "ts": "2026-07-14T10:30:45Z",
        "hu": "HU123",
        "destino": "MXAMT1",
        "doca": "134",
        "resultado": "Sin incidencia"
      }
    ]
  },
  "fury_master": { "version": 1, "records": [...] },
  "contenerizado_master": { "version": 1, "records": [...] },
  "linehaul_master": { "version": 1, "records": [...] }
}
```

**Cada bucket:**
- Límite ~1 MB → ~16k registros @ 60 bytes c/u
- Deduplicación por: ts + hu + shipment + destino + doca
- Reintento automático en conflictos (409)

## 📥 Formatos de Entrada

### CSV
```
Fecha/Hora,HU,Destino,Doca,Resultado
2026-07-14 10:30:45,HU123,MXAMT1,134,Sin incidencia
```

Auto-detecta tipo por headers (case-insensitive):
- `resultado` → destino_doca
- `shipment + situacion + foto + valor` → fury
- `shipment + situacion + foto` (sin valor) → contenerizado
- `hu + area + canalizacion` → linehaul

### ZIP
```
destino_doca_2026-07-14/
├── data.csv
└── fotos/
    ├── 001_HU123.jpg
    └── 002_HU124.jpg

fury_2026-07-14/
├── data.csv
└── fotos/
    ├── 001_SHIP123.jpg
    └── 002_SHIP124.jpg
```

Los ZIPs contienen CSVs + subcarpeta `fotos/` con imágenes JPEG. El app:
1. Descomprime ZIP
2. Lee CSV de cada carpeta → detecta log type
3. Extrae fotos → las convierte a data URLs
4. Inserta datos + fotos en State Bucket

## 📊 Gráficos Por Log

| Log | Gráfico 1 | Gráfico 2 | Gráfico 3 |
|-----|-----------|-----------|-----------|
| **Destino/Doca** | Resultado (dona: verde/rojo) | Top 8 Destinos (barras) | Top 8 Docas (barras) |
| **FURY** | Situación (barras) | Top 10 Shipments (barras) | — |
| **Contenerizado** | Situación (barras) | Top 10 Shipments (barras) | — |
| **Linehaul** | Área (dona) | Canalización (barras) | — |

Todos con tema Nocturne: fondo #1a1a19, texto blanco, sin modo bar.

## 🐛 Troubleshooting

| Problema | Causa | Solución |
|----------|-------|----------|
| "No autenticado" | No en VPN Grid | Conecta a VPN + inicia sesión en Grid UI |
| Tabla vacía | No se cargó el bucket | Verifica `data_doc_id` en URL |
| "JSZip undefined" | `/d/_libs/jszip.min.js` falta | Contacta admin Grid |
| CSV rechazado | Headers no coinciden | Verifica headers exactos (mayús/minús) |
| Fotos no se ven | Nombres de archivo no coinciden | Chequea CSV referencia foto: `001_SHIPID.jpg` |
| 409 Conflict | Dos usuarios escriben simultáneamente | App reintenta automático en 500-1000ms |
| Gráficos en blanco | Plotly no cargó | Verifica `/d/_libs/plotly.min.js` |

## 🔄 Auto-Polling

- **Manual:** Botón "Actualizar" en navbar → recarga desde State Buckets
- Reintento automático en conflictos (409): 500-1000ms + backoff exponencial

## 📤 Descarga

- **JSON consolidado**: Botón "Descargar" en navbar
- Contiene: `{ logs: { destino_doca: [...], fury: [...], contenerizado: [...], linehaul: [...] } }`
- Timestamp: `consolidado_AAAA-MM-DD.json`

## 📝 Licencia

Uso interno MercadoLibre.

## 🔗 Links

- **Generador de CSV (GitHub Pages)**: https://isaieduardogarciarubio-lgtm.github.io/Auditorias_SVC/
- **Biblia Grid V11.4**: Sección 23 (State Buckets), Sección 19 (Concurrency), Sección 24 (Folders API)
- **dataviz skill**: Asignación de colores por job (categorical, sequential, status)
