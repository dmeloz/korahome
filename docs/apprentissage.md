# Kora apprend de votre usage

Depuis Kora 0.0.20. Tout se calcule sur le téléphone, sans IA et donc sans coût : les règles sont dans `src/domaine/apprentissage.ts` (et `habitudes.ts`, `catalogue.ts`, `mitsu.ts`, `chef.ts` pour ce qui touche chaque module), le lien avec le téléphone dans `src/ui/apprendre.ts` et `src/ui/usage.ts`.

## Ce que Kora observe
- **Le foyer** (données partagées) : les achats cochés sur la liste de courses (rythme, quantité, jour des courses), les fois où une tâche est faite (`historique` : qui, quand, avec quel retard), les produits du stock finis ou jetés périmés (`finis`, `jetes` dans la Base), les paquets de Mitsu finis (`consommations`).
- **La personne du téléphone** (jamais envoyé) : les widgets ouverts et l'heure des tâches faites, dans `localStorage` (`korahome.usage`, 60 jours). Rien de ce qui est tapé.

## Ce qu'il en fait
1. **Bilan du dimanche** (page « Bilan ») : chaque semaine, deux ou trois choses apprises, à garder ou refuser. Gardé ou refusé, un apprentissage du foyer va dans la collection `memoire` (`source: "bilan"`, `cle`, `refuse`) ; un refus n'est jamais relu par Jarvis ni le Chef, il sert seulement à ne pas reproposer. Ce qui est personnel reste dans `korahome.appris`.
2. **« Ce que Tael sait »** (Réglages, `src/ui/ecrans/Memoire.tsx`, le nom suit la fée du téléphone) : une seule page depuis Kora 0.0.50, le bilan en carte en haut, puis trois onglets. « Le foyer » : tout ce qui a été confié, gardé au bilan ou appris par le Chef, à corriger d'un toucher et oublier d'un glissement, avec l'accord pour l'équilibre des tâches. « Rien qu'à toi » : les réglages personnels. « Souhaits » : ce que la fée a noté pour Claude. Ce qu'on dit à la fée sur cette page, elle le retient.
3. **Accueil vivant** : après ce qui presse, les widgets les plus ouverts à ce moment de la journée passent devant. Un widget pas ouvert depuis trois semaines est proposé au retrait au bilan.
4. **Rappels au bon moment** : une heure avant le moment où la personne fait d'habitude ses tâches.
5. **« Comme d'habitude »** sur la liste de courses : le panier du jour des courses en un toucher.
6. **Saisie qui devine** sur la liste de courses : articles déjà achetés et quantité habituelle.
7. **Chef** : cœur ou croix sur chaque plat, retenus dans `memoire` (`cle: chef:aime:…` / `chef:non:…`) ; la fonction `chef` relit la mémoire du foyer chaque semaine.
8. **Mitsu** : « Paquet fini » apprend la vraie consommation ; la prévision s'en sert, et le bilan propose de recaler la commande zooplus.
9. **Gaspillage** : ce qui finit souvent périmé est signalé au bilan et quand on le remet sur la liste.
10. **Équilibre des tâches** : visible sur la page Tâches seulement si tout le foyer a dit oui (`foyer.equilibre`).
11. **Le mot du jour de Jarvis** sur l'accueil, une fois par jour au plus, calculé sur le téléphone.

## Mise en ligne
Après une modification de `chef.ts` ou `mitsu.ts` : `npm run fonction`, puis redéployer les fonctions `chef` et `rappels`. Aucune nouvelle table ni collection.
