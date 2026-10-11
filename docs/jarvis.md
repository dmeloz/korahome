# Jarvis : l'assistant du foyer

Le bouton étoile en haut de l'accueil ouvre Jarvis. On lui écrit, ou on touche le micro et on lui
parle : « ajoute du lait et des œufs », « la litière est faite », « Sarah sort les poubelles samedi »,
« qu'est-ce qui périme bientôt ? ». Il répond en une phrase et agit tout seul ; chaque réponse qui a
changé quelque chose a son bouton **Annuler**. Quand on lui a parlé, il répond aussi à voix haute.

Ce qu'il sait faire (Kora 0.1.0) : ajouter et cocher des courses, créer une tâche (unique ou qui
revient, pour quelqu'un ou libre), marquer une tâche faite, ranger des produits au frigo, au
congélateur ou au placard, noter une pesée de Mitsu, et répondre sur l'état du foyer.
Il ne supprime rien et ne dépense rien. Siri viendra avec l'app native.

## Comment ça marche

- `src/domaine/jarvis.ts` : ses consignes, ses outils, ce qu'il sait du foyer, comment ses actions
  modifient les données, et le plafond de dépense (testé). C'est la règle que reprendra l'app native.
- `src/ui/ecrans/Jarvis.tsx` et `src/ui/jarvis.ts` : la conversation, la voix (reconnaissance et
  synthèse de l'iPhone), l'enregistrement dans le Dépôt et l'annulation.
- `supabase/functions/jarvis/` : la fonction serveur. Elle vérifie que le téléphone est membre du
  foyer, refuse au-delà du plafond, interroge Claude (modèle léger `claude-haiku-5-5`), compte la
  dépense et renvoie la réponse et les actions. Le téléphone vérifie chaque action avant de l'appliquer.
- `supabase/schema.sql`, section « Jarvis » : la table `prive.conso_jarvis` (dépense par foyer et par
  mois) et la fonction `jarvis_compter`, réservée au serveur.

## Le budget

Plafond de **5 CHF par mois** pour tout le foyer : à 80 %, Jarvis l'écrit sous la conversation ; au
plafond, il se tait jusqu'au 1er du mois suivant. Une demande ordinaire coûte moins d'un millième de
franc. Le compte se fait en millionièmes de franc, avec un dollar compté 0,90 CHF (prudent).
Par sécurité, fixer aussi une limite mensuelle sur la console Anthropic (Limits > Spend limit).

## Mise en route (une fois)

1. Sur https://console.anthropic.com : créer une clé d'API (Settings > API keys) et une limite de
   dépense mensuelle.
2. Dans Supabase > Edge Functions > Secrets : ajouter `ANTHROPIC_API_KEY` avec cette clé. Elle ne passe
   jamais par le dépôt ni par un téléphone.
3. Appliquer la section « Jarvis » de `supabase/schema.sql`.
4. Déployer la fonction `jarvis` (fichiers `index.ts` et `domaine.js`, sans vérification JWT : elle
   contrôle elle-même la session du téléphone).

Après une modification de `src/domaine/jarvis.ts` : `npm run fonction`, puis redéployer `jarvis`.
