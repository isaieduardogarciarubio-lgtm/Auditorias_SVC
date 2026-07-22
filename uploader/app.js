/**
 * Uploader de Catálogo de Estatus
 *
 * Toma el CSV físico (columnas ID, ESTATUS, OPTIMIZADA) que produce el
 * sistema de origen, lo valida, y lo escribe directo al mismo localStorage
 * que lee la app de auditoría (`audit_status_catalog_v1`) — ambas apps
 * viven en el mismo origen (mismo sitio de GitHub Pages, solo cambia la
 * ruta), así que comparten localStorage sin necesidad de ningún archivo
 * intermedio ni de un segundo paso de carga manual en la app de auditoría.
 * Esa app solo necesita su propio botón "Cargar catálogo" como respaldo
 * para cuando el archivo viaja a un dispositivo distinto al que lo validó.
 *
 * A propósito NO usa form-engine.js: no es un asistente de una pregunta por
 * pantalla, es un validador de un archivo existente (potencialmente cientos
 * de filas).
 */

const CATALOG_STORAGE_KEY = 'audit_status_catalog_v1';
const STALE_MAX_AGE_MS = 60 * 60 * 1000;

class UploaderApp {
  constructor() {
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

  loadSharedCatalog() {
    try {
      const raw = localStorage.getItem(CATALOG_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.index && parsed.loadedAt ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  isStale(loadedAt) {
    return loadedAt === undefined || loadedAt === null || Date.now() - loadedAt > STALE_MAX_AGE_MS;
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

    const shared = this.loadSharedCatalog();
    if (this.isStale(shared && shared.loadedAt)) {
      const banner = document.createElement('div');
      banner.className = 'stale-banner';
      const message = !shared
        ? 'Todavía no hay ningún catálogo cargado en este dispositivo.'
        : `El catálogo cargado lleva ${this.formatAge(Date.now() - shared.loadedAt)} sin actualizarse. La información debe ser siempre la más reciente — verifica el estatus de los shipments antes de subir uno nuevo.`;
      banner.innerHTML = `
        <div class="stale-banner-icon">${Icons.svg('alertCircle', { size: 26 })}</div>
        <div class="stale-banner-text">${message}</div>
      `;
      content.appendChild(banner);
    }

    const intro = document.createElement('div');
    intro.innerHTML = `
      <h1 class="step-question" style="margin-bottom: var(--spacing-xs);">Catálogo de estatus</h1>
      <p style="color: var(--color-text-muted); font-size: var(--font-body);">Sube el CSV físico con columnas ID, ESTATUS, OPTIMIZADA. Se valida y queda disponible de inmediato en la app de auditoría — sin pasos adicionales, mismo dispositivo.</p>
    `;
    content.appendChild(intro);

    content.appendChild(this.renderUploadCard(shared));
    content.appendChild(this.renderNavSection());

    app.appendChild(content);
  }

  renderUploadCard(shared) {
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
        this.validationError = null;
        this.render();
      });
      card.appendChild(retryBtn);
      return card;
    }

    if (this.parsedPreview) {
      const successMsg = document.createElement('p');
      successMsg.style.display = 'flex';
      successMsg.style.alignItems = 'center';
      successMsg.style.gap = 'var(--spacing-sm)';
      successMsg.style.color = 'var(--color-success, #34c759)';
      successMsg.innerHTML = `${Icons.svg('checkCircle', { size: 18 })}<span><strong>${this.parsedPreview.records.length} shipments</strong> — cargado y disponible en la app de auditoría.</span>`;
      card.appendChild(successMsg);

      const tableWrap = document.createElement('div');
      tableWrap.className = 'records-table-wrap';
      tableWrap.appendChild(this.renderPreviewTable(this.parsedPreview));
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
      changeBtn.innerHTML = `<span>Cargar otro archivo</span>`;
      changeBtn.addEventListener('click', () => {
        this.parsedPreview = null;
        this.render();
      });
      card.appendChild(changeBtn);
      return card;
    }

    if (shared) {
      const summary = document.createElement('p');
      summary.innerHTML = `<strong>${Object.keys(shared.index).length} shipments</strong> cargados actualmente · actualizado ${this.formatAge(Date.now() - shared.loadedAt)}.`;
      card.appendChild(summary);
    }

    card.appendChild(this.renderDropzone(fileInput));
    return card;
  }

  /**
   * Zona de arrastrar y soltar (además de click para abrir el explorador).
   * Reacciona a dragenter/dragover/drop; sin esto, arrastrar un archivo
   * sobre el botón no hacía nada porque el navegador solo abre el picker
   * con un click real.
   */
  renderDropzone(fileInput) {
    const dropzone = document.createElement('button');
    dropzone.type = 'button';
    dropzone.className = 'photo-dropzone';
    dropzone.innerHTML = `
      <span class="photo-dropzone-icon">${Icons.svg('clipboard', { size: 30 })}</span>
      <span class="photo-dropzone-label">Elegir o arrastrar CSV de estatus</span>
    `;
    dropzone.addEventListener('click', () => fileInput.click());

    ['dragenter', 'dragover'].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('is-dragover');
      });
    });
    ['dragleave', 'dragend'].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('is-dragover');
      });
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('is-dragover');
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) this.handleFile(file);
    });

    return dropzone;
  }

  renderPreviewTable(preview) {
    const table = document.createElement('table');
    table.className = 'records-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    preview.headers.forEach((h) => {
      const th = document.createElement('th');
      th.textContent = h;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    preview.records.slice(0, 5).forEach((record) => {
      const row = document.createElement('tr');
      preview.headers.forEach((h) => {
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
      this.validationError = 'El archivo no tiene las columnas esperadas (ID, ESTATUS, OPTIMIZADA). Verifica los encabezados y vuelve a intentarlo.';
      this.parsedPreview = null;
      this.render();
      return;
    }

    if (!records.length) {
      this.validationError = 'El archivo no tiene filas de datos.';
      this.parsedPreview = null;
      this.render();
      return;
    }

    const index = {};
    records.forEach((r) => {
      const id = (r[idCol] || '').trim();
      if (!id) return;
      index[id] = {
        estatus: (r[estatusCol] || '').trim(),
        optimizada: (r[optimizadaCol] || '').trim(),
      };
    });

    localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify({ index, loadedAt: Date.now() }));

    this.validationError = null;
    this.parsedPreview = { headers, records };
    this.render();
  }

  /**
   * Botón para ir a la app de auditoría — ambas apps viven en el mismo
   * repo/sitio de GitHub Pages, así que es un link relativo normal.
   */
  renderNavSection() {
    const wrap = document.createElement('div');
    wrap.style.marginTop = 'var(--spacing-lg)';
    wrap.style.display = 'flex';
    wrap.style.justifyContent = 'center';

    const link = document.createElement('a');
    link.href = '../';
    link.className = 'icon-nav-btn';
    link.title = 'Ir a la app de Auditoría';
    link.setAttribute('aria-label', 'Ir a la app de Auditoría');
    link.innerHTML = Icons.svg('scan', { size: 20 });
    wrap.appendChild(link);
    return wrap;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new UploaderApp();
});
