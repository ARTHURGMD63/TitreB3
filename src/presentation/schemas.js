// Schémas de validation des entrées (zod) : toute saisie est contrôlée avant d'atteindre la couche métier.
import { z } from 'zod';

const texte = (max) => z.string().trim().max(max);
const date = z.string().datetime({ offset: true, message: 'Date ISO 8601 attendue.' }).transform((s) => new Date(s));
const heure = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format HH:MM attendu.');
const entier = (min, max) => z.coerce.number().int().min(min).max(max);

export const motDePasse = z
  .string()
  .min(10, '10 caractères minimum.')
  .max(72, '72 caractères maximum.')
  .regex(/[a-z]/, 'Au moins une minuscule.')
  .regex(/[A-Z]/, 'Au moins une majuscule.')
  .regex(/\d/, 'Au moins un chiffre.');

export const inscription = z.object({
  email: z.string().trim().toLowerCase().email('Email invalide.').max(254),
  mot_de_passe: motDePasse,
  prenom: texte(80).min(1, 'Prénom requis.'),
  nom: texte(80).min(1, 'Nom requis.')
});

export const connexion = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  mot_de_passe: z.string().min(1).max(200)
});

export const demandeReset = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
export const reset = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), mot_de_passe: motDePasse });

export const filtresRessources = z.object({
  type: z.enum(['salle', 'materiel']).optional(),
  capacite_min: entier(1, 10000).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-JJ attendu.').optional(),
  q: texte(80).optional()
});

export const ressource = z
  .object({
    nom: texte(120).min(2),
    type: z.enum(['salle', 'materiel']),
    capacite: entier(1, 10000),
    localisation: texte(160).default(''),
    equipements: z.array(texte(60).min(1)).max(20).default([]),
    photo_url: z
      .string()
      .trim()
      .max(500)
      .refine((u) => /^https:\/\/[^\s]+$/.test(u) || /^\/img\/[\w./-]+$/.test(u), 'URL https ou chemin /img/ attendu.')
      .nullish(),
    heure_ouverture: heure,
    heure_fermeture: heure,
    validation_requise: z.boolean().default(false),
    responsable_id: z.number().int().positive().nullish()
  })
  .refine((r) => r.heure_fermeture > r.heure_ouverture, { message: "La fermeture doit suivre l'ouverture.", path: ['heure_fermeture'] });

export const activation = z.object({ active: z.boolean(), motif: texte(200).optional() });

export const reservation = z.object({
  ressource_id: z.number().int().positive(),
  debut: date,
  fin: date,
  motif: texte(300).default('')
});

export const modificationReservation = z.object({ debut: date, fin: date, motif: texte(300).default('') });

export const decision = z.object({ decision: z.enum(['validee', 'refusee']), motif: texte(300).optional() });

export const periodeReservations = z.object({ periode: z.enum(['avenir', 'passe', 'tous']).default('avenir') });

export const intervalle = z.object({ du: date, au: date });
export const intervalleJours = z.object({
  du: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  au: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const majUtilisateur = z
  .object({
    role: z.enum(['utilisateur', 'responsable', 'admin']).optional(),
    profil_quota_id: z.number().int().positive().optional(),
    actif: z.boolean().optional()
  })
  .strict();

export const majProfil = z
  .object({
    libelle: texte(80).min(1).optional(),
    max_reservations_actives: entier(1, 100).optional(),
    duree_max_minutes: entier(30, 1440).optional(),
    delai_max_jours: entier(1, 365).optional()
  })
  .strict();

export const filtresAudit = z.object({
  acteur_id: entier(1, 1e9).optional(),
  action: z.string().regex(/^[A-Z_]{3,40}$/).optional(),
  entite: z.enum(['utilisateur', 'reservation', 'ressource', 'profil_quota', 'email']).optional(),
  du: z.string().datetime({ offset: true }).optional(),
  au: z.string().datetime({ offset: true }).optional(),
  page: entier(1, 10000).default(1)
});

export const idParam = z.object({ id: z.coerce.number().int().positive() });
