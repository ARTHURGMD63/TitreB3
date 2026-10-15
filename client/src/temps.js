// Dates affichées et calculées dans le fuseau de l'établissement (identique au serveur).
export const FUSEAU = 'Europe/Paris';

const fmtParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: FUSEAU, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
});

export function local(date) {
  const p = Object.fromEntries(fmtParts.formatToParts(date).map((x) => [x.type, x.value]));
  return { a: +p.year, m: +p.month, j: +p.day, h: +p.hour, min: +p.minute };
}

function decalage(ms) {
  const t0 = Math.floor(ms / 60000) * 60000;
  const c = local(new Date(t0));
  return Date.UTC(c.a, c.m - 1, c.j, c.h, c.min) - t0;
}

// Heure locale -> instant UTC
export function versUtc(a, m, j, h = 0, min = 0) {
  const devine = Date.UTC(a, m - 1, j, h, min);
  let t = devine - decalage(devine);
  const corrige = devine - decalage(t);
  if (corrige !== t) t = corrige;
  return new Date(t);
}

// Jour local + décalage de n jours (retourne {a, m, j})
export function jourPlus({ a, m, j }, n) {
  const d = new Date(Date.UTC(a, m - 1, j + n));
  return { a: d.getUTCFullYear(), m: d.getUTCMonth() + 1, j: d.getUTCDate() };
}

export const jourSemaine = ({ a, m, j }) => (new Date(Date.UTC(a, m - 1, j)).getUTCDay() + 6) % 7; // 0 = lundi
export const cle = ({ a, m, j }) => `${a}-${String(m).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
export const aujourdhui = () => local(new Date());
export const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export const enMinutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export const formaterDateHeure = (iso) =>
  new Date(iso).toLocaleString('fr-FR', { timeZone: FUSEAU, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const formaterDate = (iso) =>
  new Date(iso).toLocaleDateString('fr-FR', { timeZone: FUSEAU, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const formaterHeure = (iso) =>
  new Date(iso).toLocaleTimeString('fr-FR', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit' });
export const libelleJour = (jour) =>
  versUtc(jour.a, jour.m, jour.j, 12).toLocaleDateString('fr-FR', { timeZone: FUSEAU, weekday: 'long', day: 'numeric', month: 'long' });
export const libelleMois = (jour) =>
  versUtc(jour.a, jour.m, 15, 12).toLocaleDateString('fr-FR', { timeZone: FUSEAU, month: 'long', year: 'numeric' });

export const STATUTS = {
  en_attente: 'En attente', validee: 'Validée', refusee: 'Refusée', terminee: 'Terminée', annulee: 'Annulée'
};

// Libellés courts pour les tableaux et en-têtes de calendrier
export const jourCourt = (jour) =>
  versUtc(jour.a, jour.m, jour.j, 12).toLocaleDateString('fr-FR', { timeZone: FUSEAU, weekday: 'short' });
export const formaterJourCourt = (iso) =>
  new Date(iso).toLocaleDateString('fr-FR', { timeZone: FUSEAU, weekday: 'short', day: 'numeric', month: 'short' });
export const horaire = (debut, fin) => `${formaterHeure(debut)}–${formaterHeure(fin)}`;
export const ROLES = { utilisateur: 'Utilisateur', responsable: 'Responsable', admin: 'Administrateur' };
