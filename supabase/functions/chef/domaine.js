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
//#region src/domaine/texte.ts
/** « Pâtes fraîches » → « Pates fraiches » : la casse est gardée, seuls les accents partent. */
const sansAccents = (t) => t.normalize("NFD").replace(/\p{M}/gu, "");
const NOMS_MOIS = [
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
	return sansAccents(texte.toLowerCase()).replace(/œ/g, "oe").trim();
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
		texte: majuscule$1(debut[2])
	};
	const fin = s.match(QUANTITE_FIN);
	if (fin) return {
		quantite: fin[2].replace(/\s+/g, " "),
		texte: majuscule$1(fin[1])
	};
	return {
		quantite: null,
		texte: majuscule$1(s)
	};
}
function majuscule$1(s) {
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
/** Le poids qui compte pour la ration : la dernière pesée, ou le poids estimé s'il est plus récent. */
function poidsDeReference(animal) {
	const pesee = poidsActuel(animal);
	const estime = animal.reglages.poidsEstime;
	if (estime && (!pesee || estime.le >= pesee.jour)) return {
		grammes: estime.grammes,
		jour: estime.le,
		estime: true
	};
	return pesee ? {
		grammes: pesee.grammes,
		jour: pesee.jour,
		estime: false
	} : null;
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
	const poids = poidsDeReference(animal);
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
/** « Pâtes fraîches » → « pate fraiche » : minuscules, sans accent, chaque mot au singulier. */
function cleProduit(nom) {
	return sansAccents(nom.toLowerCase()).replace(/œ/g, "oe").replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean).map((mot) => mot.length > 3 && /[sx]$/.test(mot) && !/(?:ss|is|us|ys)$/.test(mot) ? mot.slice(0, -1) : mot).join(" ");
}
const INGREDIENTS_MAX = 40;
const ETAPES_MAX = 20;
const idRecette = (ctx) => `recette-${ctx.nouvelId()}`;
function cleRecette(titre) {
	return normaliser(titre).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
function estRecette(doc) {
	return !!doc && typeof doc === "object" && doc.type === "recette";
}
/** Les recettes parmi les documents de la collection « menus ». */
function recettesDe(docs) {
	return docs.filter(estRecette);
}
const chaine$1 = (v, max) => typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";
const portionsValides = (v) => typeof v === "number" && Number.isFinite(v) && v >= 1 && v <= 20 ? Math.round(v) : null;
/** Relit une recette venue du modèle ou d'un formulaire sans lui faire confiance ; null sans titre ni ingrédient. */
function lireBrouillon(brut, source) {
	if (!brut || typeof brut !== "object") return null;
	const o = brut;
	const titre = chaine$1(o.titre, 80);
	const ingredients = (Array.isArray(o.ingredients) ? o.ingredients : []).map((i) => {
		if (typeof i === "string") return lireLigneIngredient(i);
		const r = i ?? {};
		const nom = chaine$1(r.nom, 60);
		return nom ? {
			nom: majuscule(nom),
			quantite: chaine$1(r.quantite, 24) || null
		} : null;
	}).filter((i) => !!i).slice(0, INGREDIENTS_MAX);
	if (!titre || !ingredients.length) return null;
	const etapes = (Array.isArray(o.etapes) ? o.etapes : []).map((e) => chaine$1(e, 400)).filter(Boolean).slice(0, ETAPES_MAX);
	const lien = chaine$1(o.lien, 500);
	return {
		titre: majuscule(titre),
		portions: portionsValides(o.portions),
		ingredients,
		etapes,
		source,
		lien: lien.startsWith("https://") ? lien : null
	};
}
function majuscule(s) {
	return s.charAt(0).toUpperCase() + s.slice(1);
}
const FRACTIONS = {
	"½": .5,
	"¼": .25,
	"¾": .75,
	"⅓": 1 / 3,
	"⅔": 2 / 3
};
const NOMBRE = String.raw`(\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?\s*[½¼¾⅓⅔]?|[½¼¾⅓⅔])`;
const UNITES_RECETTE = String.raw`(?:\s*(?:kg|g|mg|l|dl|cl|ml|c\.?\s*à\s*(?:soupe|café|s\.|c\.)|cs|cc|càs|càc|cuillères?\s+à\s+(?:soupe|café)|tasses?|verres?|pincées?|gousses?|tranches?|branches?|bottes?|brins?|feuilles?|boîtes?|sachets?|paquets?|pots?|morceaux?|filets?|pièces?|pc)\b\.?)?`;
const LIGNE_DEBUT = new RegExp(`^(${NOMBRE}${UNITES_RECETTE})\\s+(?:de\\s+|d['’]\\s*)?(.+)$`, "i");
/** Une ligne écrite à la main : « 200 g de lardons », « 1/2 citron », « sel ». */
function lireLigneIngredient(ligne) {
	const s = ligne.trim().replace(/^[-•*·]\s*/, "").replace(/\s+/g, " ");
	if (!s) return null;
	const m = s.match(LIGNE_DEBUT);
	if (m) return {
		nom: majuscule(m[3].trim()).slice(0, 60),
		quantite: m[1].replace(/\s+/g, " ").trim()
	};
	const { texte, quantite } = analyserSaisie(s);
	return {
		nom: texte.slice(0, 60),
		quantite
	};
}
function lireNombre(t) {
	const s = t.replace(/\s+/g, "");
	if (s in FRACTIONS) return FRACTIONS[s];
	const fraction = s.match(/^(\d+)\/(\d+)$/);
	if (fraction) return Number(fraction[2]) ? Number(fraction[1]) / Number(fraction[2]) : null;
	const mixte = s.match(/^(\d+(?:[.,]\d+)?)([½¼¾⅓⅔])$/);
	if (mixte) return Number(mixte[1].replace(",", ".")) + FRACTIONS[mixte[2]];
	const n = Number(s.replace(",", "."));
	return Number.isFinite(n) ? n : null;
}
function ecrireNombre(n) {
	if (n >= 100) return String(Math.round(n / 5) * 5);
	if (n >= 10) return String(Math.round(n));
	const arrondi = Math.max(.5, Math.round(n * 2) / 2);
	return arrondi === .5 ? "½" : String(arrondi).replace(".5", "½");
}
/** La quantité pour un autre nombre de personnes : « 200 g » pour 2 → « 600 g » pour 6. */
function ajusterQuantite(quantite, de, a) {
	if (!quantite || de === a || de <= 0) return quantite;
	const m = quantite.match(new RegExp(`^${NOMBRE}(.*)$`));
	if (!m) return quantite;
	const nombre = m[1].trimEnd();
	const n = lireNombre(nombre);
	if (n === null) return quantite;
	const valeur = n * a / de;
	let reste = quantite.slice(nombre.length);
	if (/^\s*g$/.test(reste) && valeur >= 1e3) return `${String(Math.round(valeur / 100) / 10).replace(".", ",")} kg`;
	if (valeur > 1) reste = reste.replace(/^(\s+)(gousse|tranche|branche|botte|brin|feuille|boîte|sachet|paquet|pot|filet|pincée|tasse|verre|pièce)\b(?!s)/i, "$1$2s");
	return `${ecrireNombre(valeur)}${reste}`;
}
function ingredientsPour(recette, portions) {
	return recette.ingredients.map((i) => ({
		...i,
		quantite: ajusterQuantite(i.quantite, recette.portions, portions)
	}));
}
function nouvelleRecette(b, ctx) {
	const maintenant = ctx.maintenant();
	return {
		id: idRecette(ctx),
		type: "recette",
		titre: b.titre,
		cle: cleRecette(b.titre),
		portions: portionsValides(b.portions) ?? 2,
		ingredients: b.ingredients,
		etapes: b.etapes,
		source: b.source,
		lien: b.lien ?? null,
		vue: 1,
		fois: 0,
		derniereFois: null,
		prevuLe: null,
		creeLe: maintenant,
		modifieLe: maintenant
	};
}
/**
* Une recette arrive (le Chef, Jarvis) : nouvelle, elle entre dans la base ; déjà là sous
* le même titre, elle n'est pas copiée, elle monte (vue + 1) et ne reprend que ce qui lui
* manquait (étapes, lien). Ce que le foyer a écrit n'est jamais écrasé.
*/
function apprendreRecette(recettes, b, ctx) {
	const cle = cleRecette(b.titre);
	const avant = recettes.find((r) => r.cle === cle) ?? null;
	if (!avant) return {
		recette: nouvelleRecette(b, ctx),
		avant: null
	};
	return {
		avant,
		recette: {
			...avant,
			ingredients: avant.ingredients.length ? avant.ingredients : b.ingredients,
			etapes: avant.etapes.length ? avant.etapes : b.etapes,
			lien: avant.lien ?? b.lien ?? null,
			vue: avant.vue + 1,
			modifieLe: ctx.maintenant()
		}
	};
}
const DE_BASE = [
	"sel",
	"poivre",
	"sel et poivre",
	"fleur de sel",
	"poivre noir",
	"huile",
	"huile d'olive",
	"huile de tournesol",
	"huile neutre",
	"eau",
	"eau chaude",
	"eau froide",
	"epice",
	"noix de muscade",
	"muscade",
	"paprika",
	"cumin",
	"curry",
	"herbe de provence",
	"thym",
	"laurier"
].map(cleProduit);
/** Le sel, le poivre, l'huile, l'eau et les épices : supposés à la maison, jamais mis aux courses. */
function estDeBase(nom) {
	const cle = cleProduit(nom);
	return DE_BASE.includes(cle) || /^(huile|sel|poivre|epice)\b/.test(cle);
}
const contient = (grand, petit) => ` ${grand} `.includes(` ${petit} `);
/** Le produit du stock qui correspond à un ingrédient : « Crème entière » trouve « Crème ». */
function produitPour(nom, produits) {
	const ik = cleProduit(nom);
	if (!ik) return null;
	let proche = null;
	for (const p of produits) {
		const pk = cleProduit(p.nom);
		if (!pk) continue;
		if (pk === ik) return p;
		if (!proche && (contient(ik, pk) || contient(pk, ik))) proche = p;
	}
	return proche;
}
/**
* Les articles à mettre aux courses pour cette recette et ce nombre de personnes : ce qui
* manque au stock et n'est pas déjà sur la liste (non coché). Rien pour le sel ou l'huile.
*/
function preparerCourses(recette, portions, produits, liste, elements, membreId, ctx) {
	const sur = elements.filter((e) => e.listeId === liste.id && !e.coche).map((e) => cleProduit(e.texte));
	const ajouts = [];
	for (const i of ingredientsPour(recette, portions)) {
		if (estDeBase(i.nom) || produitPour(i.nom, produits)) continue;
		const cle = cleProduit(i.nom);
		if (!cle || sur.some((s) => s === cle || contient(s, cle) || contient(cle, s))) continue;
		sur.push(cle);
		ajouts.push({
			id: ctx.nouvelId(),
			listeId: liste.id,
			texte: i.nom,
			quantite: i.quantite,
			rayon: detecterRayon(i.nom),
			coche: false,
			ajoutePar: membreId,
			creeLe: ctx.maintenant(),
			cocheLe: null
		});
	}
	return ajouts;
}
/** Les recettes que le Chef peut reprendre : celles que le foyer aime, puis les plus faites. */
function recettesPourLeChef(recettes, aime, refuse, max = 15) {
	return recettes.filter((r) => !refuse(r) && (aime(r) || r.fois > 0)).sort((a, b) => Number(aime(b)) - Number(aime(a)) || b.fois - a.fois || b.vue - a.vue).slice(0, max).map((r) => r.titre);
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
		minute: "2-digit",
		hourCycle: "h23"
	}).formatToParts(instant).map((p) => [p.type, p.value]));
	return {
		jour: `${parties.year}-${parties.month}-${parties.day}`,
		heure: Number(parties.hour),
		minute: Number(parties.minute)
	};
}
//#endregion
//#region src/domaine/savoirCuisine.ts
const DE = (debut, fin) => {
	const mois = [];
	for (let m = debut;; m = m % 12 + 1) {
		mois.push(m);
		if (m === fin) return mois;
	}
};
const TOUTE_L_ANNEE = DE(1, 12);
/** Le calendrier des légumes suisses (Schweizer Gemüse), repris du référentiel. */
const LEGUMES_DE_SAISON = [
	...[
		"carotte",
		"céleri-rave",
		"chou blanc",
		"chou rouge",
		"oignon",
		"pomme de terre"
	].map((nom) => ({
		nom,
		mois: TOUTE_L_ANNEE,
		source: "legumes.saison.stockage-toute-annee"
	})),
	{
		nom: "asperge",
		mois: DE(4, 6),
		source: "legumes.saison.printemps"
	},
	{
		nom: "petits pois",
		mois: DE(5, 7),
		source: "legumes.saison.printemps"
	},
	{
		nom: "fève",
		mois: DE(5, 7),
		source: "legumes.saison.printemps"
	},
	{
		nom: "radis",
		mois: DE(4, 10),
		source: "legumes.saison.printemps"
	},
	{
		nom: "roquette",
		mois: DE(4, 10),
		source: "legumes.saison.printemps"
	},
	{
		nom: "épinard",
		mois: [...DE(3, 5), ...DE(9, 11)],
		source: "legumes.saison.printemps"
	},
	{
		nom: "courgette",
		mois: DE(6, 9),
		source: "legumes.saison.ete"
	},
	{
		nom: "concombre",
		mois: DE(6, 9),
		source: "legumes.saison.ete"
	},
	{
		nom: "haricot vert",
		mois: DE(6, 9),
		source: "legumes.saison.ete"
	},
	{
		nom: "tomate",
		mois: DE(7, 9),
		source: "legumes.saison.ete"
	},
	{
		nom: "aubergine",
		mois: DE(7, 9),
		source: "legumes.saison.ete"
	},
	{
		nom: "poivron",
		mois: DE(7, 10),
		source: "legumes.saison.ete"
	},
	{
		nom: "maïs",
		mois: DE(8, 9),
		source: "legumes.saison.ete"
	},
	{
		nom: "chou frisé",
		mois: DE(9, 3),
		source: "legumes.saison.automne-hiver"
	},
	{
		nom: "chou-fleur",
		mois: DE(9, 3),
		source: "legumes.saison.automne-hiver"
	},
	{
		nom: "poireau",
		mois: DE(9, 4),
		source: "legumes.saison.automne-hiver"
	},
	{
		nom: "panais",
		mois: DE(10, 3),
		source: "legumes.saison.automne-hiver"
	},
	{
		nom: "chou de Bruxelles",
		mois: DE(10, 2),
		source: "legumes.saison.automne-hiver"
	},
	{
		nom: "mâche",
		mois: DE(9, 4),
		source: "legumes.saison.automne-hiver"
	},
	{
		nom: "courge",
		mois: DE(9, 12),
		source: "legumes.saison.automne-hiver"
	},
	{
		nom: "champignons",
		mois: DE(6, 11),
		source: "legumes.saison.champignons-sauvages"
	}
];
const legumesDuMois = (mois) => LEGUMES_DE_SAISON.filter((l) => l.mois.includes(mois)).map((l) => l.nom);
const BASES = [
	{
		id: "pates",
		nom: "pâtes",
		pourDeux: "160 à 200 g secs",
		repere: "1 L d'eau pour 100 g, 10 g de sel par litre, saler quand l'eau bout ; fraîches 2 à 3 min",
		mots: [
			"pates",
			"spaghetti",
			"penne",
			"tagliatelle",
			"linguine",
			"fusilli",
			"lasagne",
			"ravioli",
			"tortellini",
			"macaroni"
		],
		source: "reperes-portion ; feculents.pates.eau.volume"
	},
	{
		id: "riz",
		nom: "riz",
		pourDeux: "100 à 140 g secs",
		repere: "pilaf : suer l'oignon, 1,4 L de fond par kg de riz, cuisson à absorption",
		mots: [
			"riz",
			"pilaf",
			"basmati",
			"riz cantonais"
		],
		source: "reperes-portion ; sauces-cuissons.pates.pilaf-fond"
	},
	{
		id: "risotto",
		nom: "risotto",
		pourDeux: "150 à 160 g de riz rond",
		repere: "nacrer, déglacer, bouillon chaud louche après louche, 16 à 18 min, finir fromage et beurre",
		mots: ["risotto"],
		source: "feculents.risotto.portion ; feculents.risotto.duree"
	},
	{
		id: "pommes-de-terre",
		nom: "pommes de terre",
		pourDeux: "400 à 500 g",
		repere: "fermes pour salade, rösti et sautées ; farineuses pour purée et gratin ; purée au presse-purée, jamais au mixeur",
		mots: [
			"pomme de terre",
			"pommes de terre",
			"patate",
			"puree",
			"rosti",
			"gratin dauphinois",
			"pommes sautees",
			"raclette",
			"gschwellti"
		],
		source: "feculents.pdt.famille-ferme.usage ; feculents.pdt.puree.technique"
	},
	{
		id: "gnocchi",
		nom: "gnocchi",
		pourDeux: "400 à 500 g frais",
		repere: "pocher sous l'ébullition, ils sont cuits quand ils remontent (environ 5 min)",
		mots: ["gnocchi"],
		source: "feculents.pdt.gnocchi.cuisson-eau"
	},
	{
		id: "polenta",
		nom: "polenta",
		pourDeux: "120 à 140 g de semoule",
		repere: "4 parts de liquide pour 1 ; précuite en quelques minutes ; refroidie, taillée et dorée à la poêle",
		mots: ["polenta"],
		source: "feculents.polenta.proportion ; feculents.polenta.cuisson"
	},
	{
		id: "couscous",
		nom: "couscous ou boulgour",
		pourDeux: "120 à 140 g secs",
		repere: "couscous : autant d'eau chaude que de semoule, 10 min couvert ; boulgour moyen 1 pour 1,5 à 2",
		mots: [
			"couscous",
			"boulgour",
			"taboule"
		],
		source: "feculents.couscous.proportion ; feculents.boulgour.proportion"
	},
	{
		id: "quinoa",
		nom: "quinoa",
		pourDeux: "120 à 140 g secs",
		repere: "1 part pour 2 d'eau, 10 min de mijotage puis 10 min couvert hors du feu",
		mots: ["quinoa"],
		source: "feculents.quinoa.cuisson"
	},
	{
		id: "lentilles",
		nom: "lentilles",
		pourDeux: "120 à 140 g sèches",
		repere: "sans trempage ; corail 5 à 15 min, vertes ou Beluga 20 à 30 min ; elles prennent 2 à 3 fois leur poids",
		mots: [
			"lentille",
			"lentilles",
			"dahl",
			"dal"
		],
		source: "feculents.leg.cuisson.lentilles ; reperes-portion"
	},
	{
		id: "pois-chiches",
		nom: "pois chiches ou haricots",
		pourDeux: "1 boîte (240 g égouttés) ou 120 g secs trempés la veille",
		repere: "secs : trempage 8 à 12 h puis 60 à 90 min, donc en boîte un soir de semaine ; haricots jamais crus",
		mots: [
			"pois chiche",
			"pois chiches",
			"houmous",
			"falafel",
			"haricots rouges",
			"haricots blancs",
			"chili"
		],
		source: "feculents.leg.trempage ; feculents.leg.haricots-rouges.securite"
	},
	{
		id: "pain",
		nom: "pain, tarte ou galette",
		pourDeux: "1 pâte ou 4 tranches",
		repere: "tartine, croque, tarte salée ou galette : four chaud, garniture de saison",
		mots: [
			"tarte",
			"quiche",
			"croque",
			"tartine",
			"galette",
			"pizza",
			"wrap",
			"burger",
			"sandwich"
		],
		source: "Kora (repas du soir simples)"
	}
];
const PROTEINES = [
	{
		id: "volaille",
		nom: "volaille",
		vegetarien: false,
		pourDeux: "200 à 240 g sans os",
		repere: "cuite à cœur, 72 °C au moins",
		mots: [
			"poulet",
			"volaille",
			"dinde",
			"canard",
			"cuisse"
		],
		source: "reperes-portion ; sauces-cuissons.securite.volaille-porc"
	},
	{
		id: "boeuf",
		nom: "bœuf ou veau",
		vegetarien: false,
		pourDeux: "200 à 240 g sans os",
		repere: "émincé saisi à feu vif ; entrecôte de 2 à 3 cm, 3 à 4 min par face pour saignant ; haché bien cuit",
		mots: [
			"boeuf",
			"veau",
			"steak",
			"entrecote",
			"hache",
			"bolognaise",
			"emince",
			"boulettes"
		],
		source: "reperes-portion ; sauces-cuissons.cuisson.griller"
	},
	{
		id: "porc",
		nom: "porc",
		vegetarien: false,
		pourDeux: "200 à 240 g sans os",
		repere: "62 à 65 °C à cœur pour un filet ; saucisse bien cuite",
		mots: [
			"porc",
			"saucisse",
			"jambon",
			"lard",
			"lardons",
			"chorizo",
			"cervelas",
			"pancetta"
		],
		source: "reperes-portion ; sauces-cuissons.securite.volaille-porc"
	},
	{
		id: "poisson",
		nom: "poisson",
		vegetarien: false,
		pourDeux: "2 filets d'environ 150 g",
		repere: "poché sans ébullition (70 à 80 °C) ou à la poêle ; 55 à 60 °C à cœur",
		mots: [
			"poisson",
			"saumon",
			"cabillaud",
			"truite",
			"perche",
			"thon",
			"colin",
			"crevette",
			"moules",
			"lieu"
		],
		source: "sauces-cuissons.cuisson.pocher ; sauces-cuissons.securite.poisson"
	},
	{
		id: "oeufs",
		nom: "œufs",
		vegetarien: true,
		pourDeux: "4 à 6 œufs",
		repere: "coque 3 min, mollet 6 min, dur 9 min, poché 3 à 4 min dans une eau frémissante",
		mots: [
			"oeuf",
			"oeufs",
			"omelette",
			"frittata",
			"shakshuka",
			"quiche"
		],
		source: "reperes-portion ; legumes.oeuf.mollet"
	},
	{
		id: "fromage",
		nom: "fromage",
		vegetarien: true,
		pourDeux: "120 à 160 g",
		repere: "gruyère, raclette, chèvre ou feta : gratiné, fondu ou en finition",
		mots: [
			"fromage",
			"gruyere",
			"raclette",
			"fondue",
			"chevre",
			"feta",
			"mozzarella",
			"halloumi",
			"parmesan",
			"ricotta"
		],
		source: "Kora (repas du soir simples)"
	},
	{
		id: "legumineuses",
		nom: "légumineuses ou tofu",
		vegetarien: true,
		pourDeux: "120 à 140 g secs, 1 boîte ou 200 g de tofu",
		repere: "lentilles, pois chiches ou tofu doré : le plat sans viande de la semaine",
		mots: [
			"lentille",
			"pois chiche",
			"haricot",
			"tofu",
			"dahl",
			"falafel"
		],
		source: "reperes-portion"
	}
];
/** Combien de jours un reste se garde au frigo, en retenant la valeur prudente. */
const RESTES = [
	{
		quoi: "riz cuit",
		jours: 1,
		source: "feculents.riz.conservation.cuit"
	},
	{
		quoi: "pâtes cuites, légumes cuits, sauces cuites",
		jours: 2,
		source: "legumes.avance.legumes-cuits-gvg"
	},
	{
		quoi: "gratin de légumes, pommes de terre cuites",
		jours: 3,
		source: "legumes.avance.gratin-legumes"
	},
	{
		quoi: "légumineuses cuites",
		jours: 3,
		source: "feculents.leg.conservation.cuites"
	}
];
/** Les gestes sûrs que le Chef glisse dans les étapes. */
const GESTES = [
	"Réchauffer un reste à cœur, 70 °C au moins ; le riz cuit se refroidit vite et se mange le lendemain au plus tard.",
	"Herbes fragiles (basilic, coriandre, ciboulette, menthe) hors du feu ; thym, romarin et laurier dès le début, une branche suffit.",
	"Légumes rôtis vers 200 °C : courgette 15 à 22 min, poivron 20 à 25, carotte en rondelles 20 à 30.",
	"Légumes verts blanchis 30 s à 3 min à grande eau salée (haricots verts 4 à 5 min, chou-fleur 5 à 6), puis eau glacée pour garder la couleur.",
	"Étuver courgettes et poireaux à couvert, peu de liquide, 8 à 15 min ; glacer carottes et navets au beurre et au sucre.",
	"Des morceaux de même taille cuisent ensemble ; une viande rôtie repose 10 à 15 min avant d'être tranchée.",
	"Assaisonner une sauce en dernier, quand elle a sa consistance ; finir au citron après avoir lié.",
	"Tomates, pommes de terre, oignons et ail ne vont pas au frigo ; champignons dans un sac en papier, essuyés, jamais trempés."
];
/** Le savoir qui accompagne les consignes du Chef, avec la saison du mois. */
function savoirPourLeChef(mois) {
	return [
		`Savoir de cuisine (référentiel du brevet de chef de cuisine, choisi pour la maison) :`,
		`- Légumes suisses de saison en ${NOMS_MOIS[mois - 1]} : ${legumesDuMois(mois).join(", ")}.`,
		`- Quantités pour deux (crues ou sèches) : ${BASES.filter((b) => b.id !== "pain").map((b) => `${b.nom} ${b.pourDeux}`).join(" ; ")} ; viande sans os 200 à 240 g ; poisson 2 filets d'environ 150 g ; œufs 4 à 6.`,
		`- Les bases : ${BASES.map((b) => `${b.nom} (${b.repere})`).join(" ; ")}.`,
		`- Cuissons sûres : ${PROTEINES.filter((p) => !p.vegetarien).map((p) => `${p.nom} ${p.repere}`).join(" ; ")} ; œufs : ${PROTEINES.find((p) => p.id === "oeufs").repere}.`,
		`- Restes au frigo, au plus : ${RESTES.map((r) => `${r.quoi} ${r.jours} jour${r.jours > 1 ? "s" : ""}`).join(" ; ")}.`,
		...GESTES.map((g) => `- ${g}`)
	].join("\n");
}
/** Le poids d'un choix selon l'ancienneté de son dernier passage : la semaine passée, il y a deux, trois, quatre semaines. */
const POIDS_SELON_SEMAINES = [
	.1,
	.3,
	.6,
	.85
];
/** Ce que les menus passés ont servi : pour chaque base, protéine ou légume, la semaine la plus récente (1 = la semaine passée). */
function dejaServi(menus, aujourdhui) {
	const vu = /* @__PURE__ */ new Map();
	const noter = (cle, semaines) => {
		if (!vu.has(cle) || vu.get(cle) > semaines) vu.set(cle, semaines);
	};
	for (const m of menus) {
		const ecart = ecartJours(m.semaine, aujourdhui);
		if (ecart <= 0 || ecart > 28) continue;
		const semaines = Math.min(4, Math.ceil(ecart / 7));
		const trame = lireTrame(m.trame);
		if (trame) {
			for (const t of trame) {
				noter(`base:${t.base}`, semaines);
				noter(`proteine:${t.proteine}`, semaines);
				for (const l of t.legumes) noter(`legume:${normaliser(l)}`, semaines);
			}
			continue;
		}
		const texte = ` ${normaliser(m.repas.map((r) => [
			r.titre,
			r.description,
			...r.avecLeStock
		].join(" ")).join(" "))} `;
		const contient = (mot) => new RegExp(`[^a-z]${mot.replace(/[-]/g, "[- ]")}[sx]?[^a-z]`).test(texte);
		for (const b of BASES) if (b.mots.some(contient)) noter(`base:${b.id}`, semaines);
		for (const p of PROTEINES) if (p.mots.some(contient)) noter(`proteine:${p.id}`, semaines);
		for (const l of legumesDuMois(Number(aujourdhui.slice(5, 7)))) if (contient(normaliser(l))) noter(`legume:${normaliser(l)}`, semaines);
	}
	return vu;
}
const poids = (vu, cle) => {
	const semaines = vu.get(cle);
	return semaines === void 0 ? 1 : POIDS_SELON_SEMAINES[semaines - 1] ?? 1;
};
/** Un tirage au sort pondéré ; null quand il ne reste rien à tirer. */
function tirer(choix, poidsDe, hasard) {
	const poidsListe = choix.map(poidsDe);
	const total = poidsListe.reduce((a, b) => a + b, 0);
	if (!choix.length || total <= 0) return null;
	let r = hasard() * total;
	for (let i = 0; i < choix.length; i++) {
		r -= poidsListe[i];
		if (r < 0) return choix[i];
	}
	return choix[choix.length - 1];
}
/** La trame des soirs de la semaine. */
function tirerSemaine(d) {
	const mois = Number(d.aujourdhui.slice(5, 7));
	const vu = dejaServi(d.menus, d.aujourdhui);
	const legumes = legumesDuMois(mois);
	const bases = /* @__PURE__ */ new Set();
	const proteines = [];
	const legumesPris = /* @__PURE__ */ new Set();
	const vegetarienAuPlusTard = Math.floor(d.hasard() * d.nombre);
	const soirs = [];
	for (let i = 0; i < d.nombre; i++) {
		const base = tirer(BASES.filter((b) => !bases.has(b.id)), (b) => poids(vu, `base:${b.id}`), d.hasard) ?? BASES[i % BASES.length];
		bases.add(base.id);
		const dejaVegetarien = proteines.some((id) => PROTEINES.find((p) => p.id === id)?.vegetarien);
		const proteine = tirer(PROTEINES.filter((p) => proteines.filter((id) => id === p.id).length < 2 && proteines[proteines.length - 1] !== p.id && (dejaVegetarien || i < vegetarienAuPlusTard || p.vegetarien)), (p) => poids(vu, `proteine:${p.id}`), d.hasard) ?? PROTEINES[i % PROTEINES.length];
		proteines.push(proteine.id);
		const deux = [];
		for (let n = 0; n < 2; n++) {
			const libres = legumes.filter((l) => !legumesPris.has(l) && !deux.includes(l));
			const l = tirer(libres.length ? libres : legumes.filter((x) => !deux.includes(x)), (x) => poids(vu, `legume:${normaliser(x)}`), d.hasard);
			if (!l) break;
			deux.push(l);
			legumesPris.add(l);
		}
		soirs.push({
			base: base.id,
			proteine: proteine.id,
			legumes: deux
		});
	}
	return soirs;
}
/** La trame telle que le Chef la lit : « Soir 1 : pâtes · poisson · poireau, courge ». */
function decrireTrame(trame) {
	const nomBase = (id) => BASES.find((b) => b.id === id)?.nom ?? id;
	const nomProteine = (id) => PROTEINES.find((p) => p.id === id)?.nom ?? id;
	return trame.map((t, i) => `- Soir ${i + 1} : ${nomBase(t.base)} · ${nomProteine(t.proteine)} · ${t.legumes.join(", ")}`);
}
/** Relit une trame gardée dans un menu, sans lui faire confiance. */
function lireTrame(brut) {
	if (!Array.isArray(brut)) return void 0;
	const trame = brut.filter((t) => !!t && typeof t === "object").map((t) => ({
		base: typeof t.base === "string" ? t.base : "",
		proteine: typeof t.proteine === "string" ? t.proteine : "",
		legumes: Array.isArray(t.legumes) ? t.legumes.filter((l) => typeof l === "string") : []
	})).filter((t) => t.base && t.proteine);
	return trame.length ? trame : void 0;
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
const CONSIGNES_CHEF = `Tu es le Chef de la semaine de KoraHome, l'app d'un couple qui vit à Renens, dans le canton de Vaud.
Chaque dimanche, tu proposes 5 repas du soir pour la semaine, simples (45 minutes au plus), de saison en Suisse romande, pour deux personnes.
Utilise d'abord les produits à finir vite, puis le reste du frigo, du congélateur et des placards. Varie les plats, évite deux fois la même base.
Pour chaque repas, donne la recette complète pour deux personnes : tous ses ingrédients avec leur quantité (ceux du stock compris ; nom court dans « nom », quantité courte dans « quantite » ou vide), puis trois à huit étapes courtes et claires.
Si une recette que le foyer aime convient à la semaine, reprends-la sous son titre exact.
Ensuite, liste les ingrédients qui manquent pour ces repas : un article par ligne, nom court au singulier ou tel qu'on l'écrit sur une liste (« Poireaux », « Crème entière »), quantité courte (« 500 g », « 2 », « 1 l ») ou vide.
Ne remets pas ce qui est déjà dans le stock ou déjà sur la liste de courses. Les épices, le sel, le poivre et l'huile sont supposés à la maison sauf s'ils sont vraiment absents.
Ne mets jamais de croquettes, de litière ni rien pour le chat : cela se commande ailleurs.
Kora a tiré au sort une trame pour chaque soir (une base, une protéine, deux légumes de saison) pour que les semaines ne se ressemblent pas : construis chaque repas sur la trame de son soir, dans l'ordre. Tu peux échanger un élément contre un produit à finir vite, ou contre un plat que le foyer aime, mais garde la variété : pas deux fois la même base dans la semaine.
Appuie-toi sur le savoir de cuisine fourni : légumes de saison, quantités pour deux, temps et températures de cuisson, durée des restes. Les quantités des ingrédients suivent ces repères ; les étapes donnent les temps et les gestes justes. Quand une préparation se fait une fois pour deux soirs (légumineuses, sauce, légumes rôtis), dis-le dans la description, en respectant la durée des restes (jamais de riz cuit gardé plus d'un jour).
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
	const lignes = [`Nous sommes le ${Number(d.aujourdhui.slice(8, 10))} ${NOMS_MOIS[Number(d.aujourdhui.slice(5, 7)) - 1]} ${d.aujourdhui.slice(0, 4)}.`, ""];
	lignes.push("À finir vite :", ...aFinir.length ? aFinir.map((p) => `- ${decrire(p)}`) : ["- rien de pressé"], "");
	for (const lieu of ORDRE_LIEUX) {
		const ici = d.produits.filter((p) => p.lieu === lieu && !urgents.has(p.id));
		if (ici.length) lignes.push(`${LIEUX[lieu]} :`, ...ici.map((p) => `- ${decrire(p)}`), "");
	}
	if (!d.produits.length) lignes.push("Le stock est vide : propose des repas simples avec des ingrédients courants.", "");
	lignes.push("Déjà sur la liste de courses :", ...d.enCourses.length ? d.enCourses.map((e) => `- ${e.texte}${e.quantite ? ` · ${e.quantite}` : ""}`) : ["- rien"]);
	const memoire = souvenirsRetenus(d.souvenirs ?? []).sort((a, b) => a.creeLe.localeCompare(b.creeLe)).slice(-40);
	if (memoire.length) lignes.push("", "Ce que le foyer aime, n'aime pas ou a l'habitude de faire :", ...memoire.map((s) => `- ${s.texte}`));
	const avis = (r) => avisDuPlat(d.souvenirs ?? [], r.titre)?.avis ?? null;
	const reprendre = recettesPourLeChef(d.recettes ?? [], (r) => avis(r) === "aime", (r) => avis(r) === "non");
	if (reprendre.length) lignes.push("", "Recettes du foyer qu'il aime refaire :", ...reprendre.map((t) => `- ${t}`));
	if (d.trame?.length) lignes.push("", "La trame tirée par Kora pour cette semaine :", ...decrireTrame(d.trame));
	lignes.push("", savoirPourLeChef(Number(d.aujourdhui.slice(5, 7))));
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
					"avecLeStock",
					"portions",
					"ingredients",
					"etapes"
				],
				properties: {
					titre: { type: "string" },
					description: { type: "string" },
					avecLeStock: {
						type: "array",
						items: { type: "string" }
					},
					portions: { type: "integer" },
					ingredients: {
						type: "array",
						items: {
							type: "object",
							additionalProperties: false,
							required: ["nom", "quantite"],
							properties: {
								nom: { type: "string" },
								quantite: { type: "string" }
							}
						}
					},
					etapes: {
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
	const lus = (Array.isArray(o.repas) ? o.repas : []).map((r) => ({
		repas: {
			titre: chaine(r?.titre, 80),
			description: chaine(r?.description, 300),
			avecLeStock: (Array.isArray(r?.avecLeStock) ? r.avecLeStock : []).map((s) => chaine(s, 60)).filter(Boolean).slice(0, 8)
		},
		recette: lireBrouillon(r, "chef")
	})).filter((r) => r.repas.titre).slice(0, 5);
	if (!lus.length) return null;
	const repas = lus.map((l) => l.repas);
	const recettes = lus.map((l) => l.recette);
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
		recettes,
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
/**
* Les repas du Chef entrent dans les recettes du foyer : une recette déjà là monte sans être
* copiée. Rend les recettes à enregistrer et les repas reliés à leur fiche.
*/
function recettesDuChef(proposition, docs, ctx) {
	let base = recettesDe(docs);
	const recettes = [];
	return {
		repas: proposition.repas.map((r, i) => {
			const b = proposition.recettes[i];
			if (!b) return r;
			const { recette } = apprendreRecette(base, {
				...b,
				titre: r.titre
			}, ctx);
			base = [...base.filter((x) => x.id !== recette.id), recette];
			if (!recettes.some((x) => x.id === recette.id)) recettes.push(recette);
			else recettes.splice(recettes.findIndex((x) => x.id === recette.id), 1, recette);
			return {
				...r,
				recetteId: recette.id
			};
		}),
		recettes
	};
}
/** Un soir du Chef resté sans fiche reçoit la recette écrite après coup par la fée (0.0.80). */
function relierRecette(menu, rang, recetteId) {
	return {
		...menu,
		repas: menu.repas.map((r, i) => i === rang ? {
			...r,
			recetteId
		} : r)
	};
}
function nouveauMenu(d, ctx) {
	return {
		id: idMenu(d.aujourdhui),
		type: "menu",
		semaine: d.aujourdhui,
		mot: d.proposition.mot,
		repas: d.repas ?? d.proposition.repas,
		ajouts: (d.ajouts ?? []).map((e) => ({
			elementId: e.id,
			texte: e.texte,
			quantite: e.quantite,
			rayon: e.rayon
		})),
		aAcheter: d.proposition.aAcheter.filter((a) => !POUR_LE_CHAT.test(normaliser(a.texte)) && a.rayon !== "Animaux").slice(0, 30),
		aFinir: produitsAFinir(d.produits, d.aujourdhui).map((p) => `${p.nom} · ${decrirePeremption(p, d.aujourdhui)}`),
		alertesMitsu: alertesMitsu(d.animaux, d.aujourdhui),
		...d.trame?.length ? { trame: d.trame } : {},
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
/** Le menu validé : ses recettes sont gardées pour de bon. */
function validerMenu(menu, ctx) {
	return {
		...menu,
		valideLe: ctx.maintenant()
	};
}
const versAjout = (e, repas) => ({
	elementId: e.id,
	texte: e.texte,
	quantite: e.quantite,
	rayon: e.rayon,
	...repas === void 0 ? {} : { repas }
});
const marquerChef = (e) => ({
	...e,
	source: "chef"
});
/**
* Valider un soir : ce qui manque pour sa recette (d'après le stock et la liste) part aux
* courses, marqué « Chef ». Le menu entier est validé quand tous ses soirs le sont.
*/
function validerSoir(d, ctx) {
	const r = d.menu.repas[d.rang];
	if (!r || r.valideLe) return {
		menu: d.menu,
		ajouts: []
	};
	const ajouts = d.recette && d.liste ? preparerCourses(d.recette, d.recette.portions, d.produits, d.liste, d.elements, d.membreId, ctx).map(marquerChef) : [];
	const repas = d.menu.repas.map((x, i) => i === d.rang ? {
		...x,
		valideLe: ctx.maintenant()
	} : x);
	const menu = {
		...d.menu,
		repas,
		ajouts: [...d.menu.ajouts, ...ajouts.map((e) => versAjout(e, d.rang))]
	};
	return {
		menu: repas.every((x) => x.valideLe) && !menu.valideLe ? validerMenu(menu, ctx) : menu,
		ajouts
	};
}
/** Revenir sur un soir validé : ses articles pas encore achetés quittent la liste. */
function devaliderSoir(menu, rang, elements) {
	const siens = new Set(menu.ajouts.filter((a) => a.repas === rang).map((a) => a.elementId));
	const aRetirer = elements.filter((e) => siens.has(e.id) && !e.coche).map((e) => e.id);
	const retires = new Set(aRetirer);
	const repas = menu.repas.map((x, i) => i === rang ? {
		...x,
		valideLe: void 0
	} : x);
	const { valideLe: _ancien, ...sansValidation } = menu;
	return {
		menu: {
			...sansValidation,
			repas,
			ajouts: menu.ajouts.filter((a) => !retires.has(a.elementId))
		},
		aRetirer
	};
}
/**
* Valider tout le menu : la liste du Chef pour la semaine part aux courses (sans doublon avec ce
* qui y est déjà, y compris les soirs validés un à un), et tous les soirs sont validés.
*/
function validerToutLeMenu(menu, liste, elements, ctx) {
	const ajouts = liste && menu.aAcheter?.length ? preparerAjouts(menu.aAcheter, liste, elements, ctx) : [];
	const instant = ctx.maintenant();
	return {
		menu: {
			...menu,
			repas: menu.repas.map((r) => r.valideLe ? r : {
				...r,
				valideLe: instant
			}),
			ajouts: [...menu.ajouts, ...ajouts.map((e) => versAjout(e))],
			valideLe: instant
		},
		ajouts
	};
}
/**
* Ce qu'efface « Effacer ce menu » : le menu, les articles du Chef pas encore cochés et, si le
* menu n'a pas été validé, ses recettes jamais cuisinées ni proposées une autre semaine.
*/
function ceQuEfface(menu, recettes, elements) {
	const duMenu = new Set(menu.repas.map((r) => r.recetteId).filter((id) => !!id));
	return {
		recettes: menu.valideLe ? [] : recettes.filter((r) => duMenu.has(r.id) && r.source === "chef" && r.fois === 0 && r.vue <= 1).map((r) => r.id),
		elements: etatDesAjouts(menu, elements).flatMap(({ element }) => element && !element.coche ? [element.id] : [])
	};
}
/** Le texte de la notification quand les menus sont prêts. */
function notificationChef(menu) {
	const n = menu.aAcheter?.length || menu.ajouts.length;
	const courses = n ? `Valide les soirs qui te vont : ${n} article${n > 1 ? "s" : ""} à acheter.` : "Rien à acheter.";
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
export { AJOUTS_MAX, CONSIGNES_CHEF, HEURE_DU_CHEF, JOURS_ALERTE_MITSU, JOURS_A_FINIR, JOUR_DU_CHEF, MODELE_CHEF, NOMBRE_REPAS, REGLAGE_DE_DEPART, SCHEMA_CHEF, SOUVENIRS_DU_CHEF, alertesMitsu, articlesARemplacer, avisDuPlat, avisSurPlat, ceQuEfface, cleAvis, coutChef, devaliderSoir, estLHeureDuChef, etatBudget, etatDesAjouts, idMenu, jourEtHeure, lireProposition, menuDeLaSemaine, messageChef, moisDe, nomDuJour, notificationChef, nouveauMenu, preparerAjouts, prochainPassage, produitsAFinir, recettesDe, recettesDuChef, reglageChef, reglerChef, relierRecette, retirerAjout, tirerSemaine, validerMenu, validerSoir, validerToutLeMenu };
