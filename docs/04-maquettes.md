# Compétence 5 (suite) — Maquettes, accessibilité et éco-conception

Les maquettes ci-dessous sont des *wireframes* basse fidélité. Elles ont servi de base à l'interface réelle (`public/`), qui peut être comparée directement : lancer `npm run dev` puis ouvrir <http://localhost:3000>.

## Principes de conception

- **Mobile first**, un seul gabarit adaptatif (grille CSS, tableaux à défilement horizontal).
- Une action principale par écran, libellés explicites (« Voir les créneaux », « Réserver »).
- Les états ne reposent **jamais sur la couleur seule** : chaque état a un texte et un motif.
- Retour d'information systématique : message de confirmation ou d'erreur annoncé par un lecteur d'écran (`aria-live`).

## Maquette 1 — Connexion

```
┌────────────────────────────────────────────────────────────┐
│ Réservations                          [Connexion][Inscription]│
├────────────────────────────────────────────────────────────┤
│  Connexion                                                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Adresse email *                                     │    │
│  │ [____________________________________________]      │    │
│  │ Mot de passe *                                      │    │
│  │ [____________________________________________]      │    │
│  │ [ Se connecter ]                                    │    │
│  │ Créer un compte · Mot de passe oublié ?             │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────┘
```

## Maquette 2 — Catalogue

```
┌────────────────────────────────────────────────────────────┐
│ Réservations   Catalogue  Mon espace  [Responsable] [Admin]  Déconnexion │
├────────────────────────────────────────────────────────────┤
│ Catalogue des ressources                                    │
│ ┌ Filtrer ─────────────────────────────────────────────┐   │
│ │ Type [Tous ▾] Capacité min [__] Disponible le [date] Recherche [___] [Filtrer] │
│ └──────────────────────────────────────────────────────┘   │
│ 7 ressource(s) trouvée(s).                                  │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐               │
│ │ Gymnase    │ │ Labo chimie│ │ Salle A    │               │
│ │ Salle · 60 │ │ Salle · 24 │ │ Salle · 12 │               │
│ │ [Disponible][Validation]  │ │ [Disponible]│               │
│ │ [Voir les créneaux]       │ │ [Voir …]    │               │
│ └────────────┘ └────────────┘ └────────────┘               │
└────────────────────────────────────────────────────────────┘
```

## Maquette 3 — Fiche ressource, calendrier et réservation

```
┌────────────────────────────────────────────────────────────┐
│ ← Retour au catalogue                                       │
│ Salle de réunion A                                          │
│ Salle · capacité 12 · Bâtiment A · ouverte 08:00–19:00       │
│ ┌ Réserver un créneau ─────────────────────────────────┐   │
│ │ Quota : 8 réservation(s) restante(s) sur 10 …           │   │
│ │ Date [__/__/____] Début [09:00▾] Fin [10:00▾] Motif [____] │
│ │ [ Réserver ]                                            │   │
│ │ ┌ Créneaux proches disponibles (si conflit) ─────────┐ │   │
│ │ │ [mardi 14 oct., de 10:00 à 11:00] [..] [..]         │ │   │
│ │ └──────────────────────────────────────────────────────┘ │   │
│ └────────────────────────────────────────────────────────┘   │
│ [← Précédent][Aujourd'hui][Suivant →]       [Jour][Semaine][Mois]│
│ Semaine du lundi 12 au dimanche 18 octobre                    │
│ ┌──────┬─────────┬─────────┬─────────┬──── …                 │
│ │Heure │ lun. 12 │ mar. 13 │ mer. 14 │                        │
│ ├──────┼─────────┼─────────┼─────────┤                        │
│ │08:00 │ Passé   │ Libre   │ Libre   │   Libre = bouton       │
│ │09:00 │ Passé   │ Occupé  │ Libre   │   Occupé = rayé rouge  │
│ │10:00 │ Passé   │ En attente│ Ma rés.│   Attente = rayé orange│
│ └──────┴─────────┴─────────┴─────────┘   Ma réservation = bleu│
└────────────────────────────────────────────────────────────┘
```

## Maquette 4 — Mon espace

