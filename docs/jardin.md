# Le jardin

Le widget **Jardin** ouvre la page du jardin du foyer (Kora 0.0.15).

- **Zones** : un pot, une jardinière, un bac ou de la pleine terre, avec son soleil (plein soleil
  6 h et plus, mi-ombre 3 à 6 h, ombre ; l'app Shadowmap aide à le mesurer) et son abri (dehors,
  sous un toit, dedans). On y écrit ses plantes comme on les dit : « tomates cerises » est reconnue.
- **Arrosage** : le rythme d'été de la plante la plus assoiffée, allongé l'hiver et pour un grand
  contenant, raccourci par forte chaleur. Dehors, une pluie d'au moins 5 mm compte comme un
  arrosage, et une pluie annoncée aujourd'hui ou demain dispense d'arroser. Le bouton « Arrosé »
  le note pour tout le foyer.
- **Gel** : sous 2 °C annoncés pour les deux nuits qui viennent, l'app demande de rentrer ou couvrir
  les plantes frileuses (et toutes les plantes en pot sous −5 °C). Le widget remonte en haut.
- **Calendrier** : ce qu'il faut semer, planter et récolter ce mois-ci, le conseil de saison (Saints
  de glace mi-mai) et des idées qui conviennent au soleil des zones, ajoutées d'un toucher.
- **Photo** : Jarvis reconnaît une plante et l'ajoute à la zone choisie (foyer partagé, compte dans
  le plafond de 5 CHF). Jarvis sait aussi « ajoute du persil au balcon » et « j'ai arrosé ».
- **Rappel du matin** : le gel et les zones à arroser, réglables dans Notifications.

## Comment c'est construit

- `src/domaine/plantes.ts` : une quarantaine de plantes du plateau vaudois (soleil, arrosage,
  gel, calendrier, conseil) et la reconnaissance d'un nom écrit.
- `src/domaine/jardin.ts` : zones, arrosage, gel, chaleur, calendrier (testés).
- `src/domaine/meteo.ts` : Open-Meteo (gratuit, sans clé) pour Renens, deux jours passés et sept à
  venir. Le téléphone la lit (`src/ui/meteo.ts`, gardée 3 heures, ignorée après 12 heures) ; la
  fonction `rappels` la lit à chaque passage.
- Collection partagée `jardin` (un document par zone) : la contrainte de la table `documents` doit
  l'accepter (`supabase/schema.sql`) avant la mise en ligne, sinon la synchro est refusée.
- Le plan dessiné des zones viendra quand les bacs seront installés.
