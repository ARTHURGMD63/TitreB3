// Utilitaires de dates avec gestion du fuseau horaire de l'établissement.
const formats = new Map();

function formateur(fuseau) {
  if (!formats.has(fuseau)) {
    formats.set(
      fuseau,
      new Intl.DateTimeFormat('en-GB', {
        timeZone: fuseau,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    );
  }
  return formats.get(fuseau);
}

// Décompose un instant UTC en composantes locales (année, mois, jour, heure, minute).
export function composantesLocales(date, fuseau) {
  const p = Object.fromEntries(formateur(fuseau).formatToParts(date).map((x) => [x.type, x.value]));
  return { a: +p.year, m: +p.month, j: +p.day, h: +p.hour, min: +p.minute };
}

function decalageMs(instantMs, fuseau) {
  const t0 = Math.floor(instantMs / 60000) * 60000;
  const c = composantesLocales(new Date(t0), fuseau);
  return Date.UTC(c.a, c.m - 1, c.j, c.h, c.min) - t0;
}

// Convertit une heure locale (ex. 8h00 à Paris) en instant UTC.
export function localVersUtc(a, m, j, h, min, fuseau) {
  const devine = Date.UTC(a, m - 1, j, h, min);
  let t = devine - decalageMs(devine, fuseau);
  const corrige = devine - decalageMs(t, fuseau);
  if (corrige !== t) t = corrige;
  return new Date(t);
}

// "08:30" ou "08:30:00" -> minutes depuis minuit
export function heureEnMinutes(texte) {
  const [h, m] = texte.split(':').map(Number);
  return h * 60 + m;
}

export const minutesDepuisMinuit = (date, fuseau) => {
  const c = composantesLocales(date, fuseau);
  return c.h * 60 + c.min;
};

export const memeJourLocal = (d1, d2, fuseau) => {
  const a = composantesLocales(d1, fuseau);
  const b = composantesLocales(d2, fuseau);
  return a.a === b.a && a.m === b.m && a.j === b.j;
};

export const ajouterMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60000);
export const ajouterJours = (date, jours) => new Date(date.getTime() + jours * 86400000);