```
┌────────────────────────────────────────────────────────────┐
│ Mon espace                                                  │
│ ┌ Mon quota ───────────────────────────────────────────┐   │
│ │ Profil : Enseignant. Actives : 2 sur 10 (8 restantes).  │   │
│ │ [▓▓░░░░░░░░]                                            │   │
│ └────────────────────────────────────────────────────────┘   │
│ Mes réservations   [À venir] [Passées]                      │
│ Ressource | Créneau | Motif | Statut | Actions              │
│ Salle A   | mer. 14 oct. 09:00 → 11:00 | Réunion | Validée | [Modifier][Annuler] │
│ Caméra    | …                          | Atelier | En attente | [Annuler]        │
│ Notifications · Mes données personnelles (RGPD) [Exporter][Supprimer mon compte]│
└────────────────────────────────────────────────────────────┘
```

## Maquette 5 — Espace responsable

```
┌────────────────────────────────────────────────────────────┐
│ Espace responsable                                          │
│ Demandes à traiter                                          │
│ ┌ Caméra de tournage ───────────────────────────────────┐   │
│ │ Éloïse Élève (eleve@exemple.local)                       │   │
│ │ ven. 16 oct. 09:00 → 11:00 · Motif : Atelier vidéo       │   │
│ │ [ Valider ] [ Refuser ]  → boîte de dialogue : motif *    │   │
│ └────────────────────────────────────────────────────────┘   │
│ Planning des 14 prochains jours (tableau)                   │
└────────────────────────────────────────────────────────────┘
```

## Maquette 6 — Administration

```
┌────────────────────────────────────────────────────────────┐
│ Administration                                              │
│ [Utilisateurs][Ressources][Quotas][Statistiques][Journal d'audit] │
│ Utilisateur | Rôle [▾] | Profil de quota [▾] | ☑ Actif | [Enregistrer] │
│ Statistiques : période → occupation par ressource (jauges),  │
│ plus demandées, créneaux saturés, annulations                │
└────────────────────────────────────────────────────────────┘
```

## Accessibilité (RGAA 4)

| Critère RGAA | Mise en œuvre |
|---|---|
| 1.1 Images | Alternative textuelle sur les photos, favicon décoratif |
| 3.2 Contrastes | Texte ≥ 4,5:1 ; palette définie dans `:root` de `public/css/style.css` |
| 3.1 Information par la couleur | Statuts toujours accompagnés d'un texte ; calendrier avec motifs rayés |
| 5.x Tableaux | `<caption>`, `<th scope="col|row">` ; le calendrier est un vrai tableau |
| 6.x Liens | Intitulés explicites, texte masqué complétant les boutons répétés (« Annuler *Salle A* ») |
| 7.x Scripts | Tout est utilisable sans souris ; focus déplacé sur le titre à chaque changement de page ; messages `role=status` / `role=alert` |
| 8.x Éléments obligatoires | `lang="fr"`, titre de page dynamique, un seul `<h1>` par page |
| 9.x Structure | Repères `banner`, `nav`, `main`, `contentinfo` ; hiérarchie de titres ; lien d'évitement « Aller au contenu principal » |
| 10.x Présentation | Texte redimensionnable (unités relatives), `prefers-reduced-motion` respecté, focus visible (contour orange 3 px) |
| 11.x Formulaires | Chaque champ a un `<label>` lié, champs obligatoires marqués, aide associée par `aria-describedby`, erreurs annoncées |
| 12.x Navigation | Navigation principale cohérente, lien d'évitement ; boîtes de dialogue natives `<dialog>` (focus piégé, fermeture par Échap) |

Contrôle recommandé avant livraison : parcours complet au clavier, lecteur d'écran (NVDA), extensions axe DevTools / WAVE, test à 200 % de zoom.

## Éco-conception

| Pratique | Application |
|---|---|
| Sobriété des ressources | Aucune bibliothèque ni framework, aucune police externe, ≈ 67 Ko de fichiers non compressés |
| Transfert réduit | Compression gzip, cache HTTP (`ETag`, `max-age` en production) |
| Images | Chargement différé (`loading="lazy"`), dimensions déclarées ; la fiche fonctionne sans image |
| Peu de requêtes | Un seul fichier CSS, modules JavaScript chargés à la demande par le navigateur |
| Calcul côté base | Agrégats statistiques calculés par PostgreSQL (une requête), pas de boucle applicative |
| Durée de vie des données | Journal d'audit purgé automatiquement (index TTL) |
