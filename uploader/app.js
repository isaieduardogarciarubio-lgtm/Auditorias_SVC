/**
 * Uploader de Catálogo de Estatus
 *
 * Toma el CSV físico (columnas ID, ESTATUS, OPTIMIZADA) que produce el
 * sistema de origen, valida que tenga las columnas correctas, muestra un
 * preview, y lo deja listo para descargar tal cual (sin cifrar — no es
 * auditoría sensible viajando fuera de Grid, es información operativa de
 * consulta). Ese archivo es el que se carga en el botón "Cargar catálogo"
 * del menú de la app de auditoría, y se queda viviendo ahí hasta que se
 * reemplace por uno nuevo.
 *
 * A propósito NO usa form-engine.js: no es un asistente de una pregunta por
 * pantalla, es un validador de un archivo existente (potencialmente cientos
 * de filas).
 */

const LAST_GENERATED_KEY = 'uploader_last_generated_at';
const STALE_MAX_AGE_MS = 60 * 60 * 1000;

class UploaderApp {
  constructor() {
    this.rawCsvText = null;
    this.parsedPreview = null;
    this.validationError = null;
    this.init();
  }

  init() {
    this.setHeader();
    this.render();
  }

  setHeader() {
    const left = document.getElementById('navbar_left');
    const right = document.getElementById('navbar_right');
    left.innerHTML = `<img class="navbar-logo" src="../data/ML_es_RGB_ML-Pluma-Izquierda-Relleno-B (1).png" alt="MercadoLibre" />`;
    right.innerHTML = `<span class="navbar-title">Catálogo de Estatus</span>`;
  }

  lastGeneratedAt() {
    const raw = localStorage.getItem(LAST_GENERATED_KEY);
    return raw ? Number(raw) : null;
  }

  isStale() {
    const at = this.lastGeneratedAt();
    return at === null || Date.now() - at > STALE_MAX_AGE_MS;
  }

  formatAge(ms) {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `hace ${hours} h ${minutes % 60} min`;
  }

  render() {
    const app = document.getElementById('app');
    app.innerHTML = '';

    const content = document.createElement('div');
    content.className = 'content';

    if (this.isStale()) {
      const at = this.lastGeneratedAt();
      const banner = document.createElement('div');
      banner.className = 'stale-banner';
      const message = at === null
        ? 'Todavía no has generado ningún catálogo en este dispositivo.'
        : `El último catálogo que generaste fue ${this.formatAge(Date.now() - at)}. La información debe ser siempre la más reciente — verifica el estatus de los shipments antes de generar uno nuevo.`;
      banner.innerHTML = `
        <div class="stale-banner-icon">${Icons.svg('alertCircle', { size: 26 })}</div>
        <div class="stale-banner-text">${message}</div>
      `;
      content.appendChild(banner);
    }

    const intro = document.createElement('div');
    intro.innerHTML = `
      <h1 class="step-question" style="margin-bottom: var(--spacing-xs);">Catálogo de estatus</h1>
      <p style="color: var(--color-text-muted); font-size: var(--font-body);">Sube el CSV físico con columnas ID, ESTATUS, OPTIMIZADA. Se valida en tu navegador y queda listo para cargarlo en la app de auditoría, donde se queda viviendo hasta que subas uno nuevo.</p>
    `;
    content.appendChild(intro);

    content.appendChild(this.renderUploadCard());
    content.appendChild(this.renderNavSection());

    app.appendChild(content);
  }

