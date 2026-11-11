# 0008 — Deux retouches du même document se rejoignent

**Décidé** le 11 novembre 2026 (Kora 0.1.12, lot 2 du check complet). Complète la fiche
[0003](0003-documents-et-le-plus-recent-gagne.md) : le serveur ne change pas.

**Choix** : chaque modification en attente garde sa **base**, le document tel que le serveur
l'avait à la dernière synchro. Quand la version de l'autre téléphone arrive, le téléphone rejoint
les deux à partir de cette base (`fusionnerDocuments`, `rapprocher` dans `src/domaine/synchro.ts`) :
champ par champ, et élément par élément dans une liste dont chaque élément porte son `id` (ou son
`membreId`). Pour un même champ touché des deux côtés, la plus récente gagne, comme avant. La
réunion repart avec une heure juste après celle du serveur. Le serveur renvoie ce qu'il a refusé
(`Distant.envoyer`) : le téléphone lit alors sa version (`lireDocuments`), rapproche et renvoie.

**Pourquoi** : la fiche de Mitsu, le plan du Budget et le foyer sont de gros documents. L'un pèse
le chat pendant que l'autre coche un soin : avant, la plus ancienne des deux se perdait en entier.
Et un téléphone dont l'horloge retarde voyait ses modifications refusées par le serveur sans rien
dire, puis effacées de sa file d'attente.

**Ce que ça coûte** : la file d'attente garde deux copies du document. Une liste sans `id` (les
prélèvements figés du plan, des listes de mots) reste entière d'un côté ou de l'autre. Une
modification mise en attente avant la 0.1.12, ou au premier partage, n'a pas de base : pour elle,
la plus récente gagne en entier, comme avant.
