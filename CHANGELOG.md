# Journal des versions

Une ligne par version de Kora publiée, la plus récente en haut : ce qu'elle apporte, en une phrase,
et la PR qui l'a faite. Chaque PR qui change le numéro dans `package.json` ajoute sa ligne ici (un
test le vérifie). Le détail de chaque version est dans sa PR ; les règles durables, dans `docs/`.

| Version | Date | Ce qu'elle apporte | PR |
| --- | --- | --- | --- |
| 0.1.6 | 2026-11-11 | Audit des gestes : le trait « fait » se pose bien sous la bulle de Tael, les cartes de Cuisine, d'Organisation et de Maison respirent aussi (plus seulement Aujourd'hui), la vibration vient sous le doigt et non après le souffle, « déjà sur la liste » ne tremble plus ; glisser « Faite », « C'est fait » et « Choisir puis Faites » respirent, le sceau vient aussi dans la page Tâches, le Conseiller du Budget prend le liseré ; les lignes cochées se lisent mieux (contraste) ; l'essai joue maintenant les gestes. | #130 |
| 0.1.5 | 2026-11-11 | Un langage de gestes, court et en laiton : ce qu'on coche (courses, tâches) respire avant de partir, les cartes que Tael vient de toucher respirent l'une après l'autre avec un trait « fait », un liseré fait le tour de sa bulle pendant qu'elle travaille et se referme quand elle a fini, une erreur tremble, et un sceau se dessine quand la liste ou la journée est finie (les confettis et leur bibliothèque partent). Rien ne bouge si l'iPhone demande moins d'animations. | #128 |
| 0.1.4 | 2026-11-10 | Check complet : les graphiques de Budget › Analyse (année des factures, courses des six mois) retrouvent leur taille, la carte qui propose (« Étaler sur la semaine », « Le bilan de la semaine », Sauvegarde, « Comme d'habitude ») et la feuille de l'heure d'une tâche retrouvent leur mise en page perdue à la refonte, la carte d'Organisation dit « En retard de 2 jours » une seule fois ; Tael répond aussi quand on touche son orbe dans Réglages et ses pages ; « 15 un livre » ne paie plus Sunrise (une charge se reconnaît à un mot entier) ; la prévision des factures ne recompte plus une facture du mois déjà payée ; le scanner du Frigo ne relance plus l'appareil photo chaque minute ; deux « Envoyer » de suite n'ajoutent plus deux fois | [#127](https://github.com/dmeloz/korahome/pull/127) |
| 0.1.3 | 2026-11-10 | Veille de la nuit : le grand chiffre « À toi ce mois » d'Aujourd'hui et du Budget est celui de l'anneau (arrondi pareil, 3’002 au lieu de 3001), l'anneau du compte commun (onglet Charges) retrouve sa carte et sa légende lisible, VoiceOver lit le trajet du salaire, la rangée d'un paiement en devises se fait défiler au clavier, l'essai sur iPhone passe aussi le Budget rempli ; outils à jour (oxlint 1.93, motion 14.11.1, vite 8.3.7, rolldown 1.3.1) | [#126](https://github.com/dmeloz/korahome/pull/126) |
| 0.1.2 | 2026-11-06 | Veille de la nuit : dans Maison, les cartes Carnet et « Où est quoi » (et « Ce soir » des poubelles) ouvrent l'Entretien directement sur leur carte, plus en haut de la page ; l'essai sur iPhone le vérifie ; outils à jour | [#125](https://github.com/dmeloz/korahome/pull/125) |
| 0.1.1 | 2026-11-04 | Guide de première ouverture (cinq pages feuilletées, une fois par téléphone, aussi pour un foyer neuf) ; en le fermant, le téléphone oublie ce que Kora avait appris de son usage et repart comme neuf, réglages gardés ; le foyer Cassa est reparti à zéro sur le serveur, plan du budget gardé (demande de Melo du 4 novembre) | [#124](https://github.com/dmeloz/korahome/pull/124) |
| 0.1.0 | 2026-11-04 | Refonte complète de l'interface (validée par Melo le 4 novembre) : six espaces en pages de cartes graphite et laiton, sombre par défaut, un seul bouton Kora en bas à gauche qui déploie les espaces (rail sur iPad et Duo ouvert), chaque page d'un espace ouverte depuis sa carte, Tael qui vient à toi (orbe à côté du salut et dans la barre du haut, sa carte, trois niveaux d'autonomie et son journal avec Annuler), Réglages avec Nos mots et Chez nous ; l'ancien accueil, la capsule, le hub iPad, la visite guidée et la fée flottante sont retirés | [#123](https://github.com/dmeloz/korahome/pull/123) |
| 0.0.101 | 2026-11-03 | Veille de la nuit : l'onglet Administratif a sa propre aide (les démarches et les contrats, plus celle des tâches), l'essai sur iPhone passe aussi la nouvelle interface (capsule, trois vues, sombre et clair) et sept outils se mettent à jour (Motion 14.9, oxlint, Vitest, rolldown) | [#122](https://github.com/dmeloz/korahome/pull/122) |
| 0.0.100 | 2026-11-02 | Nouvelle interface, en essai par téléphone (Réglages › Apparence) : la capsule vivante remplace la fée flottante en bas (ce qui compte maintenant avec son fil laiton, glisser pour Aujourd'hui, Courses et Nous, toucher pour ouvrir, pousser vers le haut pour « Tout Kora », l'orbe de la fée pour parler) ; Aujourd'hui devient un fil de moments en une colonne et la nouvelle page Nous réunit le dernier mot, ce qui te reste ce mois en une phrase et la semaine à deux | [#121](https://github.com/dmeloz/korahome/pull/121) |
| 0.0.99 | 2026-11-02 | « Choisir » dans les Tâches : en mettre plusieurs à demain, faites ou retirées d'un geste, comme dans les Courses ; la barre du mode « Choisir » reste visible même saisie de la fée fermée (elle était invisible dans les Courses) | [#120](https://github.com/dmeloz/korahome/pull/120) |
| 0.0.98 | 2026-11-02 | « Ce soir on a mangé » dans Cuisine › Menus : une ligne par soir, écrite ou dite à la fée, même sans le Chef ; une recette du même nom compte comme cuisinée, et le Chef lit ces soirs pour varier | [#119](https://github.com/dmeloz/korahome/pull/119) |
| 0.0.97 | 2026-10-30 | Veille du 30 octobre : le conseiller du Budget répond de nouveau (le serveur forçait son outil, refusé par Claude depuis les modèles 5.5) ; un test interdit désormais l'outil forcé dans toutes les fonctions | [#118](https://github.com/dmeloz/korahome/pull/118) |
| 0.0.96 | 2026-10-29 | Suites invisibles de l'audit : pastille Dev et retours de test cachés sauf sur le téléphone qui les allume (cinq touchers sur la version), scanner chargé au premier scan, Netlify retiré, règles React du lint rallumées (globals, immutability), serveur : horloge des conflits bornée, agenda réécrit seulement s'il change, purges, sauvegarde hebdomadaire | [#117](https://github.com/dmeloz/korahome/pull/117) |
| 0.0.95 | 2026-10-28 | Hub Kora sur iPad : dès 760 points de large, l'accueil devient six cartes (ce soir, au menu, courses, demain, mot de l'autre, balcon) sur la grille large commune | [#114](https://github.com/dmeloz/korahome/pull/114) |
| 0.0.94 | 2026-10-28 | Réserve de secours dans Cuisine › Frigo : la liste de la Confédération pour une semaine à deux, comparée au stock, le manquant aux courses ; le Chef n'y puise pas | [#113](https://github.com/dmeloz/korahome/pull/113) |
| 0.0.93 | 2026-10-28 | Rangements « Où est quoi » dans Maison › Entretien : un lieu et ce qu'il contient, trouvé par la recherche et par la fée (« où est la perceuse ? ») | [#112](https://github.com/dmeloz/korahome/pull/112) |
| 0.0.92 | 2026-10-28 | iPhone Duo, premier lot : rien ne passe sous la colonne de l'heure de l'écran plié, saisie de la fée protégée après un pli, verrou du Budget qui parle aussi de Touch ID | [#110](https://github.com/dmeloz/korahome/pull/110) |
| 0.0.91 | 2026-10-28 | Abonnements et contrats dans Organisation › Administratif : fin, préavis, « Résilier Sunrise avant le 30 novembre » sur l'accueil et dans le rappel du matin | [#111](https://github.com/dmeloz/korahome/pull/111) |
| 0.0.89 | 2026-10-28 | Accueil : en grandes lettres, les quatre chiffres en deux rangées de deux ; « Plus que 5 étapes » quand une étape est faite ; les points de « Ce soir » plus faciles à toucher | [#109](https://github.com/dmeloz/korahome/pull/109) |
| 0.0.88 | 2026-10-27 | Veille du 27 octobre : un soin de Mitsu rappelé dans « À faire » se coche « Fait » sur place, les chiffres de l'accueil ne se coupent plus en grandes lettres, Motion 14.6 | [#107](https://github.com/dmeloz/korahome/pull/107) |
| 0.0.87 | 2026-10-27 | Le carnet de la maison (concierge, gérance, compteurs, « Appeler » d'un toucher), que la fée et Siri savent dire et tenir, jamais de mot de passe | [#105](https://github.com/dmeloz/korahome/pull/105) |
| 0.0.86 | 2026-10-27 | Une seule échelle d'arrondis et d'écarts, aucun texte sous 13 px, états vides soignés (Budget, Tâches, Courses), aides repliées entières, bas de l'accueil fondu, tests de l'app entière | [#103](https://github.com/dmeloz/korahome/pull/103) |
| 0.0.85 | 2026-10-27 | Mode magasin des courses, plafond par catégorie, « À préparer la veille » et anniversaires une semaine avant, version en retard de l'autre iPhone, notifications d'iOS 18.4, essai du matin de la fée | [#102](https://github.com/dmeloz/korahome/pull/102) |
| 0.0.84 | 2026-10-27 | Clé des raccourcis hors des adresses, erreurs du serveur sans détail interne, « Pas enregistré » quand un toucher échoue, un lien retenu par la fée demande un oui, Motion 14 | [#101](https://github.com/dmeloz/korahome/pull/101) |
| 0.0.83 | 2026-10-27 | Rien de visible : les collections déclarées en un seul endroit, chargement sélectif des données, essai sur iPhone simulé dans la CI, journal des versions, carte d'architecture et décisions | [#100](https://github.com/dmeloz/korahome/pull/100) |
| 0.0.82 | 2026-10-26 | Alerte quand l'assistant tombe, téléphones reliés, recettes gardées, fonctions allégées | [#99](https://github.com/dmeloz/korahome/pull/99) |
| 0.0.81 | 2026-10-26 | Veille du 26 octobre, sécurité et entretien | [#98](https://github.com/dmeloz/korahome/pull/98) |
| 0.0.80 | 2026-10-26 | Rapport 0.0.79 | [#97](https://github.com/dmeloz/korahome/pull/97) |
| 0.0.79 | 2026-10-26 | Vêtements, déchets et appareils dans Maison, Cuisine sur les courses, nettoyage | [#93](https://github.com/dmeloz/korahome/pull/93) |
| 0.0.78 | 2026-10-26 | Paiements à classer plus sobres, catégories du foyer | [#96](https://github.com/dmeloz/korahome/pull/96) |
| 0.0.77 | 2026-10-26 | L'anneau du Budget d'abord, la clôture du mois en une ligne | [#95](https://github.com/dmeloz/korahome/pull/95) |
| 0.0.76 | 2026-10-26 | Budget « À toi ce mois », version 4 | [#94](https://github.com/dmeloz/korahome/pull/94) |
| 0.0.75 | 2026-10-26 | Quatre espaces, ses tâches d'abord, notes « Reçues » | [#92](https://github.com/dmeloz/korahome/pull/92) |
| 0.0.74 | 2026-10-25 | L'accueil reste toujours fixe | [#89](https://github.com/dmeloz/korahome/pull/89) |
| 0.0.73 | 2026-10-25 | Accueil fixe, recherche par la fée, Réglages en haut à droite | [#88](https://github.com/dmeloz/korahome/pull/88) |
| 0.0.72 | 2026-10-25 | L'accueil tout sur un écran | [#87](https://github.com/dmeloz/korahome/pull/87) |
| 0.0.71 | 2026-10-25 | Un cadre commun et un accueil allégé | [#86](https://github.com/dmeloz/korahome/pull/86) |
| 0.0.70 | 2026-10-21 | Rapport 0.0.69 | [#85](https://github.com/dmeloz/korahome/pull/85) |
| 0.0.69 | 2026-10-21 | Le carnet de santé de Mitsu, tel qu'écrit par le vétérinaire | [#84](https://github.com/dmeloz/korahome/pull/84) |
| 0.0.68 | 2026-10-20 | Le Chef apprend la cuisine et varie ses semaines | [#79](https://github.com/dmeloz/korahome/pull/79) |
| 0.0.67 | 2026-10-20 | Confort, axe dans l'essai, et publication sur GitHub Pages | [#80](https://github.com/dmeloz/korahome/pull/80) |
| 0.0.66 | 2026-10-20 | Retrouver (exports lisibles, recherche élargie, raccourcis, listes rien qu'à soi, verrou) | [#78](https://github.com/dmeloz/korahome/pull/78) |
| 0.0.65 | 2026-10-20 | À deux, le fil du foyer, l'arrivée guidée et la version de chaque iPhone | [#76](https://github.com/dmeloz/korahome/pull/76) |
| 0.0.64 | 2026-10-20 | Un filet sous chaque page, et la corbeille du foyer | [#75](https://github.com/dmeloz/korahome/pull/75) |
| 0.0.63 | 2026-10-20 | Le ticket de caisse se vérifie en entier, depuis le Budget et les Courses aussi | [#74](https://github.com/dmeloz/korahome/pull/74) |
| 0.0.62 | 2026-10-20 | L'accueil en six espaces, le mois du budget nommé d'après la paie | [#73](https://github.com/dmeloz/korahome/pull/73) |
| 0.0.61 | 2026-10-20 | Tael sans demande de micro, valider ou effacer le menu, gestes plus posés | [#71](https://github.com/dmeloz/korahome/pull/71) |
| 0.0.60 | 2026-10-20 | Les ronds de l'accueil répondent au doigt, recettes en PDF, rappels à l'heure | [#70](https://github.com/dmeloz/korahome/pull/70) |
| 0.0.59 | 2026-10-20 | « Ce soir » tourne en roulette, et se coche comme Rappels | [#69](https://github.com/dmeloz/korahome/pull/69) |
| 0.0.58 | 2026-10-20 | Les chiffres qui roulent et les confettis | [#67](https://github.com/dmeloz/korahome/pull/67) |
| 0.0.57 | 2026-10-20 | Un soir du Chef s'ouvre d'un toucher | [#66](https://github.com/dmeloz/korahome/pull/66) |
| 0.0.56 | 2026-10-20 | Le widget qui s'ouvre en page | [#65](https://github.com/dmeloz/korahome/pull/65) |
| 0.0.55 | 2026-10-20 | La fiche de la semaine | [#64](https://github.com/dmeloz/korahome/pull/64) |
| 0.0.54 | 2026-10-20 | Le moteur de mouvement (Motion et Anime.js) | [#63](https://github.com/dmeloz/korahome/pull/63) |
| 0.0.53 | 2026-10-20 | Anime.js dans Kora | [#62](https://github.com/dmeloz/korahome/pull/62) |
| 0.0.52 | 2026-10-20 | Ronds de l'accueil, onglet Administratif, notifications coupées signalées | [#61](https://github.com/dmeloz/korahome/pull/61) |
| 0.0.51 | 2026-10-20 | Restructuration du code | [#60](https://github.com/dmeloz/korahome/pull/60) |
| 0.0.50 | 2026-10-20 | Les fusions d'écrans | [#59](https://github.com/dmeloz/korahome/pull/59) |
| 0.0.49 | 2026-10-20 | Le grand ménage | [#58](https://github.com/dmeloz/korahome/pull/58) |
| 0.0.48 | 2026-10-20 | Le bas de l'accueil ne montre le partage et la sauvegarde qu'en cas de souci | [#57](https://github.com/dmeloz/korahome/pull/57) |
| 0.0.47 | 2026-10-20 | Pastilles de « Ce matin » qui se touchent, signes qui ouvrent leur page | [#56](https://github.com/dmeloz/korahome/pull/56) |
| 0.0.46 | 2026-10-20 | Nouvelle icône, la maison la nuit et sa fée | [#55](https://github.com/dmeloz/korahome/pull/55) |
| 0.0.45 | 2026-10-20 | Les pages sans cadre et les réglages de la fée | [#53](https://github.com/dmeloz/korahome/pull/53) |
| 0.0.44 | 2026-10-20 | La vie de la fée | [#52](https://github.com/dmeloz/korahome/pull/52) |
| 0.0.43 | 2026-10-20 | La fée remplace la barre Jarvis (Tael ou Navi) | [#51](https://github.com/dmeloz/korahome/pull/51) |
| 0.0.42 | 2026-10-20 | L'accueil façon iOS 27 (date seule, signes, « Ce soir » sans cadre, Tous les espaces) | [#50](https://github.com/dmeloz/korahome/pull/50) |
| 0.0.41 | 2026-10-19 | Jarvis dans Siri (« Dis Siri, Tael ») | [#49](https://github.com/dmeloz/korahome/pull/49) |
| 0.0.40 | 2026-10-19 | Un seul tableau de bord, et des bulles qui ouvrent chaque usage | [#48](https://github.com/dmeloz/korahome/pull/48) |
| 0.0.39 | 2026-10-19 | Jarvis répond de nouveau | [#47](https://github.com/dmeloz/korahome/pull/47) |
| 0.0.38 | 2026-10-19 | Les recettes du foyer, une base qui se remplit seule | [#46](https://github.com/dmeloz/korahome/pull/46) |
| 0.0.37 | 2026-10-19 | Le Budget qui conseille (parcours revu, conseiller, clôture du mois, factures cochées seules) | [#45](https://github.com/dmeloz/korahome/pull/45) |
| 0.0.36 | 2026-10-19 | L'heure du rappel au choix, à la minute près | [#44](https://github.com/dmeloz/korahome/pull/44) |
| 0.0.35 | 2026-10-19 | Accueil rangé par usage, carte Aujourd'hui plus lisible, rappels à la demi-heure, bouton Synchroniser | [#43](https://github.com/dmeloz/korahome/pull/43) |
| 0.0.34 | 2026-10-19 | Visite guidée de l'accueil | [#42](https://github.com/dmeloz/korahome/pull/42) |
| 0.0.33 | 2026-10-19 | Importer le relevé Revolut du mois | [#41](https://github.com/dmeloz/korahome/pull/41) |
| 0.0.32 | 2026-10-19 | La banderole remplace le « Bonjour », tâches à cocher dans Aujourd'hui, réglages du bandeau | [#40](https://github.com/dmeloz/korahome/pull/40) |
| 0.0.31 | 2026-10-19 | Les étapes Apple Pay suivent Raccourcis d'iOS 26 | [#39](https://github.com/dmeloz/korahome/pull/39) |
| 0.0.30 | 2026-10-19 | Une demande toute prête pour l'IA de Raccourcis | [#38](https://github.com/dmeloz/korahome/pull/38) |
| 0.0.29 | 2026-10-19 | Les paiements Apple Pay arrivent seuls dans le budget | [#37](https://github.com/dmeloz/korahome/pull/37) |
| 0.0.28 | 2026-10-19 | Les charges de chacun et neuf visuels pour le budget | [#36](https://github.com/dmeloz/korahome/pull/36) |
| 0.0.27 | 2026-10-19 | Le budget du foyer, repris de l'Excel | [#35](https://github.com/dmeloz/korahome/pull/35) |
| 0.0.26 | 2026-10-19 | La page ne part plus de côté quand on fait défiler | [#34](https://github.com/dmeloz/korahome/pull/34) |
| 0.0.25 | 2026-10-19 | Le calendrier de l'iPhone dans les Réglages, et un glisser pour revenir plus fluide | [#33](https://github.com/dmeloz/korahome/pull/33) |
| 0.0.24 | 2026-10-19 | Modifier depuis Kora les événements des calendriers iCloud | [#32](https://github.com/dmeloz/korahome/pull/32) |
| 0.0.23 | 2026-10-19 | Refonte de l'interface | [#30](https://github.com/dmeloz/korahome/pull/30) |
| 0.0.22 | 2026-10-19 | Nettoyage du code mort | [#29](https://github.com/dmeloz/korahome/pull/29) |
| 0.0.21 | 2026-10-19 | La vue Jour de l'agenda, heure par heure | [#28](https://github.com/dmeloz/korahome/pull/28) |
| 0.0.20 | 2026-10-19 | Kora apprend de votre usage | [#27](https://github.com/dmeloz/korahome/pull/27) |
| 0.0.19 | 2026-10-19 | La banderole du couple se fait défiler au doigt | [#26](https://github.com/dmeloz/korahome/pull/26) |
| 0.0.18 | 2026-10-19 | L'agenda commun, relié à iCloud | [#25](https://github.com/dmeloz/korahome/pull/25) |
| 0.0.17 | 2026-10-18 | Le Chef de la semaine | [#24](https://github.com/dmeloz/korahome/pull/24) |
| 0.0.16 | 2026-10-18 | Jarvis apprend, gestes iPhone, ticket de caisse et bandeau du couple | [#23](https://github.com/dmeloz/korahome/pull/23) |
| 0.0.15 | 2026-10-15 | Le module Jardin | [#22](https://github.com/dmeloz/korahome/pull/22) |
| 0.0.14 | 2026-10-12 | Mitsu plus poussé, journal, courbe de poids, carnet prérempli et fiches | [#21](https://github.com/dmeloz/korahome/pull/21) |
| 0.0.12 | 2026-10-12 | Le micro de Jarvis ne se bloque plus | [#20](https://github.com/dmeloz/korahome/pull/20) |
| 0.1.0 | 2026-10-12 | (numéro passé à 0.1.0 par erreur, revenu à 0.0.x ensuite) Jarvis, synchro instantanée et les idées 2026 | [#17](https://github.com/dmeloz/korahome/pull/17) |
| 0.0.10 | 2026-10-12 | Le stock refait, saisie en une phrase, scan, Base et calendrier | [#18](https://github.com/dmeloz/korahome/pull/18) |
| 0.0.9 | 2026-10-11 | Glisser pour revenir, téléphone verrouillé, glisser pour supprimer, frigo et placards | [#16](https://github.com/dmeloz/korahome/pull/16) |
| 0.0.8 | 2026-10-11 | Rappels aux jours choisis, Réglages épurés, widgets façon iPhone | [#15](https://github.com/dmeloz/korahome/pull/15) |
| 0.0.7 | 2026-10-10 | Rappels du matin, notes transmises, connexion simplifiée | [#13](https://github.com/dmeloz/korahome/pull/13) |
| 0.0.6 | 2026-10-10 | L'app en ligne, qui se met à jour toute seule | [#12](https://github.com/dmeloz/korahome/pull/12) |
| 0.0.5 | 2026-10-10 | Rejoindre le foyer avec le code seulement | [#11](https://github.com/dmeloz/korahome/pull/11) |
| 0.0.4 | 2026-10-10 | Partage entre les deux iPhone | [#10](https://github.com/dmeloz/korahome/pull/10) |
| 0.0.3 | 2026-10-09 | Le suivi de Mitsu | [#9](https://github.com/dmeloz/korahome/pull/9) |
| 0.0.2 | 2026-10-08 | Coin « Dev » et rapport de test envoyé au Mac | [#7](https://github.com/dmeloz/korahome/pull/7) |
| 0.0.1 | 2026-10-08 | Bouton « Mettre à jour » | [#6](https://github.com/dmeloz/korahome/pull/6) |

Avant la 0.0.1 (7 et 8 octobre 2026) : le socle de la PWA, la liste de courses, le serveur du Mac, les tâches et l'apparence sombre ([#1 à #5](https://github.com/dmeloz/korahome/pulls?q=is%3Apr+is%3Amerged)).
