# Design de l'interface : direction « Registre »

Interface refondue à partir d'un handoff de design (feuille de style finale, prototype et notes d'intégration). Ce document reprend les notes d'intégration, suivies des écarts volontaires avec le prototype, liés au modèle de données réel de l'application.

## Écarts avec le prototype

| Prototype | Application réelle | Raison |
|---|---|---|
| Quota en heures par semaine | Quota en nombre de réservations actives, durée maximale et délai maximal | C'est le modèle de quotas du cahier des charges (voir [06-base-de-donnees.md](06-base-de-donnees.md)) |
| Inscription avec choix du profil (Élève, Enseignant, Externe) | Pas de choix : profil « élève » par défaut, modifiable par un administrateur | Éviter l'auto-attribution de privilèges (voir [11-securite-rgpd-rgaa.md](11-securite-rgpd-rgaa.md)) |
| Mot de passe : 12 caractères | 10 caractères avec majuscule, minuscule et chiffre | Politique implémentée côté serveur |
| Calendrier du lundi au vendredi | Lundi au dimanche | Les ressources peuvent être ouvertes tous les jours |
| Motif obligatoire pour réserver | Motif facultatif | Règle métier du serveur |
| Conflit détecté avant l'envoi | Conflit détecté par le serveur, avec 3 alternatives affichées | Le serveur reste l'arbitre unique (contrainte PostgreSQL) |
| Administration : colonne « Dernière connexion », suppression de ressource | Absentes ; désactivation (maintenance) à la place de la suppression | Pas de donnée correspondante ; les réservations ne sont jamais supprimées |
| Carte de chaleur en taux d'occupation moyen | Réservations par plage de 2 h, en % de la plage la plus chargée | Calculé à partir de l'agrégation SQL disponible |
| Pied de page | Supprimé | Absent du prototype ; l'information RGPD figure dans le consentement à l'inscription et dans « Mon espace » |

Le nom « créneau » (wordmark) est provisoire.

---


Fichiers livrés :
- `style.css` : remplace l'actuel style.css. Aucune dépendance externe, aucune URL `data:`, polices système uniquement, compatible avec une CSP `style-src 'self'`.
- `Prototype.dc.html` : prototype navigable qui charge ce même `style.css`. Le balisage de l'application n'a aucun attribut `style` ; seule la barre de contrôle du prototype (en bas) en contient.

## 1. Direction artistique

Dense et calme, à la manière d'un registre papier : fond crème, encre presque noire, et le vermillon réservé à l'action et à la sélection. Pas d'ombre, sauf sur les dialogues. La hiérarchie vient des graisses, des petites capitales et des chiffres monospace.

| Rôle | Clair | Sombre |
|---|---|---|
| Fond | `#F4F2EC` | `#141311` |
| Surface | `#FFFFFF` | `#1C1B18` |
| Panneau | `#ECE9E1` | `#26241F` |
| Encre | `#1B1A17` | `#EDEAE3` |
| Encre secondaire | `#5C5850` | `#A8A397` |
| Accent (vermillon) | `#C2410C` | `#FF7E4A` |
| Validé / disponible | `#1D6B3A` sur `#E2F1E6` | `#6FD08F` sur `#17301F` |
| En attente | `#6E4600` sur `#FFF1CC`, bord `#9A6200` | `#F2C766` sur `#352A0E`, bord `#E3A92F` |
| Erreur / refusé | `#B42318` sur `#FDECEA` | `#FF8A7A` sur `#3A1A15` |

- **Typographie** : pile système (`ui-sans-serif`, San Francisco, Segoe UI Variable, Roboto…) et `ui-monospace` pour les horaires et les nombres. Échelle 12 / 13 / 14 (texte courant) / 18 / 24 / 30 px. Titres en graisse 680 avec un léger interlettrage négatif. Surtitres en 12 px capitales, interlettrage 0,07 em.
- **Rayons** : 4 px (badges, cases), 6 px (boutons, champs, cartes), 10 px (dialogues).
- **Espacements** : base 4 px (`--e-1` à `--e-8` : 4, 8, 12, 16, 24, 32, 48, 64).
- **Ombres** : une seule, `--ombre-flottant`, réservée aux dialogues.
- **Mouvement** : transitions de 120 ms sur les couleurs. Désactivées par `prefers-reduced-motion`.
- **Thème** : le thème suit `prefers-color-scheme`. `data-theme="clair"` ou `data-theme="sombre"` posé sur `<html>` permet de forcer un thème (option utilisateur facultative).

