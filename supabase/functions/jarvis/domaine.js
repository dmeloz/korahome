// Généré par `npm run fonction` depuis src/domaine/jarvis.ts : ne pas modifier à la main.
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
function nouvelElement(liste, saisie, ajoutePar, ctx) {
	const { texte, quantite } = analyserSaisie(saisie);
	if (texte.length === 0) throw new ErreurValidation("L'élément est vide.");
	return {
		id: ctx.nouvelId(),
		listeId: liste.id,
		texte,
		quantite,
		rayon: liste.type === "courses" ? detecterRayon(texte) : "Autre",
		coche: false,
		ajoutePar,
		creeLe: ctx.maintenant(),
		cocheLe: null
	};
}
/** Un élément déjà présent et non coché, au même nom, est un doublon. */
function trouverDoublon(elements, saisie) {
	const { texte } = analyserSaisie(saisie);
	const cle = texte.toLowerCase();
	return elements.find((e) => !e.coche && e.texte.toLowerCase() === cle);
}
//#endregion
//#region src/domaine/taches.ts
const RE_JOUR$2 = /^\d{4}-\d{2}-\d{2}$/;
function versDate(jour) {
	if (!RE_JOUR$2.test(jour)) throw new ErreurValidation(`Date invalide : « ${jour} ».`);
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
const RECURRENCES = [
	{
		libelle: "Une fois",
		valeur: null
	},
	{
		libelle: "Chaque jour",
		valeur: {
			unite: "jour",
			tous: 1
		}
	},
	{
		libelle: "Chaque semaine",
		valeur: {
			unite: "semaine",
			tous: 1
		}
	},
	{
		libelle: "Toutes les 2 semaines",
		valeur: {
			unite: "semaine",
			tous: 2
		}
	},
	{
		libelle: "Chaque mois",
		valeur: {
			unite: "mois",
			tous: 1
		}
	}
];
function decrireRecurrence(r) {
	if (!r) return "Une fois";
	const connue = RECURRENCES.find((x) => x.valeur && x.valeur.unite === r.unite && x.valeur.tous === r.tous);
	if (connue) return connue.libelle;
	const unite = {
		jour: "jours",
		semaine: "semaines",
		mois: "mois"
	}[r.unite];
	return `Tous les ${r.tous} ${unite}`;
}
function nouvelleTache(titre, recurrence, echeance, ctx, responsable = null) {
	const t = titre.trim().replace(/\s+/g, " ");
	if (t.length === 0) throw new ErreurValidation("La tâche doit avoir un nom.");
	if (recurrence && (!Number.isInteger(recurrence.tous) || recurrence.tous < 1)) throw new ErreurValidation("La fréquence doit être d'au moins 1.");
	versDate(echeance);
	return {
		id: ctx.nouvelId(),
		titre: t.charAt(0).toUpperCase() + t.slice(1),
		recurrence,
		echeance,
		responsable,
		faiteLe: null,
		faitePar: null,
		creeLe: ctx.maintenant()
	};
}
/**
* Marque la tâche comme faite. Une tâche qui revient repart depuis le jour où
* elle a été faite (faite en retard mardi, chaque semaine → mardi suivant) ;
* une tâche unique reste faite.
*/
function marquerFaite(tache, par, aujourdhui, ctx) {
	const faite = {
		...tache,
		faiteLe: ctx.maintenant(),
		faitePar: par
	};
	if (!tache.recurrence) return faite;
	const depart = ecartJours(tache.echeance, aujourdhui) < 0 ? tache.echeance : aujourdhui;
	return {
		...faite,
		echeance: decaler(depart, tache.recurrence)
	};
}
/** Une tâche unique faite est terminée ; une tâche qui revient ne l'est jamais. */
function estTerminee(tache) {
	return !tache.recurrence && tache.faiteLe !== null;
}
/** « en retard de 2 jours », « aujourd'hui », « demain », « dans 5 jours ». */
function decrireEcheance(echeance, aujourdhui) {
	const ecart = ecartJours(aujourdhui, echeance);
	if (ecart < -1) return `en retard de ${-ecart} jours`;
	if (ecart === -1) return "depuis hier";
	if (ecart === 0) return "aujourd'hui";
	if (ecart === 1) return "demain";
	return `dans ${ecart} jours`;
}
//#endregion
//#region src/domaine/mitsu.ts
const RE_JOUR$1 = /^\d{4}-\d{2}-\d{2}$/;
function verifierJour(jour, quoi) {
	if (!RE_JOUR$1.test(jour)) throw new ErreurValidation(`${quoi} : la date est invalide.`);
}
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
/** Vers 12 mois, on passe des croquettes chaton aux croquettes adulte. */
function passageAdulte(naissance) {
	return plusMois(naissance, 12);
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
/**
* Ration de croquettes du jour. La ration du paquet, quand elle est notée, fait foi.
* Sinon : besoin au repos 70 × poids(kg)^0,75 kcal, multiplié selon l'âge, divisé
* par l'énergie des croquettes. C'est une estimation, à arrondir à 5 g.
*/
function rationDuJour(animal, aujourdhui) {
	const k = animal.reglages.kcalParGramme;
	if (animal.reglages.rationDuPaquet) {
		const g = animal.reglages.rationDuPaquet;
		return {
			grammes: g,
			kcal: Math.round(g * k),
			source: "paquet"
		};
	}
	const poids = poidsActuel(animal);
	if (!poids) return null;
	const kcal = 70 * Math.pow(poids.grammes / 1e3, .75) * facteurCroissance(ageEnMois(animal.naissance, aujourdhui), animal.sterilise);
	return {
		grammes: Math.round(kcal / k / 5) * 5,
		kcal: Math.round(kcal),
		source: "estimee"
	};
}
function ajouterPesee(animal, grammes, jour, par, ctx) {
	verifierJour(jour, "Pesée");
	if (!Number.isFinite(grammes) || grammes < 100 || grammes > 15e3) throw new ErreurValidation("Le poids doit être entre 0,1 et 15 kg.");
	const pesee = {
		id: ctx.nouvelId(),
		jour,
		grammes: Math.round(grammes),
		par
	};
	return {
		...animal,
		pesees: [...animal.pesees.filter((p) => p.jour !== jour), pesee]
	};
}
/** Prochaine pesée, au rythme choisi après la dernière. */
function prochainePesee(animal, aujourdhui) {
	const derniere = poidsActuel(animal);
	if (!derniere) return aujourdhui;
	return plusJours(derniere.jour, animal.reglages.peseeTousLes);
}
/** « 2,45 kg ». */
function formaterPoids(grammes) {
	return `${(grammes / 1e3).toLocaleString("fr-CH", { maximumFractionDigits: 2 })} kg`;
}
/** L'article de la commande régulière qui réapprovisionne cette provision. */
function articleDe(provision, animal) {
	return animal.commande?.articles.find((a) => a.type === provision.type && a.nom === provision.nom);
}
/** Durée d'un cycle de commande, en jours. */
function joursDuCycle(commande) {
	return ecartJours(commande.prochaine, plusMois(commande.prochaine, commande.tousLesMois));
}
/**
* Consommation par jour, dans l'ordre : celle notée sur la provision, la ration du jour
* pour les croquettes (quand on connaît son poids ou la ration du paquet), sinon ce que la
* commande régulière laisse supposer (6 kg tous les 3 mois ≈ 65 g par jour).
*/
function consommationParJour(provision, animal, aujourdhui) {
	if (provision.parJour) return provision.parJour;
	if (provision.type === "filtres") return 1 / 30;
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
/** Les provisions de la commande qui seront vides avant que la prochaine arrive. */
function videsAvantLivraison(animal, aujourdhui) {
	const commande = animal.commande;
	if (!commande) return [];
	const arrivee = plusJours(commande.prochaine, 3);
	return animal.provisions.flatMap((p) => {
		if (!articleDe(p, animal)) return [];
		const prev = prevoir(p, animal, aujourdhui);
		return prev && prev.fin < arrivee ? [{
			provision: p,
			fin: prev.fin
		}] : [];
	});
}
/**
* Ce qui ne revient pas à chaque commande (les filtres : 6 pour 6 mois) mais sera vide
* avant la commande d'après : à ajouter à la prochaine.
*/
function aAjouterALaCommande(animal, aujourdhui) {
	const commande = animal.commande;
	if (!commande) return [];
	const suivante = plusJours(plusMois(commande.prochaine, commande.tousLesMois), 3);
	return animal.provisions.flatMap((p) => {
		if (articleDe(p, animal)) return [];
		const prev = prevoir(p, animal, aujourdhui);
		return prev && prev.fin < suivante ? [{
			provision: p,
			fin: prev.fin
		}] : [];
	});
}
/** Les soins à venir, du plus proche au plus lointain. */
function soinsAVenir(animal) {
	return animal.soins.filter((s) => !s.fait).sort((a, b) => a.date.localeCompare(b.date));
}
/** Tout ce qui demande un geste, du plus pressé au moins pressé. */
function choseAFaire(animal, aujourdhui) {
	const urgentes = [];
	const bientot = [];
	const commande = animal.commande;
	if (commande) {
		const ecart = ecartJours(aujourdhui, commande.prochaine);
		if (ecart <= 3) {
			const quand = ecart < 0 ? "en retard" : ecart === 0 ? "aujourd'hui" : ecart === 1 ? "demain" : `dans ${ecart} jours`;
			urgentes.push({
				texte: `Commande ${commande.fournisseur} ${quand}`,
				urgent: true
			});
			for (const { provision } of aAjouterALaCommande(animal, aujourdhui)) urgentes.push({
				texte: `Ajouter ${provision.nom} à la commande`,
				urgent: true
			});
		}
		for (const { provision, fin } of videsAvantLivraison(animal, aujourdhui)) {
			if (ecart <= 3) continue;
			urgentes.push({
				texte: `${provision.nom} : vide vers le ${fin.slice(8, 10)}/${fin.slice(5, 7)}, avant la commande`,
				urgent: true
			});
		}
	}
	for (const p of animal.provisions) {
		if (articleDe(p, animal)) continue;
		const prev = prevoir(p, animal, aujourdhui);
		if (!prev || prev.etat === "ok") continue;
		if (commande && prev.fin >= plusJours(commande.prochaine, 3)) continue;
		urgentes.push({
			texte: prev.etat === "epuise" ? `${p.nom} : c'est fini` : `Commander ${p.nom} : ${prev.joursRestants} j de stock`,
			urgent: true
		});
	}
	for (const s of soinsAVenir(animal)) {
		const ecart = ecartJours(aujourdhui, s.date);
		if (ecart > 7) continue;
		const quand = ecart < 0 ? "en retard" : ecart === 0 ? "aujourd'hui" : ecart === 1 ? "demain" : `dans ${ecart} jours`;
		urgentes.push({
			texte: `${s.libelle} ${quand}`,
			urgent: true
		});
	}
	if (prochainePesee(animal, aujourdhui) <= aujourdhui) bientot.push({
		texte: animal.pesees.length ? "La peser" : "La peser une première fois",
		urgent: false
	});
	const avant = ecartJours(aujourdhui, passageAdulte(animal.naissance));
	if (avant >= 0 && avant <= 30) bientot.push({
		texte: `Passer aux croquettes adulte ${avant === 0 ? "aujourd'hui" : `dans ${avant} jours`}`,
		urgent: false
	});
	return [...urgentes, ...bientot];
}
//#endregion
//#region src/domaine/stock.ts
const LIEUX = {
	frigo: "Frigo",
	congelateur: "Congélateur",
	placard: "Placard"
};
function nouveauProduit(saisie, ajoutePar, ctx) {
	const { texte, quantite } = analyserSaisie(saisie.texte);
	if (texte.length === 0) throw new ErreurValidation("Le produit est vide.");
	return {
		id: ctx.nouvelId(),
		nom: texte,
		quantite,
		lieu: saisie.lieu,
		peremption: saisie.peremption,
		ajoutePar,
		creeLe: ctx.maintenant()
	};
}
/** « périmé depuis 2 jours », « aujourd'hui », « demain », « dans 3 jours », « jusqu'au 12.11 ». */
function decrirePeremption(p, aujourdhui) {
	if (!p.peremption) return null;
	const ecart = ecartJours(aujourdhui, p.peremption);
	if (ecart < -1) return `périmé depuis ${-ecart} jours`;
	if (ecart === -1) return "périmé depuis hier";
	if (ecart === 0) return "à consommer aujourd'hui";
	if (ecart === 1) return "demain";
	if (ecart <= 7) return `dans ${ecart} jours`;
	return `jusqu'au ${p.peremption.slice(8, 10)}.${p.peremption.slice(5, 7)}`;
}
//#endregion
//#region src/domaine/jarvis.ts
/** Un modèle léger et rapide : les demandes du quotidien sont courtes. */
const MODELE_JARVIS = "claude-haiku-5-5";
/** Prix du modèle, en dollars par million de jetons (entrée, sortie). */
const PRIX_USD_PAR_MILLION = {
	entree: .1,
	sortie: .5
};
/** Conversion prudente : un dollar compte pour 0,90 CHF (il en vaut un peu moins). */
const CHF_PAR_USD = .9;
/** Le plafond choisi par Melo : 5 CHF par mois pour tout le foyer. */
const PLAFOND_CHF = 5;
/** À partir de 80 % du plafond, Jarvis prévient. */
const SEUIL_ALERTE = .8;
/** Le coût d'une demande, en millionièmes de franc (un entier, pour additionner sans erreur d'arrondi). */
function coutMicroChf(u) {
	const usd = ((u.input_tokens + 1.25 * (u.cache_creation_input_tokens ?? 0) + .1 * (u.cache_read_input_tokens ?? 0)) * PRIX_USD_PAR_MILLION.entree + u.output_tokens * PRIX_USD_PAR_MILLION.sortie) / 1e6;
	return Math.ceil(usd * CHF_PAR_USD * 1e6);
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
/** « 0,42 CHF » */
function formaterChf(chf) {
	return `${chf.toFixed(2).replace(".", ",")} CHF`;
}
/** Le mois en cours, « AAAA-MM » : le compteur repart à zéro chaque mois. */
function moisDe(jour) {
	return jour.slice(0, 7);
}
const texte = (description) => ({
	type: "string",
	description
});
const ouNul = (description) => ({
	type: ["string", "null"],
	description
});
/** Les outils proposés au modèle (format de l'API Claude, schémas stricts). */
const OUTILS_JARVIS = [
	{
		name: "ajouter_courses",
		description: "Ajoute des articles à la liste de courses du foyer. Un article déjà sur la liste n'est pas ajouté deux fois.",
		strict: true,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: ["articles"],
			properties: { articles: {
				type: "array",
				items: texte("Un article avec sa quantité éventuelle, comme on l'écrirait sur la liste : « lait », « 2 kg de pommes ».")
			} }
		}
	},
	{
		name: "cocher_courses",
		description: "Coche des articles de la liste de courses : ils ont été achetés ou ne sont plus utiles.",
		strict: true,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: ["articles"],
			properties: { articles: {
				type: "array",
				items: texte("Le nom de l'article tel qu'il figure sur la liste.")
			} }
		}
	},
	{
		name: "ajouter_tache",
		description: "Crée une tâche de la maison, unique ou qui revient.",
		strict: true,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: [
				"titre",
				"echeance",
				"responsable",
				"frequence"
			],
			properties: {
				titre: texte("Le nom court de la tâche : « Sortir les poubelles »."),
				echeance: texte("Le jour où la faire, AAAA-MM-JJ."),
				responsable: ouNul("Le prénom de la personne qui s'en charge ; null si la tâche reste libre."),
				frequence: {
					type: ["object", "null"],
					description: "Pour une tâche qui revient : tous les N jours, semaines ou mois. null pour une tâche unique.",
					additionalProperties: false,
					required: ["unite", "tous"],
					properties: {
						unite: {
							type: "string",
							enum: [
								"jour",
								"semaine",
								"mois"
							]
						},
						tous: { type: "integer" }
					}
				}
			}
		}
	},
	{
		name: "tache_faite",
		description: "Marque une tâche existante comme faite par la personne qui parle. Une tâche qui revient repart pour la prochaine fois.",
		strict: true,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: ["titre"],
			properties: { titre: texte("Le nom de la tâche tel qu'il figure dans la liste des tâches.") }
		}
	},
	{
		name: "ajouter_au_stock",
		description: "Range des produits au frigo, au congélateur ou au placard.",
		strict: true,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: ["produits"],
			properties: { produits: {
				type: "array",
				items: {
					type: "object",
					additionalProperties: false,
					required: [
						"nom",
						"lieu",
						"peremption"
					],
					properties: {
						nom: texte("Le produit avec sa quantité éventuelle : « 2 yaourts », « poulet »."),
						lieu: {
							type: "string",
							enum: [
								"frigo",
								"congelateur",
								"placard"
							]
						},
						peremption: ouNul("La date limite, AAAA-MM-JJ ; null si on ne la connaît pas.")
					}
				}
			} }
		}
	},
	{
		name: "noter_pesee",
		description: "Note le poids d'un animal du foyer, pesé aujourd'hui.",
		strict: true,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: ["animal", "grammes"],
			properties: {
				animal: texte("Le nom de l'animal."),
				grammes: {
					type: "integer",
					description: "Le poids en grammes."
				}
			}
		}
	}
];
const CONSIGNES_JARVIS = `Tu es Jarvis, l'assistant d'un foyer en Suisse romande, dans l'app KoraHome sur iPhone.
On te parle souvent à la voix : la demande peut être approximative ou mal transcrite, devine l'intention la plus probable.
Réponds toujours en français, en tutoyant, en une ou deux phrases courtes, sans liste ni mise en forme.
Pour agir, utilise les outils. Quand tu utilises un outil, n'écris rien d'autre : l'app confirme elle-même ce qui a été fait.
Tu peux faire plusieurs actions d'un coup. Les dates sont au format AAAA-MM-JJ ; « demain », « samedi » se comptent depuis la date du jour donnée.
Tu ne supprimes jamais rien et tu ne dépenses jamais d'argent : si on te le demande, explique que ça se fait dans l'app.
Si la demande n'est pas claire ou ne correspond à aucun outil, pose une seule question courte.
Pour une question sur le foyer, réponds à partir de l'état du foyer fourni ; s'il ne contient pas la réponse, dis-le.`;
const listeCourses = (d) => d.listes.find((l) => l.type === "courses") ?? null;
const prenomDe = (foyer, id) => foyer.membres.find((m) => m.id === id)?.prenom ?? null;
const JOURS_SEMAINE = [
	"dimanche",
	"lundi",
	"mardi",
	"mercredi",
	"jeudi",
	"vendredi",
	"samedi"
];
function nomDuJour(jour) {
	const [a, m, j] = jour.split("-").map(Number);
	return JOURS_SEMAINE[new Date(Date.UTC(a, m - 1, j)).getUTCDay()];
}
/** L'état du foyer, en quelques lignes, envoyé avec chaque demande. */
function decrireFoyer(d, membreId, aujourdhui) {
	const lignes = [];
	const moi = prenomDe(d.foyer, membreId);
	lignes.push(`Aujourd'hui : ${nomDuJour(aujourdhui)} ${aujourdhui}.`);
	lignes.push(`Foyer « ${d.foyer.nom} » : ${d.foyer.membres.map((m) => m.prenom).join(", ")}.`);
	lignes.push(moi ? `La personne qui parle : ${moi}.` : "La personne qui parle n'est pas connue.");
	const liste = listeCourses(d);
	const aPrendre = liste ? d.elements.filter((e) => e.listeId === liste.id && !e.coche) : [];
	lignes.push(!liste ? "Pas de liste de courses." : aPrendre.length === 0 ? "Liste de courses : vide." : `Liste de courses : ${aPrendre.map((e) => e.quantite ? `${e.texte} (${e.quantite})` : e.texte).join(", ")}.`);
	const taches = d.taches.filter((t) => !estTerminee(t) && ecartJours(aujourdhui, t.echeance) <= 14).sort((a, b) => a.echeance.localeCompare(b.echeance));
	lignes.push(taches.length === 0 ? "Tâches des deux semaines : aucune." : "Tâches des deux semaines :");
	for (const t of taches) {
		const qui = prenomDe(d.foyer, t.responsable) ?? "libre";
		lignes.push(`- ${t.titre} : ${decrireEcheance(t.echeance, aujourdhui)}, ${qui}, ${decrireRecurrence(t.recurrence).toLowerCase()}`);
	}
	if (d.produits.length > 0) {
		lignes.push("Stock :");
		for (const p of d.produits) {
			const date = decrirePeremption(p, aujourdhui);
			lignes.push(`- ${p.nom}${p.quantite ? ` (${p.quantite})` : ""}, ${LIEUX[p.lieu].toLowerCase()}${date ? `, ${date.toLowerCase()}` : ""}`);
		}
	} else lignes.push("Stock : rien de noté.");
	for (const a of d.animaux) {
		const poids = poidsActuel(a);
		const ration = rationDuJour(a, aujourdhui);
		const aFaire = choseAFaire(a, aujourdhui).map((c) => c.texte);
		lignes.push(`Animal ${a.nom} : ${poids ? `${formaterPoids(poids.grammes)} (pesé le ${poids.jour})` : "pas encore pesé"}${ration ? `, ration ${ration.grammes} g par jour` : ""}${aFaire.length ? `, à faire : ${aFaire.join(" ; ")}` : ""}.`);
	}
	return lignes.join("\n");
}
const estTexte = (v) => typeof v === "string" && v.trim().length > 0;
const textes = (v) => Array.isArray(v) ? v.filter(estTexte) : [];
const RE_JOUR = /^\d{4}-\d{2}-\d{2}$/;
const jourOuNul = (v) => typeof v === "string" && RE_JOUR.test(v) ? v : null;
/**
* Relit les demandes d'outils renvoyées par le modèle ; ce qui est incomplet est ignoré.
* Le modèle respecte les schémas, mais rien ne part dans les données sans être vérifié.
*/
function lireActions(appels) {
	const actions = [];
	for (const { nom, entree } of appels) {
		const e = entree ?? {};
		if (nom === "ajouter_courses" || nom === "cocher_courses") {
			const articles = textes(e.articles);
			if (articles.length) actions.push({
				outil: nom,
				articles
			});
		} else if (nom === "ajouter_tache") {
			const echeance = jourOuNul(e.echeance);
			if (!estTexte(e.titre) || !echeance) continue;
			const f = e.frequence;
			const unite = f?.unite;
			const frequence = (unite === "jour" || unite === "semaine" || unite === "mois") && Number.isInteger(f?.tous) && f?.tous >= 1 ? {
				unite,
				tous: f?.tous
			} : null;
			actions.push({
				outil: nom,
				titre: e.titre,
				echeance,
				responsable: estTexte(e.responsable) ? e.responsable : null,
				frequence
			});
		} else if (nom === "tache_faite") {
			if (estTexte(e.titre)) actions.push({
				outil: nom,
				titre: e.titre
			});
		} else if (nom === "ajouter_au_stock") {
			const produits = (Array.isArray(e.produits) ? e.produits : []).map((p) => p ?? {}).filter((p) => estTexte(p.nom) && typeof p.lieu === "string" && p.lieu in LIEUX).map((p) => ({
				nom: p.nom,
				lieu: p.lieu,
				peremption: jourOuNul(p.peremption)
			}));
			if (produits.length) actions.push({
				outil: nom,
				produits
			});
		} else if (nom === "noter_pesee") {
			if (estTexte(e.animal) && typeof e.grammes === "number") actions.push({
				outil: nom,
				animal: e.animal,
				grammes: e.grammes
			});
		}
	}
	return actions;
}
/** Trouve un nom dans une liste, sans tenir compte des majuscules ni des accents ; d'abord le nom exact, sinon le plus proche. */
function trouverParNom(elements, nom, nomDe) {
	const cle = normaliser(nom);
	return elements.find((e) => normaliser(nomDe(e)) === cle) ?? elements.find((e) => normaliser(nomDe(e)).includes(cle) || cle.includes(normaliser(nomDe(e))));
}
const enumerer = (mots) => mots.length <= 1 ? mots[0] ?? "" : `${mots.slice(0, -1).join(", ")} et ${mots[mots.length - 1]}`;
/**
* Applique les actions de Jarvis aux données du foyer. Ne touche à rien : renvoie les
* documents à enregistrer, chacun avec sa version d'avant, et le récit de ce qui a été fait.
*/
function appliquerActions(actions, donnees, membreId, aujourdhui, ctx) {
	const modifications = [];
	const faits = [];
	const echecs = [];
	let elements = [...donnees.elements];
	let taches = [...donnees.taches];
	let animaux = [...donnees.animaux];
	const liste = listeCourses(donnees);
	for (const action of actions) try {
		switch (action.outil) {
			case "ajouter_courses": {
				if (!liste) {
					echecs.push("Il n'y a pas encore de liste de courses.");
					break;
				}
				const ajoutes = [];
				const deja = [];
				for (const article of action.articles) {
					const doublon = trouverDoublon(elements.filter((e) => e.listeId === liste.id), article);
					if (doublon) {
						deja.push(doublon.texte.toLowerCase());
						continue;
					}
					const element = nouvelElement(liste, article, membreId, ctx);
					elements.push(element);
					modifications.push({
						collection: "elements",
						avant: null,
						apres: element
					});
					ajoutes.push(element.quantite ? `${element.texte.toLowerCase()} (${element.quantite})` : element.texte.toLowerCase());
				}
				if (ajoutes.length) faits.push(`Ajouté aux courses : ${enumerer(ajoutes)}.`);
				if (deja.length) faits.push(`Déjà sur la liste : ${enumerer(deja)}.`);
				break;
			}
			case "cocher_courses": {
				const coches = [];
				for (const article of action.articles) {
					const element = trouverParNom(elements.filter((e) => e.listeId === liste?.id && !e.coche), analyserSaisie(article).texte, (e) => e.texte);
					if (!element) {
						echecs.push(`« ${article} » n'est pas sur la liste.`);
						continue;
					}
					const coche = {
						...element,
						coche: true,
						cocheLe: ctx.maintenant()
					};
					elements = elements.map((e) => e.id === coche.id ? coche : e);
					modifications.push({
						collection: "elements",
						avant: element,
						apres: coche
					});
					coches.push(element.texte.toLowerCase());
				}
				if (coches.length) faits.push(`Coché : ${enumerer(coches)}.`);
				break;
			}
			case "ajouter_tache": {
				const responsable = action.responsable ? trouverParNom(donnees.foyer.membres, action.responsable, (m) => m.prenom) : void 0;
				const tache = nouvelleTache(action.titre, action.frequence, action.echeance, ctx, responsable?.id ?? null);
				taches.push(tache);
				modifications.push({
					collection: "taches",
					avant: null,
					apres: tache
				});
				const qui = responsable ? `, pour ${responsable.prenom}` : "";
				faits.push(`Tâche ajoutée : ${tache.titre.toLowerCase()}, ${decrireEcheance(tache.echeance, aujourdhui)}${qui}.`);
				break;
			}
			case "tache_faite": {
				const tache = trouverParNom(taches.filter((t) => !estTerminee(t)), action.titre, (t) => t.titre);
				if (!tache) {
					echecs.push(`Je ne trouve pas la tâche « ${action.titre} ».`);
					break;
				}
				const faite = marquerFaite(tache, membreId, aujourdhui, ctx);
				taches = taches.map((t) => t.id === faite.id ? faite : t);
				modifications.push({
					collection: "taches",
					avant: tache,
					apres: faite
				});
				faits.push(faite.recurrence ? `C'est noté : ${tache.titre.toLowerCase()} est faite, prochaine fois ${decrireEcheance(faite.echeance, aujourdhui)}.` : `C'est noté : ${tache.titre.toLowerCase()} est faite.`);
				break;
			}
			case "ajouter_au_stock": {
				const ranges = [];
				for (const p of action.produits) {
					const produit = nouveauProduit({
						texte: p.nom,
						lieu: p.lieu,
						peremption: p.peremption
					}, membreId, ctx);
					modifications.push({
						collection: "stock",
						avant: null,
						apres: produit
					});
					ranges.push(`${produit.nom.toLowerCase()} (${LIEUX[produit.lieu].toLowerCase()})`);
				}
				faits.push(`Rangé : ${enumerer(ranges)}.`);
				break;
			}
			case "noter_pesee": {
				const animal = trouverParNom(animaux, action.animal, (a) => a.nom);
				if (!animal) {
					echecs.push(`Je ne connais pas d'animal nommé ${action.animal}.`);
					break;
				}
				const pese = ajouterPesee(animal, action.grammes, aujourdhui, membreId, ctx);
				animaux = animaux.map((a) => a.id === pese.id ? pese : a);
				const deja = modifications.find((m) => m.collection === "animaux" && m.apres.id === animal.id);
				if (deja) deja.apres = pese;
				else modifications.push({
					collection: "animaux",
					avant: animal,
					apres: pese
				});
				faits.push(`Pesée notée : ${animal.nom}, ${formaterPoids(Math.round(action.grammes))}.`);
				break;
			}
		}
	} catch (e) {
		echecs.push(e instanceof Error ? e.message : "Cette action n'a pas pu se faire.");
	}
	return {
		modifications,
		faits,
		echecs
	};
}
/** Ce qui remet chaque document dans son état d'avant, dans l'ordre inverse. */
function annulation(modifications) {
	const vus = /* @__PURE__ */ new Set();
	const resultat = [];
	for (const m of modifications) {
		const cle = `${m.collection}/${m.apres.id}`;
		if (vus.has(cle)) continue;
		vus.add(cle);
		resultat.push({
			collection: m.collection,
			id: m.apres.id,
			remettre: m.avant
		});
	}
	return resultat.reverse();
}
/** Les derniers échanges, pour que « et du beurre aussi » se comprenne. */
const TOURS_RETENUS = 6;
/** Le message envoyé au modèle : les derniers échanges, l'état du foyer, puis la demande. */
function messageDemande(etat, demande, historique = []) {
	const tours = historique.slice(-6).map((t) => `${t.role === "personne" ? "Personne" : "Jarvis"} : ${t.texte}`);
	return `${tours.length ? `Échanges précédents :\n${tours.join("\n")}\n\n` : ""}État du foyer :\n${etat}\n\nDemande : ${demande.trim()}`;
}
//#endregion
export { CONSIGNES_JARVIS, MODELE_JARVIS, OUTILS_JARVIS, PLAFOND_CHF, TOURS_RETENUS, annulation, appliquerActions, coutMicroChf, decrireFoyer, etatBudget, formaterChf, lireActions, messageDemande, moisDe };
