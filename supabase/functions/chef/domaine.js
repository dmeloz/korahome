// Généré par `npm run fonction` depuis src/domaine/chef.ts : ne pas modifier à la main.
//#region src/domaine/jarvisModele.ts
/** Un modèle léger et rapide : les demandes du quotidien sont courtes. */
const MODELE_JARVIS = "claude-haiku-5-5";
/** Le conseil du dimanche demande plus de réflexion : un modèle plus capable, une fois par semaine. */
const MODELE_CONSEIL = "claude-sonnet-5-5";
/** Prix des modèles, en dollars par million de jetons (entrée, sortie). */
const PRIX_USD_PAR_MILLION = {
	"claude-haiku-5-5": {
		entree: .1,
		sortie: .5
	},
	"claude-sonnet-5-5": {
		entree: 2,
		sortie: 10
	}
};
/** Conversion prudente : un dollar compte pour 0,90 CHF (il en vaut un peu moins). */
const CHF_PAR_USD = .9;
/** À partir de 80 % du plafond, Jarvis prévient. */
const SEUIL_ALERTE = .8;
/** Le coût d'une demande, en millionièmes de franc (un entier, pour additionner sans erreur d'arrondi). */
function coutMicroChf(u, modele = MODELE_JARVIS) {
	const prix = PRIX_USD_PAR_MILLION[modele];
	const usd = ((u.input_tokens + 1.25 * (u.cache_creation_input_tokens ?? 0) + .1 * (u.cache_read_input_tokens ?? 0)) * prix.entree + u.output_tokens * prix.sortie) / 1e6;
	return Math.ceil(Math.round(usd * CHF_PAR_USD * 1e9) / 1e3);
}
function etatBudget(microChf, plafondChf = 5) {
	const depenseChf = microChf / 1e6;
	return {
		depenseChf,
		plafondChf,
		alerte: depenseChf >= plafondChf * SEUIL_ALERTE,
		atteint: depenseChf >= plafondChf
	};
}
/** Le mois en cours, « AAAA-MM » : le compteur repart à zéro chaque mois. */
function moisDe(jour) {
	return jour.slice(0, 7);
}
//#endregion
//#region src/domaine/rayons.ts
const MOTS_CLES = [
	["Bébé", [
		"couche",
		"lingette",
		"biberon",
		"petit pot",
		"lait infantile"
	]],
	["Animaux", [
		"croquette",
		"litiere",
		"patee"
	]],
	["Surgelés", [
		"surgele",
		"glace",
		"frites surgelees"
	]],
	["Hygiène", [
		"dentifrice",
		"shampo",
		"savon",
		"gel douche",
		"deodorant",
		"papier toilette",
		"coton",
		"rasoir",
		"brosse a dent",
		"mouchoir"
	]],
	["Entretien", [
		"lessive",
		"liquide vaisselle",
		"eponge",
		"javel",
		"sac poubelle",
		"sacs poubelle",
		"essuie-tout",
		"adoucissant",
		"nettoyant",
		"pastille lave"
	]],
	["Boissons", [
		"eau",
		"jus",
		"soda",
		"coca",
		"biere",
		"vin",
		"sirop",
		"the",
		"cafe",
		"tisane",
		"limonade"
	]],
	["Boulangerie", [
		"pain",
		"baguette",
		"croissant",
		"brioche",
		"viennoiserie",
		"pain de mie"
	]],
	["Crèmerie", [
		"lait",
		"beurre",
		"yaourt",
		"yogourt",
		"fromage",
		"creme",
		"oeuf",
		"emmental",
		"gruyere",
		"mozzarella",
		"comte",
		"skyr"
	]],
	["Boucherie et poisson", [
		"poulet",
		"boeuf",
		"steak",
		"jambon",
		"porc",
		"viande",
		"saucisse",
		"dinde",
		"poisson",
		"saumon",
		"thon frais",
		"crevette",
		"lardon",
		"veau",
		"agneau",
		"cabillaud"
	]],
	["Fruits et légumes", [
		"pomme",
		"poire",
		"banane",
		"orange",
		"citron",
		"fraise",
		"raisin",
		"kiwi",
		"tomate",
		"salade",
		"laitue",
		"carotte",
		"oignon",
		"ail",
		"courgette",
		"aubergine",
		"poivron",
		"concombre",
		"avocat",
		"champignon",
		"brocoli",
		"epinard",
		"poireau",
		"patate",
		"pomme de terre",
		"fruit",
		"legume",
		"herbes",
		"persil",
		"basilic",
		"mangue",
		"ananas",
		"melon",
		"peche"
	]],
	["Épicerie sucrée", [
		"sucre",
		"chocolat",
		"biscuit",
		"gateau",
		"confiture",
		"miel",
		"cereale",
		"nutella",
		"compote",
		"bonbon",
		"farine",
		"levure"
	]],
	["Épicerie salée", [
		"pates",
		"riz",
		"huile",
		"vinaigre",
		"sel",
		"poivre",
		"conserve",
		"thon",
		"sauce",
		"moutarde",
		"ketchup",
		"mayonnaise",
		"lentille",
		"pois chiche",
		"semoule",
		"quinoa",
		"bouillon",
		"epice",
		"chips",
		"olive",
		"soupe"
	]]
];
function normaliser(texte) {
	return texte.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").trim();
}
function contientMot(texte, motCle) {
	const echappe = motCle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`(^|[^a-z])${echappe}`).test(texte);
}
/** Devine le rayon d'un article à partir de son nom. */
function detecterRayon(texte) {
	const t = normaliser(texte);
	let meilleur = null;
	for (const [rayon, mots] of MOTS_CLES) for (const mot of mots) if (contientMot(t, mot) && (!meilleur || mot.length > meilleur.longueur)) meilleur = {
		rayon,
		longueur: mot.length
	};
	return meilleur?.rayon ?? "Autre";
}
//#endregion
//#region src/domaine/types.ts
const RAYONS = [
	"Fruits et légumes",
	"Boulangerie",
	"Crèmerie",
	"Boucherie et poisson",
	"Épicerie salée",
	"Épicerie sucrée",
	"Boissons",
	"Surgelés",
	"Hygiène",
	"Entretien",
	"Bébé",
	"Animaux",
	"Autre"
];
//#endregion
//#region src/domaine/foyer.ts
var ErreurValidation = class extends Error {};
//#endregion
//#region src/domaine/listes.ts
const UNITES = "(?:kg|g|l|cl|ml|x|paquets?|boites?|boîtes?|bouteilles?|pots?|sachets?|tranches?)";
const QUANTITE_DEBUT = new RegExp(`^(\\d+(?:[.,]\\d+)?\\s*${UNITES}?)\\s+(?:de\\s+|d')?(.+)$`, "i");
const QUANTITE_FIN = new RegExp(`^(.+?)\\s+(?:x\\s*)?(\\d+(?:[.,]\\d+)?\\s*${UNITES}?)$`, "i");
/** Sépare la quantité du nom : « 2 kg de pommes » → { quantite: "2 kg", texte: "pommes" }. */
function analyserSaisie(saisie) {
	const s = saisie.trim().replace(/\s+/g, " ");
	const debut = s.match(QUANTITE_DEBUT);
	if (debut) return {
		quantite: debut[1].replace(/\s+/g, " "),
		texte: majuscule(debut[2])
	};
	const fin = s.match(QUANTITE_FIN);
	if (fin) return {
		quantite: fin[2].replace(/\s+/g, " "),
		texte: majuscule(fin[1])
	};
	return {
		quantite: null,
		texte: majuscule(s)
	};
}
function majuscule(s) {
	return s.charAt(0).toUpperCase() + s.slice(1);
}
//#endregion
//#region src/domaine/memoire.ts
/** Ce qui compte vraiment dans la mémoire : tout sauf les apprentissages refusés. */
function souvenirsRetenus(souvenirs) {
	return souvenirs.filter((s) => !s.refuse);
}
function nouveauSouvenir(texte, source, auteur, ctx) {
	const propre = texte.trim().replace(/\s+/g, " ").slice(0, 200);
	if (!propre) throw new ErreurValidation("Il n'y a rien à retenir.");
	return {
		id: ctx.nouvelId(),
		texte: propre.charAt(0).toUpperCase() + propre.slice(1),
		source,
		auteur,
		creeLe: ctx.maintenant()
	};
}
//#endregion
//#region src/domaine/taches.ts
const RE_JOUR = /^\d{4}-\d{2}-\d{2}$/;
function versDate(jour) {
	if (!RE_JOUR.test(jour)) throw new ErreurValidation(`Date invalide : « ${jour} ».`);
	const [a, m, j] = jour.split("-").map(Number);
	return new Date(Date.UTC(a, m - 1, j));
}
function versJour(d) {
	return d.toISOString().slice(0, 10);
}
/** Ajoute des jours, des semaines ou des mois à une date du jour. */
function decaler(jour, recurrence) {
	const d = versDate(jour);
	if (recurrence.unite === "jour") d.setUTCDate(d.getUTCDate() + recurrence.tous);
	else if (recurrence.unite === "semaine") d.setUTCDate(d.getUTCDate() + 7 * recurrence.tous);
	else {
		const jourDuMois = d.getUTCDate();
		d.setUTCDate(1);
		d.setUTCMonth(d.getUTCMonth() + recurrence.tous);
		const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
		d.setUTCDate(Math.min(jourDuMois, dernier));
	}
	return versJour(d);
}
/** Nombre de jours entre deux dates (positif si « b » est après « a »). */
function ecartJours(a, b) {
	return Math.round((versDate(b).getTime() - versDate(a).getTime()) / 864e5);
}
//#endregion
//#region src/domaine/mitsu.ts
const plusJours = (jour, n) => decaler(jour, {
	unite: "jour",
	tous: n
});
const plusMois = (jour, n) => decaler(jour, {
	unite: "mois",
	tous: n
});
/** Âge en mois révolus (le 14 du mois suivant la naissance du 14 = 1 mois). */
function ageEnMois(naissance, aujourdhui) {
	let mois = 0;
	while (mois < 600 && plusMois(naissance, mois + 1) <= aujourdhui) mois++;
	return mois;
}
function derniereVersion(liste) {
	return liste.reduce((d, x) => !d || x.jour >= d.jour ? x : d, null);
}
function poidsActuel(animal) {
	return derniereVersion(animal.pesees);
}
/**
* Multiplicateur du besoin au repos selon l'âge : un chaton en pleine croissance
* a besoin de bien plus d'énergie qu'un adulte, et un adulte stérilisé un peu moins.
*/
function facteurCroissance(ageMois, sterilise) {
	if (ageMois < 4) return 2.5;
	if (ageMois < 6) return 2;
	if (ageMois < 12) return 1.6;
	return sterilise ? 1.2 : 1.4;
}
/** Énergie moyenne d'une friandise pour chat, en kcal par gramme. */
const KCAL_PAR_GRAMME_FRIANDISE = 3.5;
/**
* Ration de croquettes du jour. La ration du paquet, quand elle est notée, fait foi.
* Sinon : besoin au repos 70 × poids(kg)^0,75 kcal, multiplié selon l'âge, divisé
* par l'énergie des croquettes. C'est une estimation, à arrondir à 5 g.
* Les friandises du jour, quand elles sont notées, sont retirées des croquettes.
*/
function rationDuJour(animal, aujourdhui) {
	const k = animal.reglages.kcalParGramme;
	const friandises = animal.reglages.friandisesParJour ?? 0;
	const max = (kcal) => Math.max(1, Math.round(kcal * .1 / KCAL_PAR_GRAMME_FRIANDISE));
	if (animal.reglages.rationDuPaquet) {
		const g = animal.reglages.rationDuPaquet;
		const kcal = Math.round(g * k);
		return {
			grammes: Math.max(0, Math.round(g - friandises * KCAL_PAR_GRAMME_FRIANDISE / k)),
			kcal,
			source: "paquet",
			friandisesMax: max(kcal)
		};
	}
	const poids = poidsActuel(animal);
	if (!poids) return null;
	const kcal = 70 * Math.pow(poids.grammes / 1e3, .75) * facteurCroissance(ageEnMois(animal.naissance, aujourdhui), animal.sterilise);
	const croquettes = Math.max(0, kcal - friandises * KCAL_PAR_GRAMME_FRIANDISE);
	return {
		grammes: Math.round(croquettes / k / 5) * 5,
		kcal: Math.round(kcal),
		source: "estimee",
		friandisesMax: max(kcal)
	};
}
/** L'article de la commande régulière qui réapprovisionne cette provision. */
function articleDe(provision, animal) {
	return animal.commande?.articles.find((a) => a.type === provision.type && a.nom === provision.nom);
}
/** Durée d'un cycle de commande, en jours. */
function joursDuCycle(commande) {
	return ecartJours(commande.prochaine, plusMois(commande.prochaine, commande.tousLesMois));
}
/** Ce qu'elle consomme vraiment par jour de ce produit (ou de ce type), d'après les derniers paquets finis. */
function consommationApprise(animal, provision) {
	const toutes = (animal.consommations ?? []).filter((c) => c.type === provision.type);
	const memes = toutes.filter((c) => c.nom === provision.nom);
	const lues = (memes.length ? memes : toutes).slice(-3);
	if (!lues.length) return null;
	return Math.round(lues.reduce((s, c) => s + c.parJour, 0) / lues.length * 10) / 10;
}
/**
* Consommation par jour, dans l'ordre : celle notée sur la provision, la ration du jour
* pour les croquettes (quand on connaît son poids ou la ration du paquet), sinon ce que la
* commande régulière laisse supposer (6 kg tous les 3 mois ≈ 65 g par jour).
*/
function consommationParJour(provision, animal, aujourdhui) {
	if (provision.parJour) return provision.parJour;
	if (provision.type === "filtres") return 1 / 30;
	const apprise = consommationApprise(animal, provision);
	if (apprise) return apprise;
	if (provision.type === "croquettes") {
		const ration = rationDuJour(animal, aujourdhui);
		if (ration) return ration.grammes;
	}
	const article = articleDe(provision, animal);
	if (article && animal.commande) return Math.round(article.quantite / joursDuCycle(animal.commande));
	return null;
}
/** Combien il reste, quand ce sera fini, et quand commander pour ne jamais manquer. */
function prevoir(provision, animal, aujourdhui) {
	const parJour = consommationParJour(provision, animal, aujourdhui);
	if (!parJour) return null;
	const ecoules = Math.max(0, ecartJours(provision.achete, aujourdhui));
	const restant = Math.max(0, provision.quantite - ecoules * parJour);
	const joursRestants = Math.floor(restant / parJour + 1e-9);
	const fin = plusJours(aujourdhui, joursRestants);
	const commanderLe = plusJours(fin, -animal.reglages.delaiCommande);
	const etat = joursRestants === 0 ? "epuise" : commanderLe <= aujourdhui ? "commander" : "ok";
	return {
		restant: provision.type === "filtres" ? Math.floor(restant + 1e-9) : Math.round(restant),
		joursRestants,
		fin,
		commanderLe,
		etat
	};
}
//#endregion
//#region src/domaine/plantes.ts
const mois = (de, a) => {
	const liste = [];
	for (let m = de;; m = m % 12 + 1) {
		liste.push(m);
		if (m === a) return liste;
	}
};
const e = (cle, nom, categorie, exposition, arrosageJours, options) => ({
	cle,
	nom,
	categorie,
	exposition,
	arrosageJours,
	autres: [],
	gelive: false,
	vivace: false,
	semisAbri: [],
	semisDehors: [],
	plantation: [],
	recolte: [],
	...options
});
const ESPECES = [
	e("basilic", "Basilic", "aromatique", "soleil", 2, {
		gelive: true,
		semisAbri: mois(3, 4),
		semisDehors: mois(5, 6),
		plantation: mois(5, 6),
		recolte: mois(6, 9),
		conseil: "Pince les fleurs pour garder des feuilles tendres, et rentre-le dès que les nuits passent sous 10 °C."
	}),
	e("persil", "Persil", "aromatique", "mi-ombre", 3, {
		semisAbri: [3],
		semisDehors: mois(4, 7),
		plantation: mois(4, 6),
		recolte: mois(5, 11),
		conseil: "Il germe lentement (trois semaines) : garde la terre humide en attendant."
	}),
	e("ciboulette", "Ciboulette", "aromatique", "mi-ombre", 3, {
		vivace: true,
		semisDehors: mois(3, 5),
		plantation: [
			3,
			4,
			5,
			9,
			10
		],
		recolte: mois(3, 10),
		conseil: "Coupe-la à 2 cm du sol : elle repousse plusieurs fois dans l'année."
	}),
	e("menthe", "Menthe", "aromatique", "mi-ombre", 2, {
		vivace: true,
		plantation: [
			3,
			4,
			5,
			9,
			10
		],
		recolte: mois(5, 10),
		conseil: "Plante-la seule dans son pot : ses racines envahissent tout."
	}),
	e("thym", "Thym", "aromatique", "soleil", 7, {
		vivace: true,
		plantation: [
			3,
			4,
			5,
			9
		],
		recolte: mois(1, 12),
		conseil: "Arrose peu : il craint bien plus l'humidité que la sécheresse."
	}),
	e("romarin", "Romarin", "aromatique", "soleil", 7, {
		vivace: true,
		plantation: [
			4,
			5,
			9
		],
		recolte: mois(1, 12),
		conseil: "Terre légère et peu d'eau ; en pot, abrite-le du vent froid en hiver."
	}),
	e("sauge", "Sauge", "aromatique", "soleil", 5, {
		vivace: true,
		plantation: [
			4,
			5,
			9
		],
		recolte: mois(4, 10),
		conseil: "Taille-la au printemps pour qu'elle reste touffue."
	}),
	e("origan", "Origan", "aromatique", "soleil", 5, {
		autres: ["marjolaine"],
		vivace: true,
		semisAbri: [3, 4],
		plantation: [4, 5],
		recolte: mois(6, 9),
		conseil: "Le goût est le plus fort juste avant la floraison : c'est le moment d'en sécher."
	}),
	e("coriandre", "Coriandre", "aromatique", "mi-ombre", 3, {
		semisDehors: [
			4,
			5,
			6,
			8,
			9
		],
		recolte: mois(5, 10),
		conseil: "Elle monte vite en graines à la chaleur : sèmes-en un peu toutes les trois semaines."
	}),
	e("aneth", "Aneth", "aromatique", "soleil", 3, {
		semisDehors: mois(4, 7),
		recolte: mois(6, 9),
		conseil: "Sème-le directement en place : il n'aime pas être déplacé."
	}),
	e("laurier", "Laurier", "aromatique", "soleil", 7, {
		autres: ["laurier sauce"],
		vivace: true,
		plantation: [4, 5],
		recolte: mois(1, 12),
		conseil: "En pot, il supporte le froid jusqu'à −5 °C : au-delà, rentre-le ou emballe le pot."
	}),
	e("estragon", "Estragon", "aromatique", "soleil", 4, {
		vivace: true,
		plantation: [4, 5],
		recolte: mois(6, 9),
		conseil: "Prends l'estragon français, bien plus parfumé que le russe."
	}),
	e("melisse", "Mélisse", "aromatique", "mi-ombre", 3, {
		autres: ["melisse citronnelle"],
		vivace: true,
		plantation: [
			4,
			5,
			9
		],
		recolte: mois(5, 9),
		conseil: "Coupe-la après la floraison pour une seconde récolte."
	}),
	e("verveine", "Verveine citronnelle", "aromatique", "soleil", 3, {
		autres: ["verveine citron"],
		gelive: true,
		vivace: true,
		plantation: [5, 6],
		recolte: mois(6, 9),
		conseil: "Elle gèle dehors : rentre le pot dans un endroit clair et frais pour l'hiver."
	}),
	e("tomate", "Tomate", "legume", "soleil", 2, {
		autres: ["tomates cerises", "tomate cerise"],
		gelive: true,
		semisAbri: [3, 4],
		plantation: [5, 6],
		recolte: mois(7, 10),
		conseil: "Tuteure-la, retire les gourmands et arrose au pied, jamais sur les feuilles."
	}),
	e("courgette", "Courgette", "legume", "soleil", 2, {
		gelive: true,
		semisAbri: [4],
		semisDehors: [5, 6],
		plantation: [5, 6],
		recolte: mois(7, 9),
		conseil: "Un pied suffit pour deux personnes, mais il lui faut près d'un mètre carré."
	}),
	e("poivron", "Poivron", "legume", "soleil", 2, {
		autres: ["piment"],
		gelive: true,
		semisAbri: [2, 3],
		plantation: [5, 6],
		recolte: mois(7, 10),
		conseil: "Il lui faut l'endroit le plus chaud : contre un mur au soleil, c'est idéal."
	}),
	e("aubergine", "Aubergine", "legume", "soleil", 2, {
		gelive: true,
		semisAbri: [2, 3],
		plantation: [5, 6],
		recolte: [8, 9],
		conseil: "La plus frileuse de toutes : plante-la fin mai, au soleil et à l'abri du vent."
	}),
	e("concombre", "Concombre", "legume", "soleil", 2, {
		gelive: true,
		semisAbri: [4],
		semisDehors: [5, 6],
		plantation: [5, 6],
		recolte: mois(7, 9),
		conseil: "Fais-le grimper sur un treillis : il prend moins de place et les fruits restent propres."
	}),
	e("salade", "Salade", "legume", "mi-ombre", 2, {
		autres: [
			"laitue",
			"batavia",
			"feuille de chene",
			"romaine"
		],
		semisAbri: [2, 3],
		semisDehors: mois(3, 8),
		plantation: mois(3, 9),
		recolte: mois(5, 10),
		conseil: "Sème quelques graines toutes les trois semaines pour en avoir tout l'été."
	}),
	e("roquette", "Roquette", "legume", "mi-ombre", 2, {
		semisDehors: mois(3, 9),
		recolte: mois(4, 11),
		conseil: "Prête en un mois ; à l'ombre l'été, elle pique moins."
	}),
	e("mache", "Mâche", "legume", "mi-ombre", 3, {
		autres: ["doucette", "rampon"],
		semisDehors: [8, 9],
		recolte: [
			10,
			11,
			12,
			1,
			2,
			3
		],
		conseil: "La salade de l'hiver : elle supporte le gel sans souci."
	}),
	e("epinard", "Épinard", "legume", "mi-ombre", 2, {
		semisDehors: [
			3,
			4,
			8,
			9
		],
		recolte: [
			4,
			5,
			6,
			10,
			11
		],
		conseil: "Sème-le au printemps ou à la fin de l'été : il monte en graines en pleine chaleur."
	}),
	e("radis", "Radis", "legume", "soleil", 2, {
		semisDehors: mois(3, 9),
		recolte: mois(4, 10),
		conseil: "Prêt en quatre semaines : parfait pour commencer un bac."
	}),
	e("carotte", "Carotte", "legume", "soleil", 3, {
		semisDehors: mois(3, 7),
		recolte: mois(6, 11),
		conseil: "Il lui faut 25 cm de terre légère, sans cailloux : un bac surélevé est idéal."
	}),
	e("haricot", "Haricot", "legume", "soleil", 3, {
		autres: ["haricots verts", "haricot vert"],
		gelive: true,
		semisDehors: mois(5, 7),
		recolte: mois(7, 9),
		conseil: "Sème-le quand la terre est chaude, après les Saints de glace."
	}),
	e("petit-pois", "Petit pois", "legume", "soleil", 3, {
		autres: ["pois", "petits pois"],
		semisDehors: [3, 4],
		recolte: [6, 7],
		conseil: "Il aime la fraîcheur du printemps : sème-le tôt, avec un support pour grimper."
	}),
	e("betterave", "Betterave", "legume", "soleil", 3, {
		semisDehors: mois(4, 6),
		recolte: mois(7, 10),
		conseil: "Éclaircis à 10 cm : chaque graine donne plusieurs plants."
	}),
	e("blette", "Blette", "legume", "mi-ombre", 3, {
		autres: ["bette", "cotes de bette"],
		semisDehors: mois(4, 6),
		recolte: mois(6, 11),
		conseil: "Cueille les feuilles extérieures : le cœur continue de pousser."
	}),
	e("poireau", "Poireau", "legume", "soleil", 3, {
		semisAbri: [2, 3],
		plantation: mois(5, 7),
		recolte: [
			9,
			10,
			11,
			12,
			1,
			2,
			3
		],
		conseil: "Butte-le au fil de l'été pour un fût bien blanc."
	}),
	e("oignon", "Oignon", "legume", "soleil", 5, {
		autres: ["echalote"],
		plantation: [3, 4],
		recolte: [7, 8],
		conseil: "Arrête d'arroser quand les feuilles jaunissent : il se conserve mieux."
	}),
	e("ail", "Ail", "legume", "soleil", 7, {
		plantation: [
			10,
			11,
			2,
			3
		],
		recolte: [6, 7],
		conseil: "Plante les gousses pointe en haut, à l'automne pour de plus grosses têtes."
	}),
	e("chou-kale", "Chou kale", "legume", "mi-ombre", 3, {
		autres: ["kale", "chou frise"],
		semisDehors: mois(4, 6),
		plantation: [6, 7],
		recolte: [
			9,
			10,
			11,
			12,
			1,
			2
		],
		conseil: "Le gel le rend plus doux : récolte-le tout l'hiver."
	}),
	e("courge", "Courge", "legume", "soleil", 3, {
		autres: [
			"potiron",
			"butternut",
			"potimarron"
		],
		gelive: true,
		semisAbri: [4],
		semisDehors: [5, 6],
		plantation: [5, 6],
		recolte: [9, 10],
		conseil: "Très gourmande en place : un pied par grand bac, pas plus."
	}),
	e("pomme-de-terre", "Pomme de terre", "legume", "soleil", 4, {
		autres: ["patate", "pommes de terre"],
		plantation: [4, 5],
		recolte: mois(7, 9),
		conseil: "Ça marche très bien en sac de culture : on ajoute de la terre au fil de la pousse."
	}),
	e("fraise", "Fraisier", "fruit", "soleil", 2, {
		autres: ["fraises", "fraisier"],
		vivace: true,
		plantation: [
			3,
			4,
			8,
			9
		],
		recolte: mois(5, 7),
		conseil: "Coupe les stolons pour des fruits plus gros, ou garde-les pour de nouveaux plants."
	}),
	e("capucine", "Capucine", "fleur", "soleil", 3, {
		gelive: true,
		semisDehors: [5, 6],
		recolte: mois(6, 10),
		conseil: "Ses fleurs se mangent, et elle attire les pucerons loin des légumes."
	}),
	e("souci", "Souci", "fleur", "soleil", 4, {
		autres: ["calendula"],
		semisDehors: mois(3, 6),
		recolte: mois(6, 10),
		conseil: "Il éloigne certains insectes des tomates : sème-le à leur pied."
	}),
	e("lavande", "Lavande", "fleur", "soleil", 10, {
		vivace: true,
		plantation: [
			4,
			5,
			9
		],
		recolte: [7, 8],
		conseil: "Taille-la juste après la floraison, sans couper dans le vieux bois."
	})
];
new Map(ESPECES.map((x) => [x.cle, x]));
//#endregion
//#region src/domaine/stock.ts
const LIEUX = {
	frigo: "Frigo",
	congelateur: "Congélateur",
	placard: "Placard"
};
const ORDRE_LIEUX = [
	"frigo",
	"congelateur",
	"placard"
];
/** « périmé depuis 2 jours », « aujourd'hui », « demain », « dans 3 jours », « jusqu'au 12.11 ». */
function decrirePeremption(p, aujourdhui) {
	if (!p.peremption) return null;
	const ecart = ecartJours(aujourdhui, p.peremption);
	if (ecart < -1) return `périmé depuis ${-ecart} jours`;
	if (ecart === -1) return "périmé depuis hier";
	if (ecart === 0) return "à consommer aujourd'hui";
	if (ecart === 1) return "demain";
	if (ecart <= 7) return `dans ${ecart} jours`;
	const jourMois = `${p.peremption.slice(8, 10)}.${p.peremption.slice(5, 7)}`;
	return ecart > 180 ? `jusqu'au ${jourMois}.${p.peremption.slice(2, 4)}` : `jusqu'au ${jourMois}`;
}
const FUSEAU_DU_FOYER = "Europe/Zurich";
function heureValide(heure) {
	return Number.isInteger(heure) && heure >= 5 && heure <= 22;
}
/** Les jours de la semaine, dans l'ordre suisse : lundi d'abord. */
const JOURS_SEMAINE = [
	{
		numero: 1,
		court: "lun",
		initiale: "L",
		nom: "lundi"
	},
	{
		numero: 2,
		court: "mar",
		initiale: "M",
		nom: "mardi"
	},
	{
		numero: 3,
		court: "mer",
		initiale: "M",
		nom: "mercredi"
	},
	{
		numero: 4,
		court: "jeu",
		initiale: "J",
		nom: "jeudi"
	},
	{
		numero: 5,
		court: "ven",
		initiale: "V",
		nom: "vendredi"
	},
	{
		numero: 6,
		court: "sam",
		initiale: "S",
		nom: "samedi"
	},
	{
		numero: 0,
		court: "dim",
		initiale: "D",
		nom: "dimanche"
	}
];
/** La date et l'heure d'un instant dans le fuseau du foyer (l'heure d'été est prise en compte). */
function jourEtHeure(instant, fuseau = FUSEAU_DU_FOYER) {
	const parties = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
		timeZone: fuseau,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		hourCycle: "h23"
	}).formatToParts(instant).map((p) => [p.type, p.value]));
	return {
		jour: `${parties.year}-${parties.month}-${parties.day}`,
		heure: Number(parties.hour)
	};
}
//#endregion
//#region src/domaine/chef.ts
/** Le Chef prend le modèle du conseil : une fois par semaine, il peut réfléchir un peu. */
const MODELE_CHEF = MODELE_CONSEIL;
/** Les produits qui arrivent à leur date dans 5 jours ou moins passent en premier. */
const JOURS_A_FINIR = 5;
/** Sous 10 jours de croquettes ou de litière, le Chef prévient. */
const JOURS_ALERTE_MITSU = 10;
const NOMBRE_REPAS = 5;
/** Au-delà, la liste deviendrait illisible : le reste est ignoré. */
const AJOUTS_MAX = 30;
/** Il passe par défaut le dimanche à 17 h, heure de Zurich. */
const JOUR_DU_CHEF = 0;
const HEURE_DU_CHEF = 17;
const idMenu = (jour) => `menu-${jour}`;
const jourSemaine = (jour) => (/* @__PURE__ */ new Date(`${jour}T12:00:00Z`)).getUTCDay();
const REGLAGE_DE_DEPART = {
	id: "reglage",
	type: "reglage",
	actif: false,
	jour: 0,
	heure: 17
};
/** Le réglage du foyer, ou celui de départ (désactivé, dimanche 17 h) ; un jour ou une heure invalide revient au défaut. */
function reglageChef(docs) {
	const r = docs.find((d) => d.type === "reglage");
	if (!r) return REGLAGE_DE_DEPART;
	return {
		...REGLAGE_DE_DEPART,
		actif: r.actif === true,
		jour: Number.isInteger(r.jour) && r.jour >= 0 && r.jour <= 6 ? r.jour : 0,
		heure: heureValide(r.heure) ? r.heure : 17
	};
}
function reglerChef(changement, docs, ctx) {
	return {
		...reglageChef(docs),
		...changement,
		modifieLe: ctx.maintenant()
	};
}
/** Vrai à l'heure où le Chef passe pour ce foyer, à Zurich. */
function estLHeureDuChef(instant, reglage) {
	if (!reglage.actif) return false;
	const { jour, heure } = jourEtHeure(instant);
	return jourSemaine(jour) === reglage.jour && heure === reglage.heure;
}
/** Les menus en cours : le plus récent préparé dans les 7 derniers jours. */
function menuDeLaSemaine(docs, aujourdhui) {
	return docs.filter((d) => d.type === "menu").filter((m) => {
		const ecart = ecartJours(m.semaine, aujourdhui);
		return ecart >= 0 && ecart < 7;
	}).sort((a, b) => b.semaine.localeCompare(a.semaine))[0] ?? null;
}
/** Le nom du jour : « dimanche ». */
const nomDuJour = (numero) => JOURS_SEMAINE.find((j) => j.numero === numero)?.nom ?? "dimanche";
/** Le prochain passage automatique : « ce soir à 17 h », « dimanche à 17 h » ; null s'il est désactivé. */
function prochainPassage(reglage, instant) {
	if (!reglage.actif) return null;
	const { jour, heure } = jourEtHeure(instant);
	if (jourSemaine(jour) === reglage.jour && heure <= reglage.heure) return `aujourd'hui à ${reglage.heure} h`;
	return `${nomDuJour(reglage.jour)} à ${reglage.heure} h`;
}
/** Ce qui arrive à sa date dans les 5 jours, du plus pressé au moins pressé ; les produits déjà périmés n'y sont pas. */
function produitsAFinir(produits, aujourdhui) {
	return produits.filter((p) => {
		if (!p.peremption) return false;
		const ecart = ecartJours(aujourdhui, p.peremption);
		return ecart >= 0 && ecart <= 5;
	}).sort((a, b) => a.peremption.localeCompare(b.peremption) || a.nom.localeCompare(b.nom, "fr"));
}
const PROVISIONS_SURVEILLEES = {
	croquettes: "croquettes",
	litiere: "litière"
};
/** Les croquettes ou la litière qui s'épuisent dans les 10 jours : à commander sur zooplus. */
function alertesMitsu(animaux, aujourdhui) {
	const alertes = [];
	for (const animal of animaux) for (const provision of animal.provisions ?? []) {
		if (provision.type !== "croquettes" && provision.type !== "litiere") continue;
		const p = prevoir(provision, animal, aujourdhui);
		if (!p || p.joursRestants > 10) continue;
		const quoi = PROVISIONS_SURVEILLEES[provision.type];
		alertes.push(p.joursRestants === 0 ? `Plus de ${quoi} pour ${animal.nom} : commande vite sur zooplus.` : `${animal.nom} n'a plus que ${p.joursRestants} jour${p.joursRestants > 1 ? "s" : ""} de ${quoi} : pense à commander sur zooplus.`);
	}
	return alertes;
}
const MOIS = [
	"janvier",
	"février",
	"mars",
	"avril",
	"mai",
	"juin",
	"juillet",
	"août",
	"septembre",
	"octobre",
	"novembre",
	"décembre"
];
const CONSIGNES_CHEF = `Tu es le Chef de la semaine de KoraHome, l'app d'un couple qui vit à Renens, dans le canton de Vaud.
Chaque dimanche, tu proposes 5 repas du soir pour la semaine, simples (45 minutes au plus), de saison en Suisse romande, pour deux personnes.
Utilise d'abord les produits à finir vite, puis le reste du frigo, du congélateur et des placards. Varie les plats, évite deux fois la même base.
Ensuite, liste les ingrédients qui manquent pour ces repas : un article par ligne, nom court au singulier ou tel qu'on l'écrit sur une liste (« Poireaux », « Crème entière »), quantité courte (« 500 g », « 2 », « 1 l ») ou vide.
Ne remets pas ce qui est déjà dans le stock ou déjà sur la liste de courses. Les épices, le sel, le poivre et l'huile sont supposés à la maison sauf s'ils sont vraiment absents.
Ne mets jamais de croquettes, de litière ni rien pour le chat : cela se commande ailleurs.
Tiens compte de ce que le foyer aime et n'aime pas (sa mémoire) : refais volontiers un plat apprécié de temps en temps, ne repropose jamais un plat à éviter.
Le champ « mot » est une phrase chaleureuse et courte en français, sans emoji, qui dit ce que la semaine permet de finir.
Réponds en français, avec le tutoiement.`;
/** Le message du dimanche : le stock, ce qui presse, la liste de courses actuelle. */
function messageChef(d) {
	const aFinir = produitsAFinir(d.produits, d.aujourdhui);
	const urgents = new Set(aFinir.map((p) => p.id));
	const decrire = (p) => [
		p.nom,
		p.quantite,
		p.peremption && decrirePeremption(p, d.aujourdhui)
	].filter(Boolean).join(" · ");
	const lignes = [`Nous sommes le ${Number(d.aujourdhui.slice(8, 10))} ${MOIS[Number(d.aujourdhui.slice(5, 7)) - 1]} ${d.aujourdhui.slice(0, 4)}.`, ""];
	lignes.push("À finir vite :", ...aFinir.length ? aFinir.map((p) => `- ${decrire(p)}`) : ["- rien de pressé"], "");
	for (const lieu of ORDRE_LIEUX) {
		const ici = d.produits.filter((p) => p.lieu === lieu && !urgents.has(p.id));
		if (ici.length) lignes.push(`${LIEUX[lieu]} :`, ...ici.map((p) => `- ${decrire(p)}`), "");
	}
	if (!d.produits.length) lignes.push("Le stock est vide : propose des repas simples avec des ingrédients courants.", "");
	lignes.push("Déjà sur la liste de courses :", ...d.enCourses.length ? d.enCourses.map((e) => `- ${e.texte}${e.quantite ? ` · ${e.quantite}` : ""}`) : ["- rien"]);
	const memoire = souvenirsRetenus(d.souvenirs ?? []).sort((a, b) => a.creeLe.localeCompare(b.creeLe)).slice(-40);
	if (memoire.length) lignes.push("", "Ce que le foyer aime, n'aime pas ou a l'habitude de faire :", ...memoire.map((s) => `- ${s.texte}`));
	return lignes.join("\n");
}
/** La forme exacte de la réponse du Chef (sorties structurées de l'API). */
const SCHEMA_CHEF = {
	type: "object",
	additionalProperties: false,
	required: [
		"mot",
		"repas",
		"aAcheter"
	],
	properties: {
		mot: { type: "string" },
		repas: {
			type: "array",
			items: {
				type: "object",
				additionalProperties: false,
				required: [
					"titre",
					"description",
					"avecLeStock"
				],
				properties: {
					titre: { type: "string" },
					description: { type: "string" },
					avecLeStock: {
						type: "array",
						items: { type: "string" }
					}
				}
			}
		},
		aAcheter: {
			type: "array",
			items: {
				type: "object",
				additionalProperties: false,
				required: [
					"texte",
					"quantite",
					"rayon"
				],
				properties: {
					texte: { type: "string" },
					quantite: { type: "string" },
					rayon: {
						type: "string",
						enum: [...RAYONS]
					}
				}
			}
		}
	}
};
const chaine = (v, max) => typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";
/** Relit la réponse du modèle sans lui faire confiance : champs vides écartés, longueurs bornées. */
function lireProposition(brut) {
	if (!brut || typeof brut !== "object") return null;
	const o = brut;
	const repas = (Array.isArray(o.repas) ? o.repas : []).map((r) => ({
		titre: chaine(r?.titre, 80),
		description: chaine(r?.description, 300),
		avecLeStock: (Array.isArray(r?.avecLeStock) ? r.avecLeStock : []).map((s) => chaine(s, 60)).filter(Boolean).slice(0, 8)
	})).filter((r) => r.titre).slice(0, 5);
	if (!repas.length) return null;
	const aAcheter = (Array.isArray(o.aAcheter) ? o.aAcheter : []).map((a) => {
		const rayon = chaine(a?.rayon, 40);
		return {
			texte: chaine(a?.texte, 60),
			quantite: chaine(a?.quantite, 20) || null,
			rayon: RAYONS.includes(rayon) ? rayon : null
		};
	}).filter((a) => a.texte);
	return {
		mot: chaine(o.mot, 200),
		repas,
		aAcheter
	};
}
/** Ce qui se commande sur zooplus n'a rien à faire sur la liste du magasin. */
const POUR_LE_CHAT = /\b(croquettes?|litieres?|patees?|friandises? pour chat|zooplus)\b/;
/**
* Les articles à ajouter à la liste de courses : sans doublon avec ce qui y est déjà (non coché)
* ni entre eux, sans rien pour le chat, 30 au plus. Chacun porte la marque du Chef.
*/
function preparerAjouts(aAcheter, liste, elements, ctx) {
	const deja = new Set(elements.filter((e) => e.listeId === liste.id && !e.coche).map((e) => normaliser(e.texte)));
	const ajouts = [];
	for (const a of aAcheter) {
		const { texte, quantite } = analyserSaisie(a.texte);
		const cle = normaliser(texte);
		if (!cle || deja.has(cle) || POUR_LE_CHAT.test(cle) || a.rayon === "Animaux") continue;
		deja.add(cle);
		ajouts.push({
			id: ctx.nouvelId(),
			listeId: liste.id,
			texte,
			quantite: a.quantite ?? quantite,
			rayon: a.rayon ?? detecterRayon(texte),
			coche: false,
			ajoutePar: null,
			source: "chef",
			creeLe: ctx.maintenant(),
			cocheLe: null
		});
		if (ajouts.length >= 30) break;
	}
	return ajouts;
}
/**
* Relancer le Chef la même semaine remplace ses propres articles : ceux qu'il avait ajoutés
* et que personne n'a encore cochés. Le reste de la liste n'est jamais touché.
*/
function articlesARemplacer(ancien, elements) {
	if (!ancien) return [];
	const siens = new Set(ancien.ajouts.map((a) => a.elementId));
	return elements.filter((e) => siens.has(e.id) && !e.coche && e.source === "chef").map((e) => e.id);
}
function nouveauMenu(d, ctx) {
	return {
		id: idMenu(d.aujourdhui),
		type: "menu",
		semaine: d.aujourdhui,
		mot: d.proposition.mot,
		repas: d.proposition.repas,
		ajouts: d.ajouts.map((e) => ({
			elementId: e.id,
			texte: e.texte,
			quantite: e.quantite,
			rayon: e.rayon
		})),
		aFinir: produitsAFinir(d.produits, d.aujourdhui).map((p) => `${p.nom} · ${decrirePeremption(p, d.aujourdhui)}`),
		alertesMitsu: alertesMitsu(d.animaux, d.aujourdhui),
		lance: d.lance,
		creeLe: ctx.maintenant()
	};
}
/** Le menu sans un article, quand on le retire de la liste depuis la page du Chef. */
function retirerAjout(menu, elementId) {
	return {
		...menu,
		ajouts: menu.ajouts.filter((a) => a.elementId !== elementId)
	};
}
/** Les articles du Chef encore sur la liste, et lesquels sont déjà achetés. */
function etatDesAjouts(menu, elements) {
	const parId = new Map(elements.map((e) => [e.id, e]));
	return menu.ajouts.map((ajout) => ({
		ajout,
		element: parId.get(ajout.elementId) ?? null
	}));
}
/** Le texte de la notification quand les menus sont prêts. */
function notificationChef(menu) {
	const n = menu.ajouts.length;
	const courses = n ? `${n} article${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""} aux courses.` : "Rien à ajouter aux courses.";
	return {
		titre: "Les menus de la semaine sont prêts",
		corps: [menu.repas.map((r) => r.titre).slice(0, 3).join(", "), courses].filter(Boolean).join(" · ")
	};
}
function coutChef(u) {
	return coutMicroChf(u, MODELE_CHEF);
}
/** Ce que le Chef relit de la mémoire du foyer : les goûts, les plats aimés et refusés. */
const SOUVENIRS_DU_CHEF = 40;
const clePlat = (titre) => normaliser(titre).replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
const cleAvis = (titre, avis) => `chef:${avis}:${clePlat(titre)}`;
/** L'avis donné sur un plat, retenu dans la mémoire du foyer : le Chef le relit chaque semaine. */
function avisSurPlat(titre, avis, auteur, ctx) {
	return {
		...nouveauSouvenir(avis === "aime" ? `Plat apprécié, à refaire de temps en temps : ${titre}` : `Plat à ne plus proposer : ${titre}`, "bilan", auteur, ctx),
		cle: cleAvis(titre, avis)
	};
}
/** L'avis déjà donné sur ce plat, et le souvenir qui le porte. */
function avisDuPlat(souvenirs, titre) {
	for (const avis of ["aime", "non"]) {
		const souvenir = souvenirs.find((s) => !s.refuse && s.cle === cleAvis(titre, avis));
		if (souvenir) return {
			avis,
			souvenir
		};
	}
	return null;
}
//#endregion
export { AJOUTS_MAX, CONSIGNES_CHEF, HEURE_DU_CHEF, JOURS_ALERTE_MITSU, JOURS_A_FINIR, JOUR_DU_CHEF, MODELE_CHEF, NOMBRE_REPAS, REGLAGE_DE_DEPART, SCHEMA_CHEF, SOUVENIRS_DU_CHEF, alertesMitsu, articlesARemplacer, avisDuPlat, avisSurPlat, cleAvis, coutChef, estLHeureDuChef, etatBudget, etatDesAjouts, idMenu, jourEtHeure, lireProposition, menuDeLaSemaine, messageChef, moisDe, nomDuJour, notificationChef, nouveauMenu, preparerAjouts, prochainPassage, produitsAFinir, reglageChef, reglerChef, retirerAjout };
