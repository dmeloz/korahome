# Retours de test

Depuis Kora 0.0.2, chaque version se teste sur l'iPhone et revient à Claude sous forme d'un rapport.

## Sur l'iPhone

1. Sur n'importe quel écran, toucher la pastille **Dev** en bas à droite.
2. Choisir **Bug**, **Gêne** ou **Idée**, écrire (ou dicter) la note, **Enregistrer**.
   La note retient seule l'écran, la version, qui l'a écrite, la date et l'heure.
3. Quand l'essai est fini : **Réglages > Retours de test > Envoyer le rapport au Mac**.
   Si le Mac ne répond pas : **Partager** (Messages, Notes, Fichiers…) ou **Copier**, puis coller dans la conversation.
4. Quand une correction est vérifiée, toucher le rond de la note pour la marquer **réglée**.
   Le rapport suivant ne reprend en détail que les notes encore ouvertes.

La pastille peut être masquée dans Réglages (« Pastille « Dev » sur chaque écran »).

## Ce que contient le rapport

- La version, l'appareil, l'app installée ou ouverte dans Safari.
- Les notes ouvertes, rangées par écran, chacune avec les six derniers gestes qui l'ont précédée.
- La liste des notes réglées.
- Le journal discret des 14 derniers jours (150 dernières lignes) : ouvertures de l'app, écrans visités,
  boutons touchés (leur libellé) et erreurs. Le texte tapé dans les champs n'y figure jamais.

Le journal reste sur le téléphone (400 événements au plus) et ne part qu'avec le rapport, par un geste.

## Sur le Mac

`npm run serveur` (et `npm run dev`) reçoivent le rapport sur `/__kora/retours` et l'écrivent dans
`retours-de-test/` à la racine du projet, ignoré par Git :

- `kora-<version>-<date et heure>.md` : un fichier par envoi, gardé ;
- `dernier-rapport.md` : toujours le plus récent.

Le serveur choisit seul le nom du fichier, n'accepte qu'un texte qui commence par `# Rapport Kora x.y.z`,
d'1 Mo au plus, venant de l'app elle-même. Un autre dossier peut être choisi avec `KORAHOME_RETOURS=/chemin`.

Plus tard, avec la synchronisation, les notes des deux iPhones arriveront au même endroit (le dépôt `Depot`
les porte déjà) ; le journal, lui, reste propre à chaque téléphone.
