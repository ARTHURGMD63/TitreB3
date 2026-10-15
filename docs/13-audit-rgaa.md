# Audit d'accessibilité (RGAA / WCAG 2.2 AA)

Document de suivi du ticket #20. Il sépare ce qui a été **vérifié automatiquement** (résultats ci-dessous) de ce qui reste à **vérifier à la main** (grilles à compléter), car un outil automatique ne détecte qu'une partie des critères (environ un tiers à la moitié).

## 1. Audit automatique avec axe-core

| | |
|---|---|
| Outil | [axe-core](https://github.com/dequelabs/axe-core) 4.14.0 (devDependency du projet) |
| Règles | Étiquettes `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` et `best-practice` |
| Application | Interface Vue en mode développement (Vite), connectée avec le compte administrateur de démonstration pour atteindre toutes les pages |
| Largeurs testées | 1200 px (bureau) et 375 px (mobile) |
| Pages et états | Connexion, inscription, mot de passe oublié, réinitialisation, catalogue, fiche ressource (vues semaine, jour, mois, avec une case sélectionnée), Mon espace, Demandes, Administration (5 onglets) |

### Résultat final

| Largeur | Pages auditées | Violations |
|---|---:|---:|
| 1200 px | 15 (4 pages publiques + 11 vues applicatives) | **0** |
| 375 px | 13, aucun débordement horizontal de la page | **0** |

Chaque page passe entre 38 et 47 règles. Une règle reste « à vérifier » (`color-contrast`) sur certaines pages : axe ne peut pas calculer le contraste sur les fonds à motifs (hachures et trame de points du calendrier). Ces contrastes sont couverts par le calcul fourni avec le design (texte ≥ 4,5:1 et éléments d'interface ≥ 3:1 dans les deux thèmes), voir [12-design-registre.md](12-design-registre.md).

### Défauts trouvés puis corrigés

| # | Défaut | Règle | Correction |
|---|---|---|---|
| 1 | Sur le catalogue, l'ordre des titres sautait de `h1` à `h3` (cartes des ressources) | `heading-order` (WCAG 1.3.1) | Ajout d'un titre `h2` « Ressources » masqué visuellement avant la grille |
| 2 | Sur le calendrier mensuel, le nom accessible des jours ne contenait pas le texte visible (« 15 », « 4 libres ») | `label-content-name-mismatch` (WCAG 2.5.3) | Suppression de l'`aria-label` ; le nom vient du contenu visible complété par un texte réservé aux lecteurs d'écran |
| 3 | Les tableaux qui défilent horizontalement n'étaient pas atteignables au clavier | `scrollable-region-focusable` (WCAG 2.1.1) | `tabindex="0"`, `role="region"` et `aria-label` sur chaque zone de défilement |

Note de méthode : un premier passage avec le volet de test masqué (largeur 0) avait signalé une taille de cible insuffisante dans le calendrier mensuel. C'était un artefact de mesure ; le défaut a disparu avec une largeur réelle. Les mesures finales ci-dessus sont faites à largeur réelle.

### Reproduire l'audit

1. `npm run dev` (serveur) et `npm run dev:client` (Vite, port 5173, sans politique CSP, ce qui permet d'injecter axe).
2. Ouvrir <http://localhost:5173>, se connecter en administrateur de démonstration.
3. Dans la console du navigateur, charger `node_modules/axe-core/axe.min.js` (balise `<script>` pointant vers `/@fs/...`) puis exécuter `axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice'] } })` sur chaque page.

## 2. Vérifications manuelles (à compléter)

À faire avec le clavier seul puis avec un lecteur d'écran (NVDA, gratuit). Noter ✔ ou ✘ et une remarque.

### Navigation au clavier (sans souris)

| # | Parcours | Résultat | Remarque |
|---|---|---|---|
| K-01 | Lien d'évitement « Aller au contenu » : Tab depuis le haut de la page, Entrée | | |
| K-02 | Connexion complète : champs, bouton, lien « Mot de passe oublié » | | |
| K-03 | Navigation principale : Tab sur chaque lien, Entrée ; le lien actif est repérable | | |
| K-04 | Catalogue : filtres (champs, boutons Tout/Salles/Matériel), ouverture d'une fiche avec Entrée sur le titre | | |
| K-05 | Calendrier : atteindre une case libre, la choisir (Entrée / Espace), étendre la plage, changer de vue | | |
| K-06 | Réserver : remplir le formulaire, envoyer, lire le message de confirmation | | |
| K-07 | Mon espace : onglets À venir / Passées, Modifier (boîte de dialogue), Annuler | | |
| K-08 | Boîtes de dialogue : le focus reste dans la boîte, Échap la ferme, le focus revient au bouton d'origine | | |
| K-09 | Administration : changer d'onglet, modifier un rôle dans un tableau, ouvrir « Ajouter une ressource » | | |
| K-10 | Aucun piège au clavier ; le contour de focus est toujours visible | | |

### Lecteur d'écran (NVDA + Firefox ou Chrome)

| # | Contrôle | Résultat | Remarque |
|---|---|---|---|
| L-01 | Chaque page annonce son titre et son `h1` au changement de page | | |
| L-02 | Les champs de formulaire sont annoncés avec leur libellé et leur aide | | |
| L-03 | Les messages de confirmation ou d'erreur sont annoncés sans déplacer le focus | | |
| L-04 | Calendrier : une case libre est annoncée avec le jour, l'heure et « libre » ; une case prise avec son état | | |
| L-05 | Les badges de statut sont compris sans la couleur (texte lu) | | |
| L-06 | Les tableaux sont annoncés avec leurs en-têtes (navigation cellule par cellule) | | |
| L-07 | Les boutons répétés (Annuler, Modifier) précisent la ressource concernée | | |

### Contrôles complémentaires

| # | Contrôle | Résultat |
|---|---|---|
| Z-01 | Zoom du navigateur à 200 % : aucune perte de contenu ni de fonction | |
| Z-02 | Texte agrandi à 200 % dans les réglages du navigateur | |
| Z-03 | Thème sombre : lisibilité et focus visibles | |
| Z-04 | Mouvement réduit (réglage du système) : plus d'animation | |
