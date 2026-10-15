// Client HTTP de l'API : jeton CSRF automatique, erreurs normalisées.
export class ErreurApi extends Error {
  constructor(statut, corps) {
    super(corps?.erreur || `Erreur ${statut}`);
    this.statut = statut;
    this.corps = corps;
  }
}

function lireCookie(nom) {
  return document.cookie.split('; ').find((c) => c.startsWith(`${nom}=`))?.split('=')[1];
}

async function jetonCsrf() {
  let jeton = lireCookie('csrf_token');
  if (!jeton) {
    await fetch('/api/csrf', { credentials: 'same-origin' });
    jeton = lireCookie('csrf_token');
  }
  return jeton;
}

export async function appeler(methode, url, corps) {
  const options = { method: methode, credentials: 'same-origin', headers: {} };
  if (methode !== 'GET') {
    options.headers['X-CSRF-Token'] = await jetonCsrf();
    if (corps !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(corps);
    }
  }
  const reponse = await fetch(url, options);
  if (reponse.status === 204) return null;
  const donnees = await reponse.json().catch(() => null);
  if (!reponse.ok) {
    // /api/me sert à détecter une session existante au démarrage : un 401 y est normal
    if (reponse.status === 401 && !url.startsWith('/api/auth/') && url !== '/api/me') window.dispatchEvent(new Event('session-expiree'));
    throw new ErreurApi(reponse.status, donnees);
  }
  return donnees;
}

const parametres = (obj) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj || {})) if (v !== undefined && v !== '' && v !== null) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  get: (url, params) => appeler('GET', url + parametres(params)),
  post: (url, corps = {}) => appeler('POST', url, corps),
  put: (url, corps) => appeler('PUT', url, corps),
  patch: (url, corps) => appeler('PATCH', url, corps),
  delete: (url) => appeler('DELETE', url)
};