## 2. Contrastes (WCAG 2.1)

| Paire | Clair | Sombre |
|---|---|---|
| Encre / fond | 15,55 | 15,45 |
| Encre / surface | 17,40 | 14,34 |
| Encre secondaire / surface | 7,08 | 6,85 |
| Encre secondaire / panneau | 5,83 | 6,16 |
| Texte du bouton principal / accent | 5,18 | 7,70 |
| Lien (accent-texte) / surface | 6,00 | 7,94 |
| Badge validée | 5,58 | 7,50 |
| Badge en attente | 7,37 | 8,82 |
| Badge refusée / message d'erreur | 5,75 | 6,85 |
| Bouton danger | 6,57 | 8,41 |
| Case « ma réservation » | 17,40 | 15,45 |
| Texte sur case fermée | 5,47 | 6,54 |
| Bord des champs et boutons (UI, ≥ 3:1) | 3,94 | 3,75 |
| Anneau de focus / fond (UI) | 4,63 | 8,56 |

Aucun état ne repose sur la couleur seule :
- **Calendrier** : chaque état a un motif propre (hachures pour occupé, bord tireté pour en attente, aplat encre pour ma réservation, trame de points pour passé/fermé, aplat accent pour la sélection) et un libellé texte, visible sur la première case du bloc et toujours présent en `sr-only`.
- **Badges** : chacun garde son texte, plus une forme qui lui est propre (pastille pleine, anneau tireté, barre, carré évidé).
- **Messages** : chacun commence par un mot en gras (« Réservation confirmée. », « Créneau indisponible. »), suivi d'une forme (disque pour la confirmation, losange pour l'erreur).

## 3. Correspondance des classes

Toutes les classes existantes sont conservées et gardent le même rôle.

| Classe existante | Traitement |
|---|---|
| `.conteneur` | Largeur max. 1200 px ; marges latérales de 32 px, 16 px sur mobile. Sur `<main>`, pile verticale. |
| `.entete`, `.logo` | En-tête collant. `nav a[aria-current="page"]` est souligné en vermillon. Sur mobile, la navigation passe sur une 2e ligne et défile horizontalement. |
| `.carte` | Surface avec filet de 1 px, sans ombre. Un `h3 > a` rend la carte entière cliquable. |
| `.grille` | `auto-fill`, colonnes de 290 px minimum. |
| `.ligne` | Rangée flex avec retour à la ligne. Les `.champ` enfants s'étirent ; ils passent à 100 % sur mobile. |
| `.champ` | Libellé au-dessus du contrôle, aide dans `<small>`. Erreur signalée par `aria-invalid="true"`. |
| `.bouton`, `button` | Bouton principal (accent). |
| `button.secondaire`, `button.danger`, `.petit` | Inchangés. `.petit` passe à 44 px au doigt. |
| `.badge` et `.badge-validee` / `-en_attente` / `-refusee` / `-annulee` / `-terminee` | Inchangés. |
| `.onglets` | Contrôle segmenté, `button[aria-pressed]`. |
| `.calendrier`, `.cellule`, `.occupe` / `.attente` / `.moi` / `.ferme` / `.choisi` | Inchangés. |
| `.legende`, `.jauge`, `.message`, `.message-ok`, `.message-erreur`, `.defilement`, `.doux`, `.sr-only`, `dialog`, `.actions` | Inchangés. |

