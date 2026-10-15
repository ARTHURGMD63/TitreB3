// Crée sur GitHub les étiquettes, les jalons (sprints) et les tickets décrits dans docs/backlog.csv.
//   node scripts/importer-tickets.js             -> simulation : affiche ce qui serait créé
//   node scripts/importer-tickets.js --executer  -> création réelle (nécessite GITHUB_TOKEN)
// Jeton : GitHub > Settings > Developer settings > Fine-grained tokens, dépôt TitreB3,
// permissions « Issues : Read and write » et « Metadata : Read-only ». Il reste dans votre terminal.
// Le script est idempotent : un ticket dont le titre commence par le même identifiant (US1, US2...) n'est pas recréé.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const depot = process.env.GITHUB_REPO || 'ARTHURGMD63/TitreB3';
const jeton = process.env.GITHUB_TOKEN;
const executer = process.argv.includes('--executer');
const fichier = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'backlog.csv');

const COULEURS = {
  'user-story': '0e8a16', securite: 'b60205', environnement: '5319e7', 'base-de-donnees': '1d76db', accessibilite: 'fbca04',
  tests: 'c2e0c6', devops: '0052cc', rgpd: 'd93f0b', documentation: '0075ca', extension: 'cfd3d7',
  'priorite-must': 'b60205', 'priorite-should': 'e99695', 'priorite-could': 'cfd3d7'
};
const PRIORITES = { M: 'priorite-must', S: 'priorite-should', C: 'priorite-could' };

// Lecture d'un CSV à point-virgule avec guillemets (le fichier commence par un BOM UTF-8)
function lireCsv(texte) {
  const lignes = [];
  let ligne = [];
  let champ = '';
  let guillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guillemets) {
      if (c === '"' && texte[i + 1] === '"') { champ += '"'; i++; }
      else if (c === '"') guillemets = false;
      else champ += c;
    } else if (c === '"') guillemets = true;
    else if (c === ';') { ligne.push(champ); champ = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texte[i + 1] === '\n') i++;
      ligne.push(champ); champ = '';
      if (ligne.some((x) => x !== '')) lignes.push(ligne);
      ligne = [];
    } else champ += c;
  }
  if (champ || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  const [entetes, ...donnees] = lignes;
  return donnees.map((l) => Object.fromEntries(entetes.map((e, i) => [e, l[i] ?? ''])));
}

async function api(methode, chemin, corps) {
  const reponse = await fetch(`https://api.github.com/repos/${depot}${chemin}`, {
    method: methode,
    headers: { Authorization: `Bearer ${jeton}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    body: corps ? JSON.stringify(corps) : undefined
  });
  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok && reponse.status !== 422) throw new Error(`${methode} ${chemin} -> ${reponse.status} ${donnees.message || ''}`);
  return { statut: reponse.status, donnees };
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function tout(chemin) {
  const resultat = [];
  for (let page = 1; ; page++) {
    const { donnees } = await api('GET', `${chemin}${chemin.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    resultat.push(...donnees);
    if (donnees.length < 100) return resultat;
  }
}

const lireTexte = async () => {
  const texte = await readFile(fichier, 'utf8');
  return texte.charCodeAt(0) === 0xfeff ? texte.slice(1) : texte; // retire le BOM UTF-8 s'il est présent
};
const tickets = lireCsv(await lireTexte());
const corps = (t) => [
  `**Epic :** ${t.Epic} · **Priorité :** ${t['Priorité']} · **Points :** ${t.Points} · **Sprint :** ${t.Sprint}`,
  '', `### User story\n${t['User story']}`, '',
  `### Critères d'acceptation\n${t["Critères d'acceptation"].split(' ; ').map((c) => `- [ ] ${c.trim()}`).join('\n')}`, '',
  `### Preuves dans le dépôt\n${t['Preuves dans le dépôt']}`
].join('\n');
const jalon = (t) => (/^[1-5]$/.test(t.Sprint) ? `Sprint ${t.Sprint}` : null);
const etiquettes = (t) => [...t['Étiquettes'].split(';').filter(Boolean), PRIORITES[t['Priorité']]];

if (!executer) {
  console.log(`SIMULATION (aucune écriture) : ${tickets.length} tickets vers ${depot}\n`);
  for (const t of tickets) console.log(`${t.ID.padEnd(5)} ${t.Statut.padEnd(9)} ${(jalon(t) || '—').padEnd(9)} ${t.Titre}  [${etiquettes(t).join(', ')}]`);
  console.log('\nPour créer réellement : GITHUB_TOKEN=... node scripts/importer-tickets.js --executer');
  process.exit(0);
}
if (!jeton) { console.error('GITHUB_TOKEN manquant.'); process.exit(1); }

// 1. Étiquettes (une étiquette existante est ignorée)
for (const [nom, couleur] of Object.entries(COULEURS)) await api('POST', '/labels', { name: nom, color: couleur });
// 2. Jalons = sprints
const jalons = new Map((await tout('/milestones?state=all')).map((m) => [m.title, m.number]));
for (let n = 1; n <= 5; n++) {
  if (!jalons.has(`Sprint ${n}`)) jalons.set(`Sprint ${n}`, (await api('POST', '/milestones', { title: `Sprint ${n}`, description: `Sprint ${n} du planning prévisionnel` })).donnees.number);
}
// 3. Tickets (hors demandes d'extraction, qui apparaissent aussi dans /issues)
const existants = (await tout('/issues?state=all')).filter((i) => !i.pull_request);
for (const t of tickets) {
  if (existants.some((i) => i.title.startsWith(`${t.ID} `))) { console.log(`= ${t.ID} existe déjà`); continue; }
  const nom = jalon(t);
  const { donnees } = await api('POST', '/issues', { title: `${t.ID} ${t.Titre}`, body: corps(t), labels: etiquettes(t), milestone: nom ? jalons.get(nom) : undefined });
  if (t.Statut === 'Terminé') await api('PATCH', `/issues/${donnees.number}`, { state: 'closed', state_reason: 'completed' });
  console.log(`+ #${donnees.number} ${t.ID} ${t.Titre}${t.Statut === 'Terminé' ? ' (fermé)' : ''}`);
  await pause(600); // évite les limites de création en rafale
}
console.log('Terminé. Ajoutez les tickets à votre projet : Projects > Add item (recherche « is:issue »).');