  renderUploadCard() {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.marginTop = 'var(--spacing-lg)';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv,.txt';
    fileInput.hidden = true;
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (file) this.handleFile(file);
    });
    card.appendChild(fileInput);

    if (!this.rawCsvText) {
      const dropzone = document.createElement('button');
      dropzone.type = 'button';
      dropzone.className = 'photo-dropzone';
      dropzone.innerHTML = `
        <span class="photo-dropzone-icon">${Icons.svg('clipboard', { size: 30 })}</span>
        <span class="photo-dropzone-label">Elegir CSV de estatus</span>
      `;
      dropzone.addEventListener('click', () => fileInput.click());
      card.appendChild(dropzone);
      return card;
    }

    if (this.validationError) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = `
        <div class="empty-state-icon">${Icons.svg('alertCircle', { size: 28 })}</div>
        <p>${this.validationError}</p>
      `;
      card.appendChild(empty);

      const retryBtn = document.createElement('button');
      retryBtn.className = 'btn btn-secondary btn-block';
      retryBtn.style.marginTop = 'var(--spacing-md)';
      retryBtn.innerHTML = `${Icons.svg('refresh', { size: 18 })}<span>Elegir otro archivo</span>`;
      retryBtn.addEventListener('click', () => {
        this.rawCsvText = null;
        this.validationError = null;
        this.render();
      });
      card.appendChild(retryBtn);
      return card;
    }

    const summary = document.createElement('p');
    summary.innerHTML = `<strong>${this.parsedPreview.records.length} shipments</strong> encontrados en el archivo.`;
    card.appendChild(summary);

    const tableWrap = document.createElement('div');
    tableWrap.className = 'records-table-wrap';
    tableWrap.appendChild(this.renderPreviewTable());
    card.appendChild(tableWrap);
    if (this.parsedPreview.records.length > 5) {
      const note = document.createElement('p');
      note.style.color = 'var(--color-text-muted)';
      note.style.fontSize = '0.85rem';
      note.textContent = `Mostrando 5 de ${this.parsedPreview.records.length} filas.`;
      card.appendChild(note);
    }

    const actions = document.createElement('div');
    actions.className = 'flex-row';
    actions.style.marginTop = 'var(--spacing-md)';

    const changeBtn = document.createElement('button');
    changeBtn.className = 'btn btn-secondary btn-block';
    changeBtn.innerHTML = `<span>Elegir otro archivo</span>`;
    changeBtn.addEventListener('click', () => {
      this.rawCsvText = null;
      this.render();
    });

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'btn btn-primary btn-block';
    downloadBtn.innerHTML = `${Icons.svg('checkCircle', { size: 18 })}<span>Descargar catálogo validado</span>`;
    downloadBtn.addEventListener('click', () => this.downloadValidated());

    actions.appendChild(changeBtn);
    actions.appendChild(downloadBtn);
    card.appendChild(actions);

    return card;
  }

  renderPreviewTable() {
    const table = document.createElement('table');
    table.className = 'records-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    this.parsedPreview.headers.forEach((h) => {
      const th = document.createElement('th');
      th.textContent = h;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    this.parsedPreview.records.slice(0, 5).forEach((record) => {
      const row = document.createElement('tr');
      this.parsedPreview.headers.forEach((h) => {
        const td = document.createElement('td');
        td.textContent = record[h] || '';
        row.appendChild(td);
      });
      tbody.appendChild(row);
    });
    table.appendChild(tbody);

    return table;
  }

  async handleFile(file) {
    const text = await file.text();
    const { headers, records } = CSVEngine.parseCSV(text);

    const idCol = headers.find((h) => h.trim().toLowerCase() === 'id');
    const estatusCol = headers.find((h) => h.trim().toLowerCase() === 'estatus');
    const optimizadaCol = headers.find((h) => h.trim().toLowerCase() === 'optimizada');

    if (!idCol || !estatusCol || !optimizadaCol) {
      this.rawCsvText = text;
      this.validationError = 'El archivo no tiene las columnas esperadas (ID, ESTATUS, OPTIMIZADA). Verifica los encabezados y vuelve a intentarlo.';
      this.parsedPreview = null;
      this.render();
      return;
    }

    if (!records.length) {
      this.rawCsvText = text;
      this.validationError = 'El archivo no tiene filas de datos.';
      this.parsedPreview = null;
      this.render();
      return;
    }

    this.rawCsvText = text;
    this.validationError = null;
    this.parsedPreview = { headers, records };
    this.render();
  }

  downloadValidated() {
    const blob = new Blob([this.rawCsvText], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estatus_shipments_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    localStorage.setItem(LAST_GENERATED_KEY, String(Date.now()));
    this.showAlert('Catálogo validado y descargado. Cárgalo en la app de auditoría.', 'success');
    this.render();
  }

  /**
   * Botón para ir a la app de auditoría — ambas apps viven en el mismo
   * repo/sitio de GitHub Pages, así que es un link relativo normal.
   */
  renderNavSection() {
    const wrap = document.createElement('div');
    wrap.style.marginTop = 'var(--spacing-lg)';
    wrap.style.textAlign = 'center';

    const link = document.createElement('a');
    link.href = '../';
    link.className = 'btn btn-secondary btn-sm';
    link.style.textDecoration = 'none';
    link.innerHTML = `${Icons.svg('arrowLeft', { size: 16 })}<span>Ir a la app de Auditoría</span>`;
    wrap.appendChild(link);
    return wrap;
  }

  showAlert(message, type = 'info') {
    const iconByType = { success: 'checkCircle', error: 'alertCircle', info: 'infoCircle' };
    const alertEl = document.createElement('div');
    alertEl.className = `alert alert-${type}`;
    alertEl.style.position = 'fixed';
    alertEl.style.bottom = 'calc(var(--spacing-lg) + env(safe-area-inset-bottom))';
    alertEl.style.left = 'var(--spacing-md)';
    alertEl.style.right = 'var(--spacing-md)';
    alertEl.style.maxWidth = '380px';
    alertEl.style.marginLeft = 'auto';
    alertEl.style.marginRight = 'auto';
    alertEl.style.zIndex = '9999';
    alertEl.innerHTML = `
      <span class="alert-icon">${Icons.svg(iconByType[type] || 'infoCircle', { size: 16 })}</span>
      <span>${message}</span>
    `;
    document.body.appendChild(alertEl);
    setTimeout(() => alertEl.remove(), 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new UploaderApp();
});
