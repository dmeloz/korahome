# Le budget du foyer

Le widget **Budget** ouvre la page « Budget ». Il reprend la logique de l'Excel du foyer
(« Budget maison ») : deux salaires, chacun ses charges et sa part versée au compte commun ; le
commun paie le loyer, les courses (une carte dédiée) et met de côté pour les factures ; ce qui reste
se partage entre le **plaisir** (30 %) et l'**épargne** (70 %).

## Ce que Kora fait seule

- **Les calculs de l'Excel** : reste de chacun, entrée et reste du commun, partage 30/70, pot factures,
  charges de l'année lissées sur douze mois. Le versement au prorata des salaires est proposé dans la
  fiche de chaque personne.
- **Les pots et leur report** : courses, plaisir, factures, épargne. Chaque solde part des soldes de
  départ (Réglages du budget), reçoit les versements du mois et perd les dépenses. Ce qui reste passe au
  mois suivant.
- **Le mois** : au jour de paie, Kora propose de noter les versements du mois (l'épargne réelle se
  corrige avant « C'est versé »).
- **Les factures** : une charge commune avec un jour (et un mois pour celles de l'année) devient une
  échéance. Celles « prélevées seules » sortent du pot sans qu'on les coche ; les autres se cochent
  « payée ». La carte « Aujourd'hui » les montre la veille et le jour même, le rappel du matin dans les
  trois jours (Notifications › Factures).
- **Les tickets de caisse** : quand Jarvis lit un ticket, il range les produits au stock et compte le
  total dans la carte courses (on peut décocher).
- **La barre** : « Migros 84.30 », « 32 cinéma », « payé électricité 61.20 », « 200 épargne ». Sur
  l'onglet Charges : « Netflix 20 », « Assurance maison 118 par an ».
- **Jarvis** : il lit le budget (« combien il reste sur la carte courses ? ») et note les dépenses et les
  factures payées (outil `noter_depense`). Il ne paie jamais rien.

Aucun identifiant bancaire : un compte ou une carte n'est qu'un nom.

## Les visuels (0.0.28)

Sobres, un chiffre qui compte par visuel ; règles dans `budget.ts`, dessin dans `src/ui/ecrans/BudgetVisuels.tsx`.

- **Ce mois** : le mot de Jarvis sur le mois écoulé (sept premiers jours, `motDuMois`, calculé sans IA) ;
  la jauge de la carte courses avec le repère du jour et la fin de mois au rythme actuel (`rythmeCourses`) ;
  l'année des factures, une barre par mois, les mois lourds et le mois où le pot manquerait (`previsionFactures`).
- **Charges** : ce téléphone montre d'abord ses charges et le commun (« Voir aussi les charges de… » pour
  l'autre) ; le trajet du salaire (charges, commun, reste) ; l'anneau du compte commun (`repartitionDuCommun`),
  qu'on touche pour le détail d'un pot ; les abonnements à l'année (`abonnementsALAnnee`).
- **Courses** : six mois en barres face au budget (`coursesParMois`), la part de chaque magasin
  (`coursesParMagasin`), les prix qui montent (`prixQuiMontent`) d'après les lignes des tickets
  (`articles` de la dépense, lues par Jarvis avec leur prix).
- **Épargne** : la courbe du mis de côté, puis la suite au rythme prévu jusqu'au projet (`courbeEpargne`).

## Les paiements Apple Pay (0.0.29)

Les cartes Revolut du foyer (courses, plaisir…) sont dans Wallet. Sur chaque iPhone, une
automatisation « Transaction » de l'app Raccourcis envoie chaque paiement (montant, commerçant, nom
de la carte) à la fonction serveur `paiements`, avec un lien propre à la personne (Budget, Comptes et
réglages, « Paiements Apple Pay »). Depuis 0.0.30, Kora copie une demande toute prête, l'adresse
dedans, à coller dans « Décrire un raccourci » (l'IA de Raccourcis) 
(`demandeRaccourci`) ; sur iOS 26 le déclencheur « Lorsque n'importe quelle carte est présentée »
fait partie du raccourci (vérifié sur l'iPhone de Melo, 0.0.31). Kora :

- range le paiement dans le pot de la carte, qu'elle retient au premier paiement (`plan.cartes`) ;
  une carte inconnue, ou une autre monnaie, attend d'être classée d'un toucher en haut de « Ce mois » ;
- ignore une carte marquée « Hors budget » (une carte personnelle) ;
- ne compte pas deux fois : même jour et même montant qu'une dépense déjà notée, c'est un doublon ;
  un ticket photographié ou une dépense écrite ensuite complète le paiement (lignes, magasin) au lieu
  d'en créer un second (`completerPaiement`).

Aucun identifiant bancaire : le nom de la carte est gardé sans ses chiffres, le serveur ne garde que
l'empreinte SHA-256 du lien (`prive.jetons_paiement`). Les paiements par numéro de carte (en ligne)
ne passent pas par Wallet : on les écrit dans la barre.

Déploiement : appliquer la fin de `supabase/schema.sql` (jetons), puis déployer
`supabase/functions/paiements` (index.ts et domaine.js) **sans vérification du JWT** : le raccourci
n'a pas de session, il s'identifie par son lien.

## Le relevé Revolut (0.0.33)

Pour ce qu'Apple Pay ne voit pas (achats en ligne, carte en plastique, prélèvements) : Budget › Ce
mois › « Importer un relevé Revolut », un export CSV de l'app Revolut (en anglais ou en français).
Kora lit les sorties terminées, propose décochés les virements, recharges et autres monnaies, et
laisse de côté ce qui est déjà noté (même montant à un jour près, une dépense pour une ligne). On
choisit la carte (le pot) du relevé, puis « Ajouter ». Les dépenses sont marquées « relevé ». Règles :
`src/domaine/releve.ts`, écran `src/ui/ecrans/BudgetReleve.tsx`. Rien n'est gardé du relevé que
la date, le montant et le libellé.

## Où est quoi

- Règles et tests : `src/domaine/budget.ts`, paiements Apple Pay dans `src/domaine/paiements.ts`
  (écrans dans `src/ui/ecrans/BudgetPaiements.tsx`). Page : `src/ui/ecrans/Budget.tsx`, entrée `budget` de
  `src/ui/modules.tsx`.
- Données : collection partagée `budget` de la table `documents`. Un document `plan` (personnes,
  charges, comptes, jour de paie, part plaisir, soldes de départ, projet), un `mois-AAAA-MM` par mois
  versé, un document par dépense.
- Serveur : `supabase/schema.sql` ajoute `budget` aux collections. Les fonctions `jarvis` et `rappels`
  sont à redéployer après `npm run fonction`.

## Reprise de l'Excel

Le plan du foyer Cassa a été écrit une fois sur le serveur depuis l'Excel (octobre 2026) : salaires,
versements, charges, charges de l'année, part plaisir, soldes de départ de l'épargne et du pot factures.
Les noms des comptes, le jour de paie et les mois des factures de l'année restent à donner dans l'app.

## Le Budget qui conseille (0.0.36)

- **Parcours** : quatre onglets. *Ce mois* montre d'abord ce qui demande un geste (la clôture, les paiements à classer, les factures), puis les pots (toucher un pot ouvre ses dépenses ; l'épargne ouvre le Conseiller) et les quatre dernières dépenses. *Dépenses* : mois par mois, jour par jour, filtre par pot ; toucher une dépense la corrige (nom, montant, pot), glisser la retire ; l'import du relevé Revolut est là. *Charges* ne change pas. *Conseiller* réunit le conseiller, la fin du mois, le tableau des derniers mois, l'année des factures, l'épargne et les courses.
- **Clôture du mois** (`moisACloturer`, `bilanDeMois` dans `src/domaine/budgetConseil.ts`) : quand le nouveau mois attend ses versements, le mois fini se résume pot par pot (sorti, versé, ce qui passe au mois suivant) avec le mot de Jarvis, et « Clôturer septembre » note les versements du nouveau mois d'un geste (Annuler possible). Aucun nouveau document : la clôture est la confirmation du mois suivant.
- **Factures cochées seules** (`factureReglee`, `reglerFacture` dans `src/domaine/budget.ts`) : un paiement règle une facture à payer à la main quand son échéance tombe entre 25 jours après et 30 jours avant le paiement, et que le nom de la facture se retrouve dans le libellé (à 10 % près sur le montant), ou que le montant est exactement le même et que le paiement sort du pot de la facture (ou du pot factures). Appliqué au paiement Apple Pay (fonction `paiements`, réponse « Facture X payée. »), au classement d'un paiement, à la dépense écrite dans la barre et au relevé Revolut (un virement qui paie une facture est proposé coché, et ne règle qu'une échéance).
- **Conseiller** : Jarvis en mode `budget` (fonction `jarvis`, modèle réfléchi, compté dans le plafond de 5 CHF). Le téléphone envoie `decrireBudgetConseiller` (plan, projections, douze mois de factures, mois passés, dépenses détaillées des trois derniers mois, 36 000 caractères au plus) ; le modèle répond toujours par l'outil `repondre_budget` (texte, tableau facultatif, zéro à quatre conseils chiffrés), relu par `lireConseiller`. Questions toutes prêtes, ou la barre du bas sur l'onglet Conseiller. La dernière réponse reste sur le téléphone (`localStorage`, clé `korahome.conseillerBudget`).
- **Serveur** : redéployer `jarvis` (mode budget) et `paiements` (factures reconnues) après `npm run fonction`. Pas de changement de schéma.
