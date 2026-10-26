# Jarvis dans Siri (Kora 0.0.41)

« Dis Siri, Tael » (ou Navi, ou le nom choisi), puis la demande à voix haute : « ajoute du lait »,
« la litière est faite », « qu'est-ce qu'on a demain ? ». L'assistant de Kora agit comme dans l'app
et Siri dit sa réponse, sans ouvrir Kora, même l'iPhone verrouillé.

## Sur chaque iPhone, une fois

1. Kora › Réglages › **Siri** : choisir le nom à dire (proposé : Tael pour Dany, Navi pour Sarah),
   puis **Créer le lien de cet iPhone**. La demande pour Raccourcis est copiée.
2. Raccourcis › + › « Décrire un raccourci » : coller. Le raccourci a trois actions : « Demander une
   saisie » (Je t'écoute), « Obtenir le contenu de l'URL » (POST, JSON, champ `demande`) et
   « Énoncer le texte ». Une quatrième redemande une saisie quand la réponse finit par « Oui ou non ? ».
3. Le nom du raccourci est la phrase à dire après « Dis Siri ».

## Des boutons sur l'écran d'accueil (depuis 0.0.66)

Une fois l'iPhone relié, Réglages › Siri propose trois raccourcis prêts (« Aux courses », « Ce soir »,
« Dépense ») : un bouton sur l'écran d'accueil qui envoie une demande toute faite à la même adresse,
sans parler. « Copier » met la demande pour « Décrire un raccourci » dans le presse-papiers ; Raccourcis
propose ensuite « Ajouter à l'écran d'accueil ». Règles : `RACCOURCIS_ECRAN` et `demandeRaccourciEcran`
dans `src/domaine/siri.ts`. Le serveur ne change pas : c'est le même lien que Siri.

## Ce qui change par rapport à l'app

- **Supprimer** attend toujours le oui : Siri pose la question (« Supprimer la tâche … ? Oui ou non ? »)
  et le raccourci réécoute. « Oui » le fait, « non » laisse tout comme avant. La question reste
  valable dix minutes : on peut aussi relancer « Dis Siri, Tael » et dire « oui ».
- **Annuler** : dire « annule » dans les dix minutes défait ce que le dernier tour a fait (comme le
  bouton Annuler de l'app).
- La suite de la conversation (les derniers échanges) est gardée dix minutes : « et des œufs aussi »
  se comprend.
- Pas de photo ni de lien par Siri. Les réponses comptent dans le plafond de 5 CHF par mois.

## Comment ça marche

- `src/domaine/siri.ts` (testé) : relire le foyer depuis les documents du serveur, oui / non /
  annule, les documents à écrire, la phrase à dire, la demande pour Raccourcis. Copié dans
  `supabase/functions/siri/domaine.js` par `npm run fonction`, avec `jarvis.ts` et `jarvisModele.ts`.
- `supabase/functions/siri/` : la fonction serveur. Avec le jeton de la personne (dans le corps JSON, champ `jeton`, depuis 0.0.84 ; l'ancienne forme `?j=` dans l'adresse marche encore mais finit dans les journaux du serveur),
  elle lit le foyer, interroge Claude avec les consignes et les outils de Jarvis, écrit elle-même
  les modifications dans `documents` (les téléphones les reçoivent à l'instant) et répond en texte
  simple. Avec une session du téléphone, elle crée (`lien`) ou efface (`retirer`) le jeton.
- `supabase/schema.sql`, section « Jarvis dans Siri » : `prive.jetons_siri` (empreinte SHA-256 du
  jeton, nom de l'assistant, suite de la conversation) et les fonctions `siri_jeton`, `siri_qui`,
  `siri_suite`, réservées au serveur.

## Déploiement

1. Appliquer la section « Jarvis dans Siri » de `supabase/schema.sql`.
2. Déployer la fonction `siri` (`index.ts`, `domaine.js` et le dossier `_shared`) **sans vérification du JWT** : le
   raccourci n'a pas de session, il présente son jeton. Elle lit le secret `ANTHROPIC_API_KEY` de Jarvis.
