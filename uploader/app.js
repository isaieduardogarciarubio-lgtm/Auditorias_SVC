/**
 * Uploader de Catálogo de Estatus
 *
 * Toma el CSV físico (columnas ID, ESTATUS, OPTIMIZADA) que produce el
 * sistema de origen y valida que tenga las columnas correctas + un preview.
 * No genera ni descarga ningún archivo nuevo — el archivo validado es el
 * mismo que el operador ya tiene en su dispositivo; ese es el que sube tal
 * cual en el botón "Cargar catálogo" del menú de la app de auditoría, donde
 * se queda viviendo hasta que se reemplace por uno nuevo.
 *
 * A propósito NO usa form-engine.js: no es un asistente de una pregunta por
 * pantalla, es un validador de un archivo existente (potencialmente cientos
 * de filas).
 */

const LAST_VALIDATED_KEY = 'uploader_last_validated_at';
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

  lastValidatedAt() {
    const raw = localStorage.getItem(LAST_VALIDATED_KEY);
    return raw ? Number(raw) : null;
  }

  isStale() {
    const at = this.lastValidatedAt();
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
      const at = this.lastValidatedAt();
      const banner = document.createElement('div');
      banner.className = 'stale-banner';
      const message = at === null
        ? 'Todavía no has validado ningún catálogo en este dispositivo.'
        : `El último catálogo que validaste fue ${this.formatAge(Date.now() - at)}. La información debe ser siempre la más reciente — verifica el estatus de los shipments antes de subir uno nuevo.`;
      banner.innerHTML = `
        <div class="stale-banner-icon">${Icons.svg('alertCircle', { size: 26 })}</div>
        <div class="stale-banner-text">${message}</div>
      `;
      content.appendChild(banner);
    }

    const intro = document.createElement('div');
    intro.innerHTML = `
      <h1 class="step-question" style="margin-bottom: var(--spacing-xs);">Catálogo de estatus</h1>
      <p style="color: var(--color-text-muted); font-size: var(--font-body);">Sube el CSV físico con columnas ID, ESTATUS, OPTIMIZADA para validarlo. El mismo archivo (sin cambios) es el que subes después en la app de auditoría.</p>
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

    const successMsg = document.createElement('p');
    successMsg.style.display = 'flex';
    successMsg.style.alignItems = 'center';
    successMsg.style.gap = 'var(--spacing-sm)';
    successMsg.style.color = 'var(--color-success, #34c759)';
    successMsg.innerHTML = `${Icons.svg('checkCircle', { size: 18 })}<span><strong>${this.parsedPreview.records.length} shipments</strong> — archivo válido. Súbelo tal cual en la app de auditoría.</span>`;
    card.appendChild(successMsg);

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

    const changeBtn = document.createElement('button');
    changeBtn.className = 'btn btn-secondary btn-block';
    changeBtn.style.marginTop = 'var(--spacing-md)';
    changeBtn.innerHTML = `<span>Elegir otro archivo</span>`;
    changeBtn.addEventListener('click', () => {
      this.rawCsvText = null;
      this.render();
    });
    card.appendChild(changeBtn);

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
    localStorage.setItem(LAST_VALIDATED_KEY, String(Date.now()));
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
}

document.addEventListener('DOMContentLoaded', () => {
  new UploaderApp();
});
