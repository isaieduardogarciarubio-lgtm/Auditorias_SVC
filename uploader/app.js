/**
 * Uploader de Catálogo de Estatus
 *
 * Toma el CSV físico (columnas ID, ESTATUS, OPTIMIZADA) que produce el
 * sistema de origen, lo valida, lo cifra con el mismo passphrase compartido
 * que usa la app de Auditorías SVC (CryptoEngine/CryptoGate, AES-256-GCM) y
 * lo descarga. Ese archivo cifrado es el que luego se sube a mano en el
 * botón "Cargar catálogo" del menú de la app de auditoría.
 *
 * A propósito NO usa form-engine.js: no es un asistente de una pregunta por
 * pantalla, es un conversor de un archivo existente (potencialmente cientos
 * de filas) a su versión cifrada.
 */

const LAST_ENCRYPTED_KEY = 'uploader_last_encrypted_at';
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

  lastEncryptedAt() {
    const raw = localStorage.getItem(LAST_ENCRYPTED_KEY);
    return raw ? Number(raw) : null;
  }

  isStale() {
    const at = this.lastEncryptedAt();
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
      const at = this.lastEncryptedAt();
      const banner = document.createElement('div');
      banner.className = 'stale-banner';
      const message = at === null
        ? 'Todavía no has generado ningún catálogo cifrado en este dispositivo.'
        : `El último catálogo cifrado que generaste fue ${this.formatAge(Date.now() - at)}. Si el estatus de los shipments cambió, genera uno nuevo antes de compartirlo.`;
      banner.innerHTML = `
        <div class="stale-banner-icon">${Icons.svg('alertCircle', { size: 26 })}</div>
        <div class="stale-banner-text">${message}</div>
      `;
      content.appendChild(banner);
    }

    const intro = document.createElement('div');
    intro.innerHTML = `
      <h1 class="step-question" style="margin-bottom: var(--spacing-xs);">Cifrar catálogo de estatus</h1>
      <p style="color: var(--color-text-muted); font-size: var(--font-body);">Sube el CSV físico con columnas ID, ESTATUS, OPTIMIZADA. Se cifra en tu navegador antes de descargarlo — nunca sale en texto plano.</p>
    `;
    content.appendChild(intro);

    content.appendChild(this.renderUploadCard());
    content.appendChild(this.renderPassphraseSection());
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

    const encryptBtn = document.createElement('button');
    encryptBtn.className = 'btn btn-primary btn-block';
    encryptBtn.innerHTML = `${Icons.svg('checkCircle', { size: 18 })}<span>Cifrar y Descargar</span>`;
    encryptBtn.addEventListener('click', () => this.encryptAndDownload());

    actions.appendChild(changeBtn);
    actions.appendChild(encryptBtn);
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

  async encryptAndDownload() {
    try {
      const passphrase = await CryptoGate.ensurePassphrase();
      const encrypted = await CryptoEngine.encryptText(this.rawCsvText, passphrase, 'csv');

      const blob = new Blob([encrypted], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `estatus_shipments_cifrado_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      localStorage.setItem(LAST_ENCRYPTED_KEY, String(Date.now()));
      this.showAlert('Catálogo cifrado y descargado. Compártelo con el equipo de auditoría.', 'success');
      this.render();
    } catch (e) {
      const msg = e && e.message === 'Operación cancelada' ? 'Operación cancelada' : `No se pudo cifrar: ${e.message}`;
      this.showAlert(msg, e && e.message === 'Operación cancelada' ? 'info' : 'error');
    }
  }

  renderPassphraseSection() {
    const wrap = document.createElement('div');
    wrap.style.marginTop = 'var(--spacing-lg)';
    wrap.style.textAlign = 'center';

    const hasPassphrase = !!CryptoEngine.getSessionPassphrase();
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary btn-sm';
    btn.textContent = hasPassphrase ? 'Cambiar contraseña de encriptación' : 'Configurar contraseña de encriptación';
    btn.addEventListener('click', async () => {
      try {
        await CryptoGate.promptPassphrase();
        this.showAlert('Contraseña guardada en este dispositivo', 'success');
      } catch (e) {
        this.showAlert('Operación cancelada', 'info');
      }
    });
    wrap.appendChild(btn);
    return wrap;
  }

  /**
   * Botón para ir a la app de auditoría — ambas apps viven en el mismo
   * repo/sitio de GitHub Pages, así que es un link relativo normal.
   */
  renderNavSection() {
    const wrap = document.createElement('div');
    wrap.style.marginTop = 'var(--spacing-sm)';
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
