/**
 * Cliente mínimo de la API de contenidos de GitHub — usado por el uploader
 * para publicar el catálogo de estatus como archivos estáticos en el repo
 * (data/estatus_shipments.csv + su metadata), para que cualquier persona
 * que abra la app de auditoría (cualquier dispositivo) lea la misma versión
 * con un fetch normal, en vez de que cada quien tenga su propia copia local.
 *
 * Requiere un token con permiso de escritura sobre ESTE repo únicamente
 * (fine-grained PAT, "Contents: read and write"). El token vive solo en
 * este navegador (localStorage) — igual que el resto del contenido de este
 * repo, este archivo es público, así que nunca debe llevar un token
 * embebido en el código fuente.
 */
class GitHubClient {
  static OWNER = 'isaieduardogarciarubio-lgtm';
  static REPO = 'Auditorias_SVC';
  // TODO: cambiar a 'main' cuando este branch se mergee.
  static BRANCH = 'claude/auditorias-svc-csv-logs-om685f';
  static TOKEN_KEY = 'uploader_github_token';

  static getToken() {
    return localStorage.getItem(this.TOKEN_KEY) || null;
  }

  static setToken(token) {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  static clearToken() {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  static toBase64Utf8(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary);
  }

  /** sha del archivo actual en el repo, o null si todavía no existe. */
  static async getFileSha(path) {
    const token = this.getToken();
    const res = await fetch(
      `https://api.github.com/repos/${this.OWNER}/${this.REPO}/contents/${path}?ref=${this.BRANCH}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `HTTP ${res.status} consultando ${path}`);
    }
    const body = await res.json();
    return body.sha;
  }

  /** Crea o actualiza un archivo del repo con el contenido dado. */
  static async putFile(path, content, message) {
    const token = this.getToken();
    if (!token) throw new Error('Falta configurar el token de GitHub');

    const sha = await this.getFileSha(path);

    const res = await fetch(`https://api.github.com/repos/${this.OWNER}/${this.REPO}/contents/${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        content: this.toBase64Utf8(content),
        branch: this.BRANCH,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `HTTP ${res.status} subiendo ${path}`);
    }
    return res.json();
  }
}