**Classes ajoutées** (facultatives, à utiliser au besoin) :
- **Mise en page** : `.pile` (et `.pile.serree`), `.ligne.entre`, `.fiche` (contenu + colonne de 320 px).
- **Typographie** : `.surtitre`, `.mono`, `.icone`.
- **En-tête** : `.compte`, `.avatar`, `.compteur`, `.evitement` (lien d'évitement).
- **Cartes et listes** : `.meta`, `.etiquettes`, `.stat`, `.liste` (`.non-lu`, `.barres`).
- **Badges de disponibilité** : `.badge-dispo`, `.badge-complet`, `.badge-validation`.
- **Calendrier** : `.calendrier.semaine`, `.jour` et `.mois` ; `.cellule.conflit`.
- **Tableaux** : `.empile` (tableau en cartes sur mobile), `.planning`, `.chaleur`.
- **États et navigation** : `.vide`, `.chargement`, `.squelette`, `.pagination`.
- **Boutons et formulaires** : `button.discret`, `button.icone-seule` (bouton carré avec seulement une icône et un `aria-label`), `.case` (case à cocher et son libellé), `main.auth`.

## 4. Modifications de balisage, par composant

1. **Jauge** : une `<div>` dont la largeur est fixée par un attribut `style` est bloquée par la CSP. Utiliser `<progress class="jauge" max="360" value="150">2 h 30 sur 6 h</progress>` (ajouter `.alerte` au-delà de 85 %). Avec Vue : `:value="minutesUtilisees"`.
2. **Calendrier** :
   - garder `<table class="calendrier semaine|jour|mois">` avec un `<caption class="sr-only">` ;
   - en-têtes : `<th scope="col">` pour les jours, `<th scope="row">` pour les horaires, et `aria-current="date"` sur le jour courant ;
   - case libre : `<button type="button" class="cellule" aria-pressed="false" aria-label="Jeudi 22 octobre, 10:00 à 10:30, libre">` ; ajouter `.choisi` et `aria-pressed="true"` quand elle est sélectionnée ;
   - case prise : `<span class="cellule occupe"><span aria-hidden="true">Occupé</span><span class="sr-only">10:00, occupé</span></span>`. Le libellé visible n'apparaît que sur la première case d'un bloc ;
   - envelopper le tableau dans `<div class="defilement" tabindex="0" role="region" aria-label="…">`, pour qu'il défile aussi au clavier.
3. **Tableaux de données** (mes réservations, utilisateurs, ressources, journal) : ajouter `class="empile"` sur `<table>` et `data-label="Statut"` (etc.) sur chaque `<td>`. Sous 720 px, chaque ligne devient une carte libellée.
4. **Carte ressource** : placer le lien dans le titre (`<h3><a href="/ressource/12">Salle B204</a></h3>`) au lieu d'un bouton « Voir ». Toute la carte devient cliquable via `::after`, sans `<a>` englobant.
5. **Icônes** : un sprite SVG inline en début de `<body>` (`<svg class="sprite" width="0" height="0" aria-hidden="true">` avec des `<symbol id="i-…">`), utilisé via `<svg class="icone" aria-hidden="true"><use href="#i-lieu"/></svg>`. Le sprite peut aussi être déplacé dans `icones.svg` servi depuis `'self'`.
6. **Interrupteur « actif »** : `<label class="case"><input type="checkbox" role="switch"> <span>Actif</span></label>`. Le texte change avec l'état.
7. **Dialogues** : `<dialog aria-labelledby="…">`, ouverts avec `showModal()`. Les boutons d'action vont dans `.actions`, l'action principale en dernier. Un motif de refus vide met le `<textarea>` en `aria-invalid="true"` et affiche l'aide en `<small>`.
8. **En-tête** : mettre `aria-current="page"` sur le lien actif. Compteur de demandes : `<span class="compteur"><span class="sr-only">(</span>3<span class="sr-only"> en attente)</span></span>`. Ajouter `<a class="evitement" href="#contenu">Aller au contenu</a>` en premier élément du `<body>`.
9. **Créneaux alternatifs** : en cas de conflit, afficher un `.message.message-erreur` contenant des `button.secondaire.petit` (un par créneau proposé) ; un clic remplit le formulaire.
