/**
 * Consola de depuración visible en pantalla — mismo patrón que ya usa
 * `grid/consolidado_auditoria.html` (ahí porque Grid bloquea DevTools en su
 * iframe; aquí porque quien publica el catálogo normalmente no tiene forma
 * fácil de abrir DevTools tampoco, o simplemente no sabe cómo). Captura
 * errores no atrapados automáticamente y expone `DebugConsole.log(...)`
 * para que el resto del código deje rastro de cada paso (sobre todo útil
 * para diagnosticar fallos del Worker de publicación sin adivinar).
 */
class DebugConsole {
  static entries = [];
  static maxEntries = 300;
  static panelEl = null;
  static bodyEl = null;
  static badgeEl = null;

  static log(message, level = 'info') {
    const ts = new Date().toISOString().split('T')[1].slice(0, 8);
    this.entries.push({ ts, level, message: String(message) });
    if (this.entries.length > this.maxEntries) this.entries.shift();
    this.render();
    if (level === 'error') console.error(message);
    else if (level === 'warn') console.warn(message);
    else console.log(message);
  }

  static escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  static render() {
    if (!this.bodyEl) return;
    const colors = { error: '#ff453a', warn: '#FFD100', info: 'var(--color-text-muted)' };
    this.bodyEl.innerHTML = this.entries
      .map((e) => `<div style="color:${colors[e.level] || colors.info};">[${e.ts}] ${this.escapeHtml(e.message)}</div>`)
      .join('');
    this.bodyEl.scrollTop = this.bodyEl.scrollHeight;

    if (this.badgeEl) {
      const errorCount = this.entries.filter((e) => e.level === 'error').length;
      this.badgeEl.style.display = errorCount > 0 ? 'flex' : 'none';
      this.badgeEl.textContent = errorCount > 9 ? '9+' : String(errorCount);
    }
  }

  static toggle() {
    if (!this.panelEl) return;
    this.panelEl.classList.toggle('open');
  }

  static copyToClipboard() {
    const text = this.entries.map((e) => `[${e.ts}] [${e.level}] ${e.message}`).join('\n');
    navigator.clipboard
      .writeText(text)
      .then(() => this.log('Log copiado al portapapeles', 'info'))
      .catch(() => this.log('No se pudo copiar automáticamente — selecciona el texto manualmente', 'warn'));
  }

  /** Construye el panel + botón flotante y engancha captura global de errores. */
  static setup() {
    const panel = document.createElement('div');
    panel.id = 'debug-console-panel';
    panel.className = 'debug-console-panel';
    panel.innerHTML = `
      <div class="debug-console-header">
        <span>Consola de errores</span>
        <div class="debug-console-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="debug-console-copy">Copiar</button>
          <button type="button" class="btn btn-secondary btn-sm" id="debug-console-close">Cerrar</button>
        </div>
      </div>
      <div class="debug-console-body" id="debug-console-body"></div>
    `;
    document.body.appendChild(panel);
    this.panelEl = panel;
    this.bodyEl = panel.querySelector('#debug-console-body');
    panel.querySelector('#debug-console-copy').addEventListener('click', () => this.copyToClipboard());
    panel.querySelector('#debug-console-close').addEventListener('click', () => this.toggle());

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'debug-console-toggle';
    toggleBtn.title = 'Consola de errores';
    toggleBtn.setAttribute('aria-label', 'Consola de errores');
    toggleBtn.innerHTML = `${Icons.svg('alertCircle', { size: 18 })}<span class="debug-console-badge" id="debug-console-badge"></span>`;
    toggleBtn.addEventListener('click', () => this.toggle());
    document.body.appendChild(toggleBtn);
    this.badgeEl = toggleBtn.querySelector('#debug-console-badge');

    window.addEventListener('error', (e) => {
      this.log(`Error no capturado: ${e.message} (${e.filename}:${e.lineno})`, 'error');
    });
    window.addEventListener('unhandledrejection', (e) => {
      const reason = e.reason && e.reason.message ? e.reason.message : String(e.reason);
      this.log(`Promesa rechazada sin capturar: ${reason}`, 'error');
    });
    this.log('Consola de depuración iniciada', 'info');
  }
}
