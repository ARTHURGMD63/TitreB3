// Jeu de données de démonstration (idempotent) : comptes, ressources et quelques réservations.
import bcrypt from 'bcryptjs';
import pg from 'pg';

const motDePasse = process.env.SEED_PASSWORD || 'Demo-Passw0rd!';

const COMPTES = [
  ['admin@exemple.local', 'Alice', 'Admin', 'admin', 'personnel'],
  ['responsable.av@exemple.local', 'Raphaël', 'Audiovisuel', 'responsable', 'personnel'],
  ['responsable.sport@exemple.local', 'Sarah', 'Sport', 'responsable', 'personnel'],
  ['prof@exemple.local', 'Paul', 'Professeur', 'utilisateur', 'enseignant'],
  ['eleve@exemple.local', 'Éloïse', 'Élève', 'utilisateur', 'eleve']
];

export async function peupler(adminUrl) {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const { rows } = await client.query('SELECT count(*)::int AS n FROM utilisateurs');
    if (rows[0].n > 0) return console.log('Données déjà présentes : seed ignoré.');
    const hash = await bcrypt.hash(motDePasse, 12);
    const ids = {};
    for (const [email, prenom, nom, role, profil] of COMPTES) {
      const r = await client.query(
        `INSERT INTO utilisateurs (email, mot_de_passe_hash, prenom, nom, role, profil_quota_id)
         VALUES ($1, $2, $3, $4, $5, (SELECT id FROM profils_quota WHERE code = $6)) RETURNING id`,
        [email, hash, prenom, nom, role, profil]
      );
      ids[email] = r.rows[0].id;
    }
    const av = ids['responsable.av@exemple.local'];
    const sport = ids['responsable.sport@exemple.local'];
    const admin = ids['admin@exemple.local'];
    // nom, type, capacité, lieu, équipements, ouverture, fermeture, validation, responsable
    const ressources = [
      ['Salle de réunion A', 'salle', 12, 'Bâtiment A, 1er étage', ['Écran', 'Visioconférence', 'Tableau blanc'], '08:00', '19:00', false, admin],
      ['Salle de travail', 'salle', 8, 'CDI, rez-de-chaussée', ['Tableau blanc', 'Prises électriques'], '08:00', '18:00', false, admin],
      ['Laboratoire de chimie', 'salle', 24, 'Bâtiment B, 2e étage', ['Paillasses', 'Hotte aspirante'], '08:00', '17:00', true, admin],
      ['Gymnase', 'salle', 60, 'Bâtiment sportif', ['Vestiaires', 'Tribunes'], '08:00', '21:00', true, sport],
      ['Vidéoprojecteur 4K', 'materiel', 1, 'Local audiovisuel', ['HDMI', 'Télécommande'], '08:00', '18:00', true, av],
      ['Lot de 15 ordinateurs portables', 'materiel', 15, 'Local audiovisuel', ['Windows 11', 'Chargeurs'], '08:00', '18:00', true, av],
      ['Caméra de tournage', 'materiel', 1, 'Local audiovisuel', ['Trépied', 'Micro cravate'], '08:00', '18:00', true, av]
    ];
    for (const r of ressources) {
      await client.query(
        `INSERT INTO ressources (nom, type, capacite, localisation, equipements, heure_ouverture, heure_fermeture,
           validation_requise, responsable_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        r
      );
    }
    // Quelques réservations de démonstration (demain et après-demain, de 9h à 11h heure de Paris)
    await client.query(
      `INSERT INTO reservations (ressource_id, utilisateur_id, debut, fin, motif, statut)
       SELECT r.id, $1, (date_trunc('day', now() AT TIME ZONE 'Europe/Paris') + interval '1 day 9 hours') AT TIME ZONE 'Europe/Paris',
              (date_trunc('day', now() AT TIME ZONE 'Europe/Paris') + interval '1 day 11 hours') AT TIME ZONE 'Europe/Paris',
              'Réunion pédagogique', 'validee' FROM ressources r WHERE r.nom = 'Salle de réunion A'`,
      [ids['prof@exemple.local']]
    );
    await client.query(
      `INSERT INTO reservations (ressource_id, utilisateur_id, debut, fin, motif, statut)
       SELECT r.id, $1, (date_trunc('day', now() AT TIME ZONE 'Europe/Paris') + interval '2 days 9 hours') AT TIME ZONE 'Europe/Paris',
              (date_trunc('day', now() AT TIME ZONE 'Europe/Paris') + interval '2 days 11 hours') AT TIME ZONE 'Europe/Paris',
              'Atelier vidéo', 'en_attente' FROM ressources r WHERE r.nom = 'Caméra de tournage'`,
      [ids['eleve@exemple.local']]
    );
    console.log(`Jeu de démonstration créé (mot de passe des comptes : ${motDePasse}).`);
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith('seed.js')) {
  peupler(process.env.DATABASE_ADMIN_URL).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
