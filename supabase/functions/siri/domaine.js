// Généré par `npm run fonction` depuis src/domaine/siri.ts : ne pas modifier à la main.
//#region src/domaine/foyer.ts
var ErreurValidation = class extends Error {};
//#endregion
//#region src/domaine/taches.ts
const RE_JOUR$3 = /^\d{4}-\d{2}-\d{2}$/;
function versDate(jour) {
	if (!RE_JOUR$3.test(jour)) throw new ErreurValidation(`Date invalide : « ${jour} ».`);
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
	const maintenant = ctx.maintenant();
	const fois = {
		le: aujourdhui,
		par,
		retard: Math.max(0, ecartJours(tache.echeance, aujourdhui)),
		a: maintenant
	};
	const historique = [...tache.historique ?? [], fois].slice(-12);
	const faite = {
		...tache,
		faiteLe: maintenant,
		faitePar: par,
		historique
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
const TYPES_SOIN = {
	vaccin: "Vaccin",
	vermifuge: "Vermifuge",
	antiparasitaire: "Antipuces et tiques",
	sterilisation: "Stérilisation",
	visite: "Visite chez le vétérinaire",
	test: "Test de dépistage",
	filtre: "Changer le filtre de la fontaine",
	autre: "Autre soin"
};
const RE_JOUR$2 = /^\d{4}-\d{2}-\d{2}$/;
function verifierJour(jour, quoi) {
	if (!RE_JOUR$2.test(jour)) throw new ErreurValidation(`${quoi} : la date est invalide.`);
}
const plusJours$1 = (jour, n) => decaler(jour, {
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
/** Corrige le poids estimé et, si on la donne, la ration du jour, sans toucher au carnet des pesées. */
function reglerPoidsEtRation(animal, changement, aujourdhui) {
	const reglages = { ...animal.reglages };
	if (changement.poidsEstime !== void 0) {
		if (changement.poidsEstime === null) reglages.poidsEstime = null;
		else {
			if (!Number.isFinite(changement.poidsEstime) || changement.poidsEstime < 100 || changement.poidsEstime > 15e3) throw new ErreurValidation("Le poids doit être entre 0,1 et 15 kg.");
			reglages.poidsEstime = {
				grammes: Math.round(changement.poidsEstime),
				le: aujourdhui
			};
		}
	}
	if (changement.ration !== void 0) {
		if (changement.ration !== null && (!Number.isFinite(changement.ration) || changement.ration < 1 || changement.ration > 500)) throw new ErreurValidation("La ration doit être entre 1 et 500 g par jour.");
		reglages.rationDuPaquet = changement.ration === null ? null : Math.round(changement.ration);
	}
	return {
		...animal,
		reglages
	};
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
/** Les pesées de la plus récente à la plus ancienne. */
function historiquePesees(animal) {
	return [...animal.pesees].sort((a, b) => b.jour.localeCompare(a.jour));
}
/** Prochaine pesée, au rythme choisi après la dernière. */
function prochainePesee(animal, aujourdhui) {
	const derniere = poidsActuel(animal);
	if (!derniere) return aujourdhui;
	return plusJours$1(derniere.jour, animal.reglages.peseeTousLes);
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
	const fin = plusJours$1(aujourdhui, joursRestants);
	const commanderLe = plusJours$1(fin, -animal.reglages.delaiCommande);
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
	const arrivee = plusJours$1(commande.prochaine, 3);
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
	const suivante = plusJours$1(plusMois(commande.prochaine, commande.tousLesMois), 3);
	return animal.provisions.flatMap((p) => {
		if (articleDe(p, animal)) return [];
		const prev = prevoir(p, animal, aujourdhui);
		return prev && prev.fin < suivante ? [{
			provision: p,
			fin: prev.fin
		}] : [];
	});
}
function nouveauSoin(type, date, libelle, ctx) {
	verifierJour(date, "Soin");
	return {
		id: ctx.nouvelId(),
		type,
		libelle: libelle.trim() || TYPES_SOIN[type],
		date,
		fait: false
	};
}
function ajouterSoin(animal, soin) {
	return {
		...animal,
		soins: [...animal.soins, soin]
	};
}
/** Les soins à venir, du plus proche au plus lointain. */
function soinsAVenir(animal) {
	return animal.soins.filter((s) => !s.fait).sort((a, b) => a.date.localeCompare(b.date));
}
function soinsFaits(animal) {
	return animal.soins.filter((s) => s.fait).sort((a, b) => b.date.localeCompare(a.date));
}
/** Poids médian d'une chatte, mois par mois jusqu'à 1 an (en grammes). Les mâles pèsent environ 20 % de plus. */
const POIDS_FEMELLE = [
	100,
	500,
	900,
	1400,
	1900,
	2300,
	2700,
	3e3,
	3200,
	3400,
	3500,
	3600,
	3700
];
/**
* Le poids habituel d'un chat de cet âge, avec une marge large (± 25 %) : les chats varient
* beaucoup, c'est un repère pour repérer une courbe qui décroche, pas une norme. Après 1 an,
* le repère reste celui de 12 mois.
*/
function poidsRepere(naissance, jour, sexe = "femelle") {
	const mois = Math.max(0, ecartJours(naissance, jour) / 30.44);
	const i = Math.min(Math.floor(mois), POIDS_FEMELLE.length - 1);
	const suivant = POIDS_FEMELLE[Math.min(i + 1, POIDS_FEMELLE.length - 1)];
	const femelle = POIDS_FEMELLE[i] + (suivant - POIDS_FEMELLE[i]) * Math.min(1, mois - i);
	const median = Math.round(femelle * (sexe === "male" ? 1.2 : 1));
	return {
		min: Math.round(median * .75),
		median,
		max: Math.round(median * 1.25)
	};
}
/** Ce que disent ses dernières pesées : une perte de poids, ou un poids loin du repère de son âge. */
function alertePoids(animal) {
	const [derniere, precedente] = historiquePesees(animal);
	if (!derniere) return null;
	if (precedente) {
		const perte = precedente.grammes - derniere.grammes;
		const chaton = ageEnMois(animal.naissance, derniere.jour) < 12;
		if (perte > 0 && (chaton ? perte >= 50 : perte >= precedente.grammes * .05)) return {
			texte: `${animal.nom} a perdu ${perte} g depuis le ${precedente.jour.slice(8, 10)}/${precedente.jour.slice(5, 7)} : à signaler au vétérinaire`,
			urgent: true
		};
	}
	const repere = poidsRepere(animal.naissance, derniere.jour, animal.sexe);
	if (derniere.grammes < repere.min) return {
		texte: "Poids sous le repère de son âge : à montrer au vétérinaire",
		urgent: false
	};
	if (derniere.grammes > repere.max) return {
		texte: "Poids au-dessus du repère de son âge : à montrer au vétérinaire",
		urgent: false
	};
	return null;
}
/** Un soin noté d'un coup, par exemple relu sur une photo du carnet : fait (à sa date) ou à venir. */
function noterSoin(animal, champs, ctx) {
	const details = champs.details?.trim();
	const soin = {
		...nouveauSoin(champs.type, champs.date, champs.libelle, ctx),
		fait: champs.fait,
		...details ? { details } : {}
	};
	if (animal.soins.some((s) => s.type === soin.type && s.date === soin.date && s.libelle === soin.libelle)) return animal;
	return {
		...ajouterSoin(animal, soin),
		sterilise: animal.sterilise || soin.type === "sterilisation" && soin.fait
	};
}
const TYPES_EVENEMENT = {
	litiere: "Litière changée",
	vomi: "A vomi",
	pas_mange: "N'a pas mangé",
	selles: "Selles molles",
	boite: "Boite",
	cachee: "Se cache, abattue",
	autre: "Autre"
};
function noterEvenement(animal, quoi, jour, note, par, ctx) {
	verifierJour(jour, "Journal");
	if (!(quoi in TYPES_EVENEMENT)) throw new ErreurValidation("Cet événement n'existe pas.");
	const texte = note.trim().replace(/\s+/g, " ");
	if (quoi === "autre" && !texte) throw new ErreurValidation("Écris ce qui s'est passé.");
	const evenement = {
		id: ctx.nouvelId(),
		jour,
		quoi,
		note: texte,
		par,
		creeLe: ctx.maintenant()
	};
	return {
		...animal,
		journal: [...animal.journal ?? [], evenement]
	};
}
/** Le journal, du plus récent au plus ancien. */
function journalRecent(animal) {
	return [...animal.journal ?? []].sort((a, b) => b.jour.localeCompare(a.jour) || b.creeLe.localeCompare(a.creeLe));
}
/**
* Un souci qui revient appelle le vétérinaire : ne pas manger deux jours sur trois (un chat qui
* ne mange plus se met vite en danger), vomir ou avoir les selles molles trois fois en une
* semaine, boiter ou se cacher deux fois en une semaine.
*/
function alertesJournal(animal, aujourdhui) {
	const journal = animal.journal ?? [];
	const depuis = (jours, quoi) => journal.filter((e) => e.quoi === quoi && e.jour <= aujourdhui && ecartJours(e.jour, aujourdhui) < jours);
	const alertes = [];
	const pasMange = new Set(depuis(3, "pas_mange").map((e) => e.jour)).size;
	if (pasMange >= 2) alertes.push(`${animal.nom} n'a pas mangé ${pasMange} jours : appeler le vétérinaire`);
	for (const [quoi, seuil] of [
		["vomi", 3],
		["selles", 3],
		["boite", 2],
		["cachee", 2]
	]) {
		const n = depuis(7, quoi).length;
		if (n >= seuil) alertes.push(`${TYPES_EVENEMENT[quoi]} ${n} fois en 7 jours : appeler le vétérinaire`);
	}
	return alertes;
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
		if (commande && prev.fin >= plusJours$1(commande.prochaine, 3)) continue;
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
	for (const texte of alertesJournal(animal, aujourdhui)) urgentes.unshift({
		texte,
		urgent: true
	});
	const poids = alertePoids(animal);
	if (poids) (poids.urgent ? urgentes : bientot).push(poids);
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
/** Dans l'ordre de `Date.getDay()` : le dimanche d'abord. */
const NOMS_JOURS = [
	"dimanche",
	"lundi",
	"mardi",
	"mercredi",
	"jeudi",
	"vendredi",
	"samedi"
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
//#region src/domaine/agenda.ts
const CATEGORIES = {
	rdv: "Rendez-vous",
	anniversaire: "Anniversaire",
	vacances: "Vacances",
	sortie: "Sortie",
	travail: "Travail",
	autre: "Autre"
};
const REPETITIONS = {
	aucune: "Une fois",
	jour: "Chaque jour",
	semaine: "Chaque semaine",
	mois: "Chaque mois",
	annee: "Chaque année"
};
const estEvenement = (d) => "titre" in d && "jour" in d && !d.aRetirer;
const evenementsDe = (docs) => docs.filter(estEvenement);
const RE_JOUR$1 = /^\d{4}-\d{2}-\d{2}$/;
const RE_HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const propre = (t) => t && t.trim() ? t.trim() : null;
/** Vérifie et range ce qui a été saisi ; garde l'identifiant et l'auteur d'un événement modifié. */
function preparerEvenement(e, membreId, ctx, avant) {
	const titre = e.titre.trim();
	if (!titre) throw new ErreurValidation("Donne un nom à l'événement.");
	if (!RE_JOUR$1.test(e.jour)) throw new ErreurValidation("Choisis une date.");
	const fin = e.fin && e.fin !== e.jour ? e.fin : null;
	if (fin && (!RE_JOUR$1.test(fin) || fin < e.jour)) throw new ErreurValidation("La fin doit venir après le début.");
	const heure = propre(e.heure);
	if (heure && !RE_HEURE.test(heure)) throw new ErreurValidation("L'heure n'est pas valable.");
	let heureFin = heure ? propre(e.heureFin) : null;
	if (heureFin && !RE_HEURE.test(heureFin)) throw new ErreurValidation("L'heure de fin n'est pas valable.");
	if (heureFin && !fin && heureFin <= heure) heureFin = null;
	return {
		id: avant?.id ?? ctx.nouvelId(),
		titre: titre.charAt(0).toUpperCase() + titre.slice(1),
		jour: e.jour,
		fin,
		heure,
		heureFin,
		pour: e.pour ?? null,
		categorie: e.categorie ?? "autre",
		repetition: e.repetition ?? "aucune",
		lieu: propre(e.lieu),
		note: propre(e.note),
		creePar: avant ? avant.creePar : membreId,
		creeLe: avant?.creeLe ?? ctx.maintenant(),
		...avant?.jusquau ? { jusquau: avant.jusquau } : {},
		...avant?.intervalle && avant.repetition === (e.repetition ?? "aucune") ? { intervalle: avant.intervalle } : {},
		...avant?.joursSemaine && avant.repetition === "semaine" && e.repetition === "semaine" ? { joursSemaine: avant.joursSemaine } : {},
		...avant?.sauf?.length ? { sauf: avant.sauf } : {},
		...avant?.uid ? { uid: avant.uid } : {},
		...avant?.source ? { source: avant.source } : {},
		...avant?.icloud ? { icloud: avant.icloud } : {},
		modifieLe: ctx.maintenant()
	};
}
const annee = (j) => Number(j.slice(0, 4));
/** La même date une autre année ; le 29 février devient le 28 les années ordinaires. */
function memeDateEn(jour, an) {
	const [, m, d] = jour.split("-").map(Number);
	const dernier = new Date(Date.UTC(an, m, 0)).getUTCDate();
	return `${String(an).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(Math.min(d, dernier)).padStart(2, "0")}`;
}
/** Les débuts de chaque fois que l'événement a lieu et qui touchent la période [du, au]. */
function debutsDans(e, du, au) {
	const duree = e.fin ? ecartJours(e.jour, e.fin) : 0;
	const pas = Math.max(1, Math.floor(e.intervalle ?? 1));
	const limite = e.repetition !== "aucune" && e.jusquau && e.jusquau < au ? e.jusquau : au;
	if (limite < e.jour) return [];
	const sauf = new Set(e.sauf ?? []);
	const touche = (debut) => debut >= e.jour && debut <= limite && !sauf.has(debut) && decaler(debut, {
		unite: "jour",
		tous: duree
	}) >= du;
	const debuts = [];
	if (e.repetition === "aucune") {
		if (touche(e.jour)) debuts.push(e.jour);
	} else if (e.repetition === "jour") {
		const depuis = Math.max(0, Math.floor((ecartJours(e.jour, du) - duree) / pas));
		for (let k = depuis;; k++) {
			const d = decaler(e.jour, {
				unite: "jour",
				tous: pas * k
			});
			if (d > limite) break;
			if (touche(d)) debuts.push(d);
		}
	} else if (e.repetition === "semaine") {
		const lundi = lundiDe(e.jour);
		const jours = (e.joursSemaine?.length ? e.joursSemaine : [jourSemaine(e.jour)]).map((j) => (j + 6) % 7).sort();
		const depuis = Math.max(0, Math.floor((ecartJours(lundi, du) - duree) / (7 * pas)) - 1);
		for (let k = depuis;; k++) {
			const semaine = decaler(lundi, {
				unite: "jour",
				tous: 7 * pas * k
			});
			if (semaine > limite) break;
			for (const j of jours) {
				const d = decaler(semaine, {
					unite: "jour",
					tous: j
				});
				if (touche(d)) debuts.push(d);
			}
		}
	} else if (e.repetition === "mois") {
		const mois = (j) => annee(j) * 12 + Number(j.slice(5, 7));
		const depuis = Math.max(0, Math.floor((mois(du) - mois(e.jour) - 1 - Math.ceil(duree / 28)) / pas));
		for (let k = depuis;; k++) {
			const d = decaler(e.jour, {
				unite: "mois",
				tous: pas * k
			});
			if (d > limite) break;
			if (touche(d)) debuts.push(d);
		}
	} else for (let an = Math.max(annee(e.jour), annee(du) - 1); an <= annee(limite); an++) {
		if ((an - annee(e.jour)) % pas !== 0) continue;
		const d = memeDateEn(e.jour, an);
		if (touche(d)) debuts.push(d);
	}
	return debuts;
}
/** Les rappels prévus au carnet des animaux (vaccin, vermifuge, visite), comme des rendez-vous. */
function evenementsDesAnimaux(animaux) {
	return animaux.flatMap((a) => a.soins.filter((s) => !s.fait).map((s) => ({
		id: `soin-${a.id}-${s.id}`,
		titre: `${a.nom} · ${s.libelle || TYPES_SOIN[s.type]}`,
		jour: s.date,
		fin: null,
		heure: null,
		heureFin: null,
		pour: null,
		categorie: "rdv",
		repetition: "aucune",
		lieu: null,
		note: "Prévu au carnet de santé.",
		creePar: null,
		creeLe: s.date,
		source: `Carnet de ${a.nom}`
	})));
}
/**
* Tout ce qui a lieu entre deux dates (comprises), dans l'ordre : par jour, la journée
* entière d'abord, puis par heure.
*/
function occurrences(evenements, du, au, animaux = []) {
	const resultat = [];
	for (const e of [...evenements, ...evenementsDesAnimaux(animaux)]) {
		const duree = e.fin ? ecartJours(e.jour, e.fin) : 0;
		for (const debut of debutsDans(e, du, au)) {
			const annees = e.categorie === "anniversaire" && e.repetition === "annee" && annee(e.jour) < annee(e.creeLe) ? annee(debut) - annee(e.jour) : null;
			resultat.push({
				cle: `${e.id}/${debut}`,
				evenement: e,
				debut,
				fin: decaler(debut, {
					unite: "jour",
					tous: duree
				}),
				annees: annees && annees > 0 ? annees : null,
				lectureSeule: !!e.source && !e.icloud
			});
		}
	}
	return resultat.sort((a, b) => a.debut.localeCompare(b.debut) || (a.evenement.heure ?? "").localeCompare(b.evenement.heure ?? "") || a.evenement.titre.localeCompare(b.evenement.titre, "fr"));
}
/** Le titre affiché : « Anniversaire de Sarah · 32 ans ». */
function titreDe(o) {
	return o.annees ? `${o.evenement.titre} · ${o.annees} ans` : o.evenement.titre;
}
const MOIS_COURTS = [
	"janv.",
	"févr.",
	"mars",
	"avr.",
	"mai",
	"juin",
	"juil.",
	"août",
	"sept.",
	"oct.",
	"nov.",
	"déc."
];
const jourSemaine = (j) => (/* @__PURE__ */ new Date(`${j}T12:00:00Z`)).getUTCDay();
const dateCourte = (j) => `${Number(j.slice(8, 10))} ${MOIS_COURTS[Number(j.slice(5, 7)) - 1]}`;
const majuscule$4 = (t) => t.charAt(0).toUpperCase() + t.slice(1);
/** « Aujourd'hui », « Demain », « Jeudi 23 oct. », avec l'année quand ce n'est pas celle-ci. */
function decrireJour(jour, aujourdhui) {
	const ecart = ecartJours(aujourdhui, jour);
	if (ecart === 0) return "Aujourd'hui";
	if (ecart === 1) return "Demain";
	if (ecart === -1) return "Hier";
	const an = annee(jour) !== annee(aujourdhui) ? ` ${annee(jour)}` : "";
	return `${majuscule$4(NOMS_JOURS[jourSemaine(jour)])} ${dateCourte(jour)}${an}`;
}
/** Le lundi de la semaine d'un jour. */
function lundiDe(jour) {
	return decaler(jour, {
		unite: "jour",
		tous: -((jourSemaine(jour) + 6) % 7)
	});
}
/** L'agenda des deux semaines qui viennent, en quelques lignes, pour Jarvis. */
function decrireAgenda(evenements, foyer, aujourdhui) {
	const occ = occurrences(evenements, aujourdhui, decaler(aujourdhui, {
		unite: "jour",
		tous: 14
	}));
	if (occ.length === 0) return ["Agenda des deux semaines : rien de prévu."];
	return ["Agenda des deux semaines :", ...occ.map((o) => {
		const qui = o.evenement.pour ? foyer.membres.find((m) => m.id === o.evenement.pour)?.prenom ?? "une personne" : "nous deux";
		return `- ${titreDe(o)} : ${o.debut}${o.fin !== o.debut ? ` au ${o.fin}` : ""}${o.evenement.heure ? ` à ${o.evenement.heure}` : ""}, ${qui}${o.evenement.lieu ? `, ${o.evenement.lieu}` : ""}`;
	})];
}
//#endregion
//#region src/domaine/budget.ts
const POTS = {
	commun: {
		nom: "Compte commun",
		description: "Ce qui part directement du compte commun, comme le loyer."
	},
	courses: {
		nom: "Courses",
		description: "La carte des courses : le budget du mois y est versé, ce qui reste est reporté."
	},
	factures: {
		nom: "Factures",
		description: "Mis de côté chaque mois pour les factures, y compris les grosses factures de l'année."
	},
	plaisir: {
		nom: "Plaisir",
		description: "La part du reste du mois pour se faire plaisir."
	},
	epargne: {
		nom: "Épargne",
		description: "La réserve, et le projet pour lequel on économise."
	},
	perso: {
		nom: "À moi",
		description: "Ce que chacun paie de son côté, pour soi : seul lui le voit."
	}
};
/** Arrondi au centime. */
const auCentime = (n) => Math.round(n * 100) / 100;
/** « 84.30 CHF », « 2’000 CHF », « −12.50 CHF » : comme sur un relevé suisse. */
function formaterMontant(n, avecDevise = true) {
	const c = Math.round(Math.abs(n) * 100);
	const entier = Math.floor(c / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "’");
	const centimes = c % 100;
	const texte = `${n < 0 && c > 0 ? "−" : ""}${entier}${centimes ? `.${String(centimes).padStart(2, "0")}` : ""}`;
	return avecDevise ? `${texte} CHF` : texte;
}
/** Ce qu'une charge coûte par mois : une charge de l'année est lissée sur douze mois. */
const parMois = (p) => p.frequence === "an" ? p.montant / 12 : p.montant;
function planDe(docs) {
	return docs.find((d) => d.genre === "plan") ?? null;
}
function moisDe$2(jour) {
	return jour.slice(0, 7);
}
/** Tout ce que l'Excel calculait : restes, reste du commun, 30/70, pot factures. */
function bilanDuMois(plan) {
	const communes = plan.postes.filter((p) => p.qui === null);
	const somme = (postes) => postes.reduce((t, p) => t + parMois(p), 0);
	const entreeCommun = plan.personnes.reduce((t, p) => t + p.versement, 0);
	const chargesCommunes = somme(communes);
	const totalRevenus = plan.personnes.reduce((t, p) => t + p.revenu, 0);
	const resteCommun = entreeCommun - chargesCommunes;
	const libre = Math.max(0, resteCommun);
	const part = Math.min(1, Math.max(0, plan.partPlaisir));
	const duPot = (pot) => auCentime(somme(communes.filter((p) => p.pot === pot)));
	return {
		personnes: plan.personnes.map((p) => {
			const charges = somme(plan.postes.filter((x) => x.qui === p.membreId));
			return {
				membreId: p.membreId,
				revenu: p.revenu,
				charges: auCentime(charges),
				versement: p.versement,
				reste: auCentime(p.revenu - charges - p.versement),
				auProrata: totalRevenus > 0 ? auCentime(entreeCommun * p.revenu / totalRevenus) : 0
			};
		}),
		entreeCommun: auCentime(entreeCommun),
		chargesCommunes: auCentime(chargesCommunes),
		resteCommun: auCentime(resteCommun),
		versements: {
			commun: duPot("commun"),
			courses: duPot("courses"),
			factures: duPot("factures"),
			plaisir: auCentime(libre * part),
			epargne: auCentime(libre * (1 - part)),
			perso: 0
		},
		provisionAnnuelle: auCentime(communes.filter((p) => p.frequence === "an").reduce((t, p) => t + p.montant / 12, 0))
	};
}
const moisDocs = (docs) => docs.filter((d) => d.genre === "mois").sort((a, b) => a.mois.localeCompare(b.mois));
const depenses = (docs) => docs.filter((d) => d.genre === "depense").sort((a, b) => b.jour.localeCompare(a.jour) || b.creeLe.localeCompare(a.creeLe));
/** Le premier jour de paie du mois (le dernier jour du mois si la paie tombe un 31 en février). */
function jourDuMois(mois, jour) {
	const [a, m] = mois.split("-").map(Number);
	const dernier = new Date(Date.UTC(a, m, 0)).getUTCDate();
	return `${mois}-${String(Math.min(Math.max(1, jour), dernier)).padStart(2, "0")}`;
}
const moisSuivant = (mois) => decaler(`${mois}-01`, {
	unite: "mois",
	tous: 1
}).slice(0, 7);
const moisPrecedent = (mois) => decaler(`${mois}-01`, {
	unite: "mois",
	tous: -1
}).slice(0, 7);
/** Le mois de budget d'un jour. */
function moisBudget(plan, jour) {
	const paie = plan?.jourDePaie;
	const mois = moisDe$2(jour);
	if (!paie || paie <= 1) return mois;
	const passee = jour >= jourDuMois(mois, paie);
	if (paie > 15) return passee ? moisSuivant(mois) : mois;
	return passee ? mois : moisPrecedent(mois);
}
/** Le premier jour d'un mois de budget : la paie qui l'ouvre. */
function debutMoisBudget(plan, mois) {
	const paie = plan?.jourDePaie;
	if (!paie || paie <= 1) return `${mois}-01`;
	return jourDuMois(paie > 15 ? moisPrecedent(mois) : mois, paie);
}
/** Les prélèvements automatiques déjà passés depuis le départ : ils sortent seuls du pot. */
function prelevementsPasses(plan, aujourdhui) {
	const resultat = [];
	const auto = plan.postes.filter((p) => p.qui === null && p.prelevement && p.frequence === "mois" && p.pot && p.pot !== "commun");
	const debut = debutMoisBudget(plan, plan.depart.mois);
	for (let mois = moisDe$2(debut); mois <= moisDe$2(aujourdhui); mois = moisSuivant(mois)) for (const poste of auto) {
		const jour = jourDuMois(mois, poste.jour ?? 1);
		if (jour >= debut && jour <= aujourdhui) resultat.push({
			poste,
			jour
		});
	}
	return resultat;
}
/** Le solde de chaque pot : le départ, plus les mois versés, moins les dépenses et les prélèvements. */
function etatDesPots(plan, docs, aujourdhui) {
	const debut = debutMoisBudget(plan, plan.depart.mois);
	const mois = moisBudget(plan, aujourdhui);
	const bilan = bilanDuMois(plan);
	const verses = moisDocs(docs).filter((m) => m.mois >= plan.depart.mois && m.mois <= mois);
	const sorties = depenses(docs).filter((d) => d.jour >= debut && d.jour <= aujourdhui);
	const auto = prelevementsPasses(plan, aujourdhui);
	const ceMois = verses.find((m) => m.mois === mois);
	const etat = {};
	for (const pot of Object.keys(POTS)) {
		const entre = verses.reduce((t, m) => t + (m.versements[pot] ?? 0), 0);
		const sorti = sorties.filter((d) => d.pot === pot).reduce((t, d) => t + d.montant, 0) + auto.filter((a) => a.poste.pot === pot).reduce((t, a) => t + a.poste.montant, 0);
		const sortiCeMois = sorties.filter((d) => d.pot === pot && moisBudget(plan, d.jour) === mois).reduce((t, d) => t + d.montant, 0) + auto.filter((a) => a.poste.pot === pot && moisBudget(plan, a.jour) === mois).reduce((t, a) => t + a.poste.montant, 0);
		etat[pot] = {
			pot,
			solde: auCentime((plan.depart.soldes[pot] ?? 0) + entre - sorti),
			budgetDuMois: auCentime(ceMois ? ceMois.versements[pot] ?? 0 : bilan.versements[pot]),
			depenseDuMois: auCentime(sortiCeMois)
		};
	}
	return etat;
}
/** Les échéances d'une charge commune entre deux jours (compris). */
function echeancesDe(poste, de, a) {
	const jours = [];
	if (poste.frequence === "an") {
		if (!poste.mois) return jours;
		for (let annee = Number(de.slice(0, 4)); annee <= Number(a.slice(0, 4)); annee++) {
			const j = jourDuMois(`${annee}-${String(poste.mois).padStart(2, "0")}`, poste.jour ?? 1);
			if (j >= de && j <= a) jours.push(j);
		}
		return jours;
	}
	if (!poste.jour) return jours;
	for (let mois = moisDe$2(de); mois <= moisDe$2(a); mois = moisSuivant(mois)) {
		const j = jourDuMois(mois, poste.jour);
		if (j >= de && j <= a) jours.push(j);
	}
	return jours;
}
/** Une dépense règle une échéance quand elle la nomme, ou qu'elle paie la même charge dans le même mois (le même mois de l'année pour une charge annuelle, à un mois près). */
function regle(d, poste, echeance) {
	if (d.posteId !== poste.id) return false;
	if (d.echeance) return d.echeance === echeance;
	const ecart = ecartJours(echeance, d.jour);
	return poste.frequence === "an" ? ecart >= -45 && ecart <= 45 : moisDe$2(d.jour) === moisDe$2(echeance);
}
/** Les factures communes dont on connaît la date, des 30 derniers jours aux `jours` prochains. */
function factures(plan, docs, aujourdhui, jours = 60) {
	const de = decaler(aujourdhui, {
		unite: "jour",
		tous: -30
	});
	const a = decaler(aujourdhui, {
		unite: "jour",
		tous: jours
	});
	const toutes = depenses(docs);
	const resultat = [];
	for (const poste of plan.postes.filter((p) => p.qui === null && p.pot !== "courses")) for (const echeance of echeancesDe(poste, de, a)) {
		const automatique = poste.prelevement && poste.frequence === "mois";
		const payee = automatique ? echeance <= aujourdhui : toutes.some((d) => regle(d, poste, echeance));
		if (echeance < plan.depart.mois && !payee) continue;
		resultat.push({
			poste,
			echeance,
			montant: poste.montant,
			payee,
			automatique
		});
	}
	return resultat.sort((x, y) => x.echeance.localeCompare(y.echeance) || x.poste.libelle.localeCompare(y.poste.libelle, "fr"));
}
/** Ce qui reste à payer à la main : en retard d'abord, puis dans l'ordre. */
function facturesAPayer(plan, docs, aujourdhui, jours = 60) {
	return factures(plan, docs, aujourdhui, jours).filter((f) => !f.payee && !f.automatique);
}
function nouvelleDepense(champs, par, ctx) {
	return {
		id: ctx.nouvelId(),
		genre: "depense",
		jour: champs.jour,
		montant: auCentime(champs.montant),
		pot: champs.pot,
		libelle: champs.libelle.trim() || POTS[champs.pot].nom,
		magasin: champs.magasin?.trim() || null,
		posteId: champs.posteId ?? null,
		echeance: champs.echeance ?? null,
		source: champs.source ?? "main",
		...champs.articles?.length ? { articles: champs.articles.filter((a) => a.nom.trim() && a.prix > 0).map((a) => ({
			nom: a.nom.trim(),
			prix: auCentime(a.prix)
		})) } : {},
		...champs.etiquette ? { etiquette: champs.etiquette } : {},
		par,
		creeLe: ctx.maintenant()
	};
}
/** Payer une facture : une dépense du pot de la charge, liée à son échéance. */
function payerFacture(f, jour, par, ctx, source = "main") {
	return nouvelleDepense({
		montant: f.montant,
		pot: f.poste.pot ?? "factures",
		libelle: f.poste.libelle,
		jour,
		posteId: f.poste.id,
		echeance: f.echeance,
		source
	}, par, ctx);
}
function avanceeProjet(plan, docs, aujourdhui) {
	const projet = plan.projet;
	if (!projet || projet.objectif <= 0) return null;
	const epargne = Math.max(0, etatDesPots(plan, docs, aujourdhui).epargne.solde);
	const manque = auCentime(Math.max(0, projet.objectif - epargne));
	const rythme = bilanDuMois(plan).versements.epargne;
	let parMoisPourLaDate = null;
	if (projet.date) {
		const moisRestants = Math.max(1, (Number(projet.date.slice(0, 4)) - Number(aujourdhui.slice(0, 4))) * 12 + Number(projet.date.slice(5, 7)) - Number(aujourdhui.slice(5, 7)));
		parMoisPourLaDate = auCentime(manque / moisRestants);
	}
	let atteintVers = manque === 0 ? moisBudget(plan, aujourdhui) : null;
	if (manque > 0 && rythme > 0) {
		let mois = moisBudget(plan, aujourdhui);
		for (let i = 0; i < Math.ceil(manque / rythme); i++) mois = moisSuivant(mois);
		atteintVers = mois;
	}
	return {
		projet,
		epargne,
		part: Math.min(1, epargne / projet.objectif),
		manque,
		parMoisPourLaDate,
		atteintVers
	};
}
/** « le 15 mars », « aujourd'hui », « demain », « en retard (le 3 octobre) ». */
function decrireEcheanceFacture(echeance, aujourdhui) {
	const ecart = ecartJours(aujourdhui, echeance);
	const date = `le ${Number(echeance.slice(8, 10))} ${NOMS_MOIS[Number(echeance.slice(5, 7)) - 1]}`;
	if (ecart < 0) return `en retard (${date})`;
	if (ecart === 0) return "aujourd'hui";
	if (ecart === 1) return "demain";
	return date;
}
/** Le budget en quelques lignes, dans l'état du foyer envoyé à Jarvis. */
function decrireBudget(docs, prenoms, aujourdhui) {
	const plan = planDe(docs);
	if (!plan) return [];
	const pots = etatDesPots(plan, docs, aujourdhui);
	const bilan = bilanDuMois(plan);
	const lignes = [`Budget (CHF) : carte courses ${formaterMontant(pots.courses.solde, false)} restants (${formaterMontant(pots.courses.depenseDuMois, false)} dépensés ce mois sur ${formaterMontant(pots.courses.budgetDuMois, false)}), plaisir ${formaterMontant(pots.plaisir.solde, false)}, pot factures ${formaterMontant(pots.factures.solde, false)}, épargne ${formaterMontant(pots.epargne.solde, false)}.`, `Compte commun : ${formaterMontant(bilan.entreeCommun, false)} versés par mois, ${formaterMontant(bilan.chargesCommunes, false)} de charges, reste ${formaterMontant(bilan.resteCommun, false)} (${Math.round(plan.partPlaisir * 100)} % plaisir, le reste épargne).`];
	const aPayer = facturesAPayer(plan, docs, aujourdhui, 45);
	if (aPayer.length) lignes.push(`Factures à payer : ${aPayer.map((f) => `${f.poste.libelle} ${formaterMontant(f.montant, false)} ${decrireEcheanceFacture(f.echeance, aujourdhui)}`).join(", ")}.`);
	const charges = plan.postes.map((p) => `${p.libelle} ${formaterMontant(p.montant, false)}/${p.frequence}${p.qui ? ` (${prenoms(p.qui)})` : ""}`);
	if (charges.length) lignes.push(`Charges : ${charges.join(", ")}.`);
	const projet = avanceeProjet(plan, docs, aujourdhui);
	if (projet) lignes.push(`Projet d'épargne « ${projet.projet.nom} » : ${formaterMontant(projet.epargne, false)} sur ${formaterMontant(projet.projet.objectif, false)}.`);
	return lignes;
}
//#endregion
//#region src/domaine/paiements.ts
const memeMontant = (a, b) => Math.abs(a - b) < .005;
/**
* Un ticket de caisse (ou une dépense écrite) pour un paiement déjà arrivé par Apple Pay le même
* jour, du même montant : plutôt qu'une seconde dépense, le ticket complète la première (ses lignes,
* le nom du magasin). Le pot reste celui de la carte qui a payé. Null s'il n'y a rien à compléter.
*/
function completerPaiement(nouvelle, docs) {
	if (nouvelle.source === "applepay") return null;
	const paye = depenses(docs).find((d) => d.source === "applepay" && d.jour === nouvelle.jour && memeMontant(d.montant, nouvelle.montant) && !d.articles?.length && !d.posteId);
	if (!paye) return null;
	return {
		...paye,
		libelle: nouvelle.libelle || paye.libelle,
		magasin: nouvelle.magasin ?? paye.magasin,
		posteId: nouvelle.posteId,
		echeance: nouvelle.echeance,
		...nouvelle.articles?.length ? { articles: nouvelle.articles } : {}
	};
}
//#endregion
//#region src/domaine/jarvisModele.ts
/** Un modèle léger et rapide : les demandes du quotidien sont courtes. */
const MODELE_JARVIS = "claude-haiku-5-5";
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
/** Les outils proposés au modèle (format de l'API Claude). */
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
		name: "attribuer_tache",
		description: "Confie une tâche existante à une personne du foyer, ou la rend libre.",
		strict: false,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: ["titre", "responsable"],
			properties: {
				titre: texte("Le nom de la tâche tel qu'il figure dans la liste des tâches."),
				responsable: ouNul("Le prénom de la personne qui s'en charge ; null pour la rendre libre.")
			}
		}
	},
	{
		name: "noter_pesee",
		description: "Note le poids d'un animal du foyer.",
		strict: false,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: [
				"animal",
				"grammes",
				"jour"
			],
			properties: {
				animal: texte("Le nom de l'animal."),
				grammes: {
					type: "integer",
					description: "Le poids en grammes."
				},
				jour: ouNul("Le jour de la pesée, AAAA-MM-JJ, s'il est écrit (carnet, facture du vétérinaire) ; null pour aujourd'hui.")
			}
		}
	},
	{
		name: "regler_animal",
		description: "Corrige le poids estimé d'un animal (« elle pèse environ 1,6 kg ») et/ou sa ration de croquettes par jour, sans noter de pesée au carnet. La ration se recalcule avec le poids estimé, sauf si une ration est donnée.",
		strict: false,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: [
				"animal",
				"poids_estime",
				"ration"
			],
			properties: {
				animal: texte("Le nom de l'animal."),
				poids_estime: {
					type: ["integer", "null"],
					description: "Le poids estimé en grammes ; null pour ne pas le changer."
				},
				ration: {
					type: ["integer", "null"],
					description: "Les croquettes par jour en grammes, quand on la donne ; null pour la laisser calculée."
				}
			}
		}
	},
	{
		name: "noter_journal",
		description: "Note dans le journal d'un animal ce qui s'est passé : litière changée, a vomi, n'a pas mangé, selles molles, boite, se cache ou autre remarque.",
		strict: false,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: [
				"animal",
				"quoi",
				"note",
				"jour"
			],
			properties: {
				animal: texte("Le nom de l'animal."),
				quoi: {
					type: "string",
					enum: [
						"litiere",
						"vomi",
						"pas_mange",
						"selles",
						"boite",
						"cachee",
						"autre"
					]
				},
				note: texte("Une précision courte, ou une chaîne vide. Obligatoire pour « autre »."),
				jour: ouNul("Le jour, AAAA-MM-JJ, si ce n'est pas aujourd'hui (« hier soir ») ; null pour aujourd'hui.")
			}
		}
	},
	{
		name: "noter_soin",
		description: "Note un soin dans le carnet de santé d'un animal : déjà fait à une date (relu sur le carnet), ou prévu.",
		strict: false,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: [
				"animal",
				"type",
				"libelle",
				"date",
				"fait"
			],
			properties: {
				animal: texte("Le nom de l'animal."),
				type: {
					type: "string",
					enum: [
						"vaccin",
						"vermifuge",
						"antiparasitaire",
						"sterilisation",
						"visite",
						"autre"
					]
				},
				libelle: texte("Le soin tel qu'écrit : « Vaccin typhus et coryza (rappel) », « Milbemax »."),
				date: texte("La date du soin, AAAA-MM-JJ."),
				fait: {
					type: "boolean",
					description: "true si le soin a déjà été fait, false s'il est prévu."
				}
			}
		}
	},
	{
		name: "ajouter_plante",
		description: "Ajoute des plantes dans une zone du jardin (un pot, un bac, une jardinière).",
		strict: false,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: ["plantes", "zone"],
			properties: {
				plantes: {
					type: "array",
					items: texte("Le nom courant de la plante en français : « basilic », « tomate cerise ».")
				},
				zone: ouNul("Le nom de la zone telle qu'elle figure dans le jardin ; null si le jardin n'a qu'une zone.")
			}
		}
	},
	{
		name: "arrosage_fait",
		description: "Note que le jardin, ou une de ses zones, vient d'être arrosé.",
		strict: false,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: ["zone"],
			properties: { zone: ouNul("Le nom de la zone arrosée ; null si tout le jardin a été arrosé.") }
		}
	},
	{
		name: "modifier_tache",
		description: "Change le nom ou la date d'une tâche existante (« décale l'aspirateur à jeudi »).",
		strict: false,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: [
				"titre",
				"nouveau_titre",
				"echeance"
			],
			properties: {
				titre: texte("Le nom de la tâche tel qu'il figure dans la liste des tâches."),
				nouveau_titre: ouNul("Le nouveau nom ; null pour le garder."),
				echeance: ouNul("La nouvelle date, AAAA-MM-JJ ; null pour la garder.")
			}
		}
	},
	{
		name: "supprimer_tache",
		description: "Supprime une tâche qui n'a plus lieu d'être. L'app demande confirmation avant.",
		strict: false,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: ["titre"],
			properties: { titre: texte("Le nom de la tâche tel qu'il figure dans la liste des tâches.") }
		}
	},
	{
		name: "retirer_du_stock",
		description: "Retire du stock des produits finis, mangés ou jetés. L'app demande confirmation avant.",
		strict: true,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: ["produits"],
			properties: { produits: {
				type: "array",
				items: texte("Le nom du produit tel qu'il figure dans le stock.")
			} }
		}
	},
	{
		name: "retenir",
		description: "Retient durablement un fait sur le foyer : un goût, une habitude, une règle de la maison. propose: false quand on te demande de le retenir ; true quand tu l'as remarqué toi-même. Dans les deux cas c'est retenu tout de suite (la personne peut annuler).",
		strict: false,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: ["fait", "propose"],
			properties: {
				fait: texte("Le fait en une phrase courte et autonome, à la troisième personne : « Sarah n'aime pas la coriandre »."),
				propose: {
					type: "boolean",
					description: "true si personne ne t'a demandé de le retenir."
				}
			}
		}
	},
	{
		name: "oublier",
		description: "Efface un fait de ta mémoire, quand on te dit qu'il est faux ou plus à jour. L'app demande confirmation avant.",
		strict: false,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: ["fait"],
			properties: { fait: texte("Le fait tel qu'il figure dans ta mémoire.") }
		}
	},
	{
		name: "ajouter_evenement",
		description: "Ajoute un événement à l'agenda commun : rendez-vous (médecin, véto), anniversaire, vacances, sortie, horaire de travail. Il apparaît aussi dans le calendrier de l'iPhone.",
		strict: false,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: [
				"titre",
				"jour",
				"fin",
				"heure",
				"heure_fin",
				"pour",
				"categorie",
				"repetition",
				"lieu"
			],
			properties: {
				titre: texte("Le nom court : « Dentiste », « Anniversaire de maman »."),
				jour: texte("Le premier jour, AAAA-MM-JJ. Pour un anniversaire dont on connaît l'année de naissance, la vraie date de naissance."),
				fin: ouNul("Le dernier jour, AAAA-MM-JJ, pour ce qui dure plusieurs jours ; null sinon."),
				heure: ouNul("L'heure de début, HH:MM ; null pour toute la journée."),
				heure_fin: ouNul("L'heure de fin, HH:MM ; null si elle n'est pas connue."),
				pour: ouNul("Le prénom de la personne concernée ; null pour le foyer (nous deux)."),
				categorie: {
					type: "string",
					enum: [
						"rdv",
						"anniversaire",
						"vacances",
						"sortie",
						"travail",
						"autre"
					]
				},
				repetition: {
					type: "string",
					enum: [
						"aucune",
						"jour",
						"semaine",
						"mois",
						"annee"
					]
				},
				lieu: ouNul("Le lieu ou l'adresse ; null s'il n'est pas dit.")
			}
		}
	},
	{
		name: "supprimer_evenement",
		description: "Retire un événement de l'agenda (annulé, plus d'actualité). L'app demande confirmation avant.",
		strict: false,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: ["titre", "jour"],
			properties: {
				titre: texte("Le nom de l'événement tel qu'il figure dans l'agenda."),
				jour: ouNul("Sa date, AAAA-MM-JJ, pour le distinguer d'un autre du même nom ; null sinon.")
			}
		}
	},
	{
		name: "noter_depense",
		description: "Note une dépense au budget du foyer : un ticket de caisse (son total), une sortie, une facture payée (« j'ai payé Sunrise »), un versement à l'épargne.",
		strict: false,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: [
				"montant",
				"libelle",
				"magasin",
				"pot",
				"jour",
				"charge",
				"articles"
			],
			properties: {
				montant: {
					type: "number",
					description: "Le montant en francs : le total payé pour un ticket."
				},
				libelle: texte("Ce que c'est, en deux ou trois mots : « Courses Migros », « Cinéma »."),
				magasin: ouNul("Le magasin du ticket (Migros, Coop, Lidl, Denner…) ; null sinon."),
				pot: {
					type: "string",
					enum: [
						"courses",
						"plaisir",
						"factures",
						"epargne",
						"commun",
						"perso"
					],
					description: "courses : alimentation et maison ; plaisir : sorties, cadeaux, envies du foyer ; factures : une facture ; epargne : un versement à l'épargne ; perso : une dépense rien qu'à soi, payée de son côté (« pour moi »)."
				},
				jour: ouNul("Le jour, AAAA-MM-JJ, s'il est écrit (ticket) ; null pour aujourd'hui."),
				charge: ouNul("Pour une facture payée : le nom de la charge telle qu'elle figure dans le budget ; null sinon."),
				articles: {
					type: "array",
					description: "Pour un ticket : chaque ligne avec son prix, le nom court et sans marque quand c'est possible (« Lait entier 1 l »). Vide sinon.",
					items: {
						type: "object",
						additionalProperties: false,
						required: ["nom", "prix"],
						properties: {
							nom: { type: "string" },
							prix: {
								type: "number",
								description: "Le prix de la ligne en francs."
							}
						}
					}
				}
			}
		}
	},
	{
		name: "enregistrer_recette",
		description: "Range une recette dans les recettes du foyer : lue derrière un lien, sur une photo (page de livre, fiche, écran) ou dictée. Une recette déjà enregistrée sous ce titre n'est pas copiée.",
		strict: false,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: [
				"titre",
				"portions",
				"ingredients",
				"etapes",
				"lien"
			],
			properties: {
				titre: texte("Le nom du plat : « Gratin dauphinois »."),
				portions: {
					type: ["integer", "null"],
					description: "Pour combien de personnes sont les quantités ; null si ce n'est pas dit."
				},
				ingredients: {
					type: "array",
					description: "Tous les ingrédients, dans l'ordre de la recette.",
					items: {
						type: "object",
						additionalProperties: false,
						required: ["nom", "quantite"],
						properties: {
							nom: texte("Le nom court, sans la quantité : « Lardons fumés »."),
							quantite: ouNul("La quantité courte : « 200 g », « 2 », « 1 c. à soupe » ; null sans quantité.")
						}
					}
				},
				etapes: {
					type: "array",
					items: texte("Une étape, courte et claire, en français."),
					description: "Les étapes dans l'ordre ; vide si elles ne sont pas données."
				},
				lien: ouNul("L'adresse de la page, pour une recette venue d'un lien ; null sinon.")
			}
		}
	},
	{
		name: "noter_taille",
		description: "Note la taille d'un vêtement pour une personne du foyer (« Sarah fait du 39 », « je fais du M en haut »). Une taille par pièce et par personne : la nouvelle remplace l'ancienne.",
		strict: false,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: [
				"pour",
				"piece",
				"valeur"
			],
			properties: {
				pour: texte("Le prénom de la personne ; celui de la personne qui parle pour « je »."),
				piece: {
					type: "string",
					enum: [
						"haut",
						"pantalon",
						"robe",
						"chaussures",
						"sousVetements",
						"manteau"
					],
					description: "La pièce : haut (t-shirt, pull, chemise), pantalon (jean, jupe), robe (robe, costume), chaussures, sousVetements, manteau (veste, manteau)."
				},
				valeur: texte("La taille telle qu'on la dit : « M », « 38 », « W30 L32 », « 85B ».")
			}
		}
	},
	{
		name: "noter_envie",
		description: "Note un vêtement ou un accessoire qu'une personne du foyer aimerait acheter (« j'aimerais une veste en laine », « note des bottes pour Sarah, 120 francs »). L'autre voit la liste : utile pour un cadeau.",
		strict: false,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: ["pour", "envie"],
			properties: {
				pour: texte("Le prénom de la personne ; celui de la personne qui parle pour « je »."),
				envie: texte("La pièce en quelques mots, le prix au bout s'il est dit : « veste en laine 120 ».")
			}
		}
	},
	{
		name: "noter_souhait",
		description: "Quand on te demande une chose que tu ne sais pas faire (aucun outil ne convient, ou l'app n'a pas cette fonction), note-la comme souhait d'amélioration pour Claude, qui fait évoluer l'app.",
		strict: false,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: ["demande", "manque"],
			properties: {
				demande: texte("Ce que la personne voulait, avec ses mots."),
				manque: texte("Ce qu'il faudrait que tu saches faire, en une phrase.")
			}
		}
	}
];
const CONSIGNES_JARVIS = `Tu es Jarvis, l'assistant d'un foyer en Suisse romande, dans l'app KoraHome sur iPhone.
On te parle souvent à la voix : la demande peut être approximative ou mal transcrite, devine l'intention la plus probable.
Réponds toujours en français, en tutoyant, en une ou deux phrases courtes, sans liste ni mise en forme.
Pour agir, utilise les outils. Quand tu utilises un outil, n'écris rien d'autre : l'app confirme elle-même ce qui a été fait.
Tu peux faire plusieurs actions d'un coup. Les dates sont au format AAAA-MM-JJ ; « demain », « samedi » se comptent depuis la date du jour donnée.
Tu ne dépenses jamais d'argent. Tu peux supprimer une tâche, retirer un produit du stock ou oublier un fait : l'app demande toujours confirmation avant, n'ajoute rien à ce sujet.
« Rappelle-moi jeudi d'appeler le véto » : crée une tâche unique à cette date pour la personne qui parle ; le rappel du matin la signale.
Un rendez-vous, un anniversaire, des vacances, une sortie ou un horaire de travail vont dans l'agenda (ajouter_evenement), pas dans les tâches. Pour « qu'est-ce qu'on a cette semaine ? », réponds à partir de l'agenda de l'état du foyer.
Si la demande n'est pas claire, pose une seule question courte.
Si on te demande une chose qu'aucun outil ne permet et que l'état du foyer ne te laisse pas répondre, utilise noter_souhait, et écris : « Je ne sais pas encore le faire, je l'ai noté pour Claude. »
Ta mémoire est dans l'état du foyer : sers-t'en pour chaque demande (goûts, habitudes, règles de la maison). Quand on te dit « retiens que… » ou « n'oublie pas que… », utilise retenir (propose: false). Quand tu remarques une préférence ou une habitude durable qui n'est pas encore dans ta mémoire, retiens-la toi-même avec retenir (propose: true), sans demander, au plus une par réponse, jamais une information passagère ni de santé ou d'argent ; dis-le en une phrase. Quand on te dit qu'un fait de ta mémoire est faux, utilise oublier, et retenir pour le fait juste.
Pour une question sur le foyer, réponds à partir de l'état du foyer fourni ; s'il ne contient pas la réponse, dis-le.
Avec une photo (lettre, facture, carte de rendez-vous, flyer, faire-part) : mets chaque rendez-vous ou événement daté dans l'agenda (ajouter_evenement, avec l'heure et le lieu indiqués), et crée une tâche unique pour chaque échéance ou paiement.
Avec un ticket de caisse : range au stock (ajouter_au_stock) les produits alimentaires achetés, avec leur quantité dans le nom (« 1 l lait », « 500 g beurre ») et le lieu où on les range d'habitude ; laisse la date de péremption vide si elle n'est pas écrite, l'app la devine. Coche aussi les courses correspondantes (cocher_courses), et note le total payé au budget (noter_depense, pot courses, avec le magasin, la date du ticket et chaque ligne avec son prix dans articles).
Pour l'argent : réponds à partir du budget de l'état du foyer (carte courses, plaisir, factures, épargne). « J'ai payé l'assurance voiture », « 32 francs de cinéma » : utilise noter_depense. Tu ne fais jamais de paiement toi-même.
Avec une page de carnet de santé ou une facture de vétérinaire : note chaque vaccin, vermifuge, antiparasitaire ou visite avec noter_soin (fait: true à sa date, et fait: false pour la date du prochain rappel écrite), et les poids écrits avec noter_pesee à leur date.
Quand on te dit qu'un animal a vomi, n'a pas mangé, ou que la litière est changée, note-le avec noter_journal ; si une tâche correspond (litière), marque-la aussi faite.
Avec une recette (un lien, une photo de page de livre ou de fiche, ou une recette dictée) : range-la dans les recettes du foyer (enregistrer_recette) avec tous ses ingrédients et leurs quantités, et ses étapes réécrites courtes en français. Pour un lien, mets l'adresse dans lien, puis compare ses ingrédients au stock et à la liste de courses et n'ajoute aux courses que ce qui manque, avec les quantités de la recette. Pour une photo ou une dictée, n'ajoute aux courses que si on te le demande.
« J'ai fait le risotto », « on a mangé la soupe », « j'ai utilisé les courgettes » : la cuisine est faite. Retire du stock (retirer_du_stock) les produits de l'état du foyer qui ont servi (les ingrédients de la recette ou du menu du Chef qui sont au stock, ou ceux qu'on nomme), sans toucher aux bases qui restent (sel, huile, riz, pâtes). S'il reste des portions, dis-le en une phrase. Si le plat n'est pas dans les recettes du foyer, écris-la avec enregistrer_recette pour la prochaine fois.
« Qu'est-ce qu'on mange ce soir ? » : propose une ou deux recettes du foyer (état du foyer) qu'on peut faire avec le stock, celles qu'on aime d'abord, en disant ce qui manque ; si aucune ne va, une idée simple avec ce qu'il y a. Ne propose jamais une recette marquée « pas pour eux ».
Les vêtements : « quelle pointure fait Sarah ? », « qu'est-ce qui ferait plaisir à Dany ? » se répondent depuis les vêtements de l'état du foyer (tailles et envies). « Je fais du 38 », « note une robe pour Sarah » : noter_taille, noter_envie.
Avec une photo de plante : reconnais-la (nom courant en français, le plus précis possible). Si on te demande de l'ajouter, utilise ajouter_plante, et écris quand même une phrase : son nom, puis son besoin principal (soleil, arrosage, gel). Si tu n'es pas sûr, dis-le et donne les deux noms les plus probables.`;
/** Les derniers échanges, pour que « et du beurre aussi » se comprenne. */
const TOURS_RETENUS = 6;
/** Le message envoyé au modèle : les derniers échanges, l'état du foyer, puis la demande. */
function messageDemande(etat, demande, historique = [], lien) {
	const tours = historique.slice(-6).map((t) => `${t.role === "personne" ? "Personne" : "Jarvis"} : ${t.texte}`);
	const avant = tours.length ? `Échanges précédents :\n${tours.join("\n")}\n\n` : "";
	const page = lien ? `\n\nCe qu'il y a derrière le lien :\n${lien}` : "";
	return `${avant}État du foyer :\n${etat}\n\nDemande : ${demande.trim()}${page}`;
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
		texte: majuscule$3(debut[2])
	};
	const fin = s.match(QUANTITE_FIN);
	if (fin) return {
		quantite: fin[2].replace(/\s+/g, " "),
		texte: majuscule$3(fin[1])
	};
	return {
		quantite: null,
		texte: majuscule$3(s)
	};
}
function majuscule$3(s) {
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
const cle$1 = (t) => normaliser(t).replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
/** Un souvenir qui dit déjà la même chose (sans tenir compte des majuscules, accents ni ponctuation). */
function souvenirSemblable(souvenirs, texte) {
	const c = cle$1(texte);
	return souvenirsRetenus(souvenirs).find((s) => cle$1(s.texte) === c);
}
/** Le souvenir visé par « oublie que… » : le même texte, sinon celui qui le contient. */
function trouverSouvenir(souvenirs, texte) {
	const c = cle$1(texte);
	if (!c) return void 0;
	return souvenirSemblable(souvenirs, texte) ?? souvenirsRetenus(souvenirs).find((s) => cle$1(s.texte).includes(c) || c.includes(cle$1(s.texte)));
}
/** Du plus ancien au plus récent : l'ordre dans lequel le foyer les a confiés. */
function trierSouvenirs(souvenirs) {
	return souvenirsRetenus(souvenirs).sort((a, b) => a.creeLe.localeCompare(b.creeLe));
}
/** Ce que Jarvis relit à chaque demande : les souvenirs les plus récents, un par ligne. */
function decrireMemoire(souvenirs) {
	const retenus = trierSouvenirs(souvenirs).slice(-60);
	if (retenus.length === 0) return ["Ce que tu sais du foyer : rien encore."];
	return ["Ce que tu sais du foyer (ta mémoire) :", ...retenus.map((s) => `- ${s.texte}`)];
}
//#endregion
//#region src/domaine/connaissances.ts
const F = (jours, unite) => ({
	lieu: "frigo",
	jours,
	unite
});
const C = (jours, unite) => ({
	lieu: "congelateur",
	jours,
	unite
});
const P = (jours, unite) => ({
	lieu: "placard",
	jours,
	unite
});
/** Les mots sont écrits sans accent et au singulier, comme les compare `cleProduit`. */
const CONNAISSANCES = {
	lait: F(7, "l"),
	yaourt: F(14),
	yogourt: F(14),
	creme: F(7),
	"creme fraiche": F(10),
	beurre: F(30, "g"),
	fromage: F(14, "g"),
	"fromage rape": F(14, "g"),
	mozzarella: F(5),
	gruyere: F(30, "g"),
	parmesan: F(30, "g"),
	feta: F(14),
	mascarpone: F(7),
	ricotta: F(5),
	oeuf: F(21),
	jambon: F(4),
	lardon: F(7, "g"),
	saucisse: F(4),
	poulet: F(2, "g"),
	viande: F(2, "g"),
	"viande hachee": F(1, "g"),
	hache: F(1, "g"),
	steak: F(2),
	boeuf: F(3, "g"),
	porc: F(3, "g"),
	veau: F(2, "g"),
	poisson: F(1, "g"),
	saumon: F(2, "g"),
	crevette: F(2, "g"),
	tofu: F(7, "g"),
	salade: F(4),
	epinard: F(3, "g"),
	courgette: F(7),
	carotte: F(14),
	tomate: F(5),
	poivron: F(7),
	champignon: F(4, "g"),
	concombre: F(7),
	brocoli: F(5),
	fraise: F(3, "g"),
	framboise: F(2, "g"),
	myrtille: F(5, "g"),
	raisin: F(7, "g"),
	citron: F(21),
	jus: F(7, "l"),
	"jus d'orange": F(7, "l"),
	compote: F(14),
	pesto: F(7, "g"),
	houmous: F(5, "g"),
	"pate feuilletee": F(10),
	"pate brisee": F(10),
	"pate a pizza": F(7),
	tarte: F(3),
	gnocchi: F(14, "g"),
	"pate fraiche": F(5, "g"),
	quiche: F(3),
	dessert: F(7),
	flan: F(10),
	surgele: C(180),
	glace: C(180),
	frite: C(180, "g"),
	"petit pois": C(180, "g"),
	nugget: C(180),
	"poisson pane": C(180),
	"legume surgele": C(180, "g"),
	"pizza surgelee": C(180),
	glacon: C(null),
	pate: P(365, "g"),
	spaghetti: P(365, "g"),
	riz: P(365, "kg"),
	farine: P(180, "kg"),
	sucre: P(null, "kg"),
	sel: P(null),
	huile: P(365, "l"),
	vinaigre: P(null, "l"),
	conserve: P(730),
	thon: P(730),
	mais: P(730),
	haricot: P(365),
	lentille: P(365, "g"),
	"pois chiche": P(365),
	quinoa: P(365, "g"),
	semoule: P(365, "g"),
	cafe: P(180, "g"),
	the: P(365),
	chocolat: P(180, "g"),
	biscuit: P(90),
	cereale: P(180, "g"),
	muesli: P(180, "g"),
	confiture: P(365),
	miel: P(null),
	pain: P(3),
	"pain de mie": P(7),
	baguette: P(1),
	chip: P(60, "g"),
	"sauce tomate": P(365),
	coulis: P(365),
	"lait de coco": P(365),
	"lait uht": P(90, "l"),
	oignon: P(30),
	ail: P(60),
	echalote: P(30),
	"pomme de terre": P(30, "kg"),
	banane: P(5),
	pomme: P(21),
	poire: P(7),
	orange: P(14),
	kiwi: P(10),
	avocat: P(4),
	eau: P(null, "l"),
	vin: P(null),
	biere: P(180),
	croquette: P(180, "kg"),
	epice: P(730),
	bouillon: P(365),
	levure: P(180)
};
/** « Pâtes fraîches » → « pate fraiche » : minuscules, sans accent, chaque mot au singulier. */
function cleProduit(nom) {
	return sansAccents(nom.toLowerCase()).replace(/œ/g, "oe").replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean).map((mot) => mot.length > 3 && /[sx]$/.test(mot) && !/(?:ss|is|us|ys)$/.test(mot) ? mot.slice(0, -1) : mot).join(" ");
}
/**
* Ce que Kora sait d'un produit : l'expression connue la plus longue contenue dans son
* nom (« pâte feuilletée » l'emporte sur « pâte »). null quand le produit est inconnu.
*/
function connaissanceDe(nom) {
	const mots = ` ${cleProduit(nom)} `;
	let trouve = null;
	for (const [cle, c] of Object.entries(CONNAISSANCES)) if (mots.includes(` ${cle} `) && (!trouve || cle.length > trouve.cle.length)) trouve = {
		cle,
		c
	};
	return trouve?.c ?? null;
}
//#endregion
//#region src/domaine/recettes.ts
const SOURCES_RECETTE = {
	chef: "Proposée par le Chef",
	lien: "Lue sur un site",
	photo: "Lue sur une photo",
	pdf: "Lue dans un PDF",
	jarvis: "Dictée à la fée",
	main: "Écrite à la main"
};
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
const chaine = (v, max) => typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";
const portionsValides = (v) => typeof v === "number" && Number.isFinite(v) && v >= 1 && v <= 20 ? Math.round(v) : null;
/** Relit une recette venue du modèle ou d'un formulaire sans lui faire confiance ; null sans titre ni ingrédient. */
function lireBrouillon(brut, source) {
	if (!brut || typeof brut !== "object") return null;
	const o = brut;
	const titre = chaine(o.titre, 80);
	const ingredients = (Array.isArray(o.ingredients) ? o.ingredients : []).map((i) => {
		if (typeof i === "string") return lireLigneIngredient(i);
		const r = i ?? {};
		const nom = chaine(r.nom, 60);
		return nom ? {
			nom: majuscule$2(nom),
			quantite: chaine(r.quantite, 24) || null
		} : null;
	}).filter((i) => !!i).slice(0, INGREDIENTS_MAX);
	if (!titre || !ingredients.length) return null;
	const etapes = (Array.isArray(o.etapes) ? o.etapes : []).map((e) => chaine(e, 400)).filter(Boolean).slice(0, ETAPES_MAX);
	const lien = chaine(o.lien, 500);
	return {
		titre: majuscule$2(titre),
		portions: portionsValides(o.portions),
		ingredients,
		etapes,
		source,
		lien: lien.startsWith("https://") ? lien : null
	};
}
function majuscule$2(s) {
	return s.charAt(0).toUpperCase() + s.slice(1);
}
const NOMBRE = String.raw`(\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?\s*[½¼¾⅓⅔]?|[½¼¾⅓⅔])`;
const UNITES_RECETTE = String.raw`(?:\s*(?:kg|g|mg|l|dl|cl|ml|c\.?\s*à\s*(?:soupe|café|s\.|c\.)|cs|cc|càs|càc|cuillères?\s+à\s+(?:soupe|café)|tasses?|verres?|pincées?|gousses?|tranches?|branches?|bottes?|brins?|feuilles?|boîtes?|sachets?|paquets?|pots?|morceaux?|filets?|pièces?|pc)\b\.?)?`;
const LIGNE_DEBUT = new RegExp(`^(${NOMBRE}${UNITES_RECETTE})\\s+(?:de\\s+|d['’]\\s*)?(.+)$`, "i");
/** Une ligne écrite à la main : « 200 g de lardons », « 1/2 citron », « sel ». */
function lireLigneIngredient(ligne) {
	const s = ligne.trim().replace(/^[-•*·]\s*/, "").replace(/\s+/g, " ");
	if (!s) return null;
	const m = s.match(LIGNE_DEBUT);
	if (m) return {
		nom: majuscule$2(m[3].trim()).slice(0, 60),
		quantite: m[1].replace(/\s+/g, " ").trim()
	};
	const { texte, quantite } = analyserSaisie(s);
	return {
		nom: texte.slice(0, 60),
		quantite
	};
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
function disponibilite(recette, produits) {
	const comptes = recette.ingredients.filter((i) => !estDeBase(i.nom));
	const manquants = comptes.filter((i) => !produitPour(i.nom, produits));
	return {
		total: comptes.length,
		aLaMaison: comptes.length - manquants.length,
		manquants
	};
}
/** « 5 sur 7 à la maison », « Tout est à la maison ». */
function decrireDisponibilite(d) {
	if (!d.total) return "Rien à acheter";
	if (d.aLaMaison === d.total) return "Tout est à la maison";
	return `${d.aLaMaison} sur ${d.total} à la maison`;
}
/**
* L'ordre de la base : « Ce soir avec ce qu'on a » met devant celles qu'on peut faire sans
* courses ; sinon les recettes aimées et souvent faites montent, puis les plus proposées.
*/
function ordonnerRecettes(recettes, produits, filtre, aime, pasPourNous = () => false) {
	const dispo = new Map(recettes.map((r) => [r.id, disponibilite(r, produits)]));
	const manque = (r) => dispo.get(r.id).manquants.length;
	const habitude = (a, b) => Number(aime(b)) - Number(aime(a)) || b.fois - a.fois || b.vue - a.vue || b.modifieLe.localeCompare(a.modifieLe) || a.titre.localeCompare(b.titre, "fr");
	let choix = recettes.filter((r) => filtre !== "aimees" || aime(r));
	if (filtre === "ce-soir") choix = choix.filter((r) => !pasPourNous(r) && manque(r) <= 2);
	return [...choix].sort((a, b) => (filtre === "ce-soir" ? manque(a) - manque(b) : 0) || Number(pasPourNous(a)) - Number(pasPourNous(b)) || habitude(a, b));
}
/** Les soirs des sept prochains jours qui ont une recette prévue, dans l'ordre. */
function soirsPrevus(recettes, aujourdhui) {
	return recettes.filter((r) => r.prevuLe && ecartJours(aujourdhui, r.prevuLe) >= 0 && ecartJours(aujourdhui, r.prevuLe) < 7).map((r) => ({
		jour: r.prevuLe,
		recette: r
	})).sort((a, b) => a.jour.localeCompare(b.jour) || a.recette.titre.localeCompare(b.recette.titre, "fr"));
}
/** Les recettes du foyer, en lignes courtes, celles qu'on peut faire avec le stock d'abord. */
function decrireRecettes(recettes, produits, aujourdhui, avis) {
	if (!recettes.length) return ["Recettes du foyer : aucune pour l'instant."];
	const lignes = [`Recettes du foyer (${recettes.length}), celles qu'on peut faire avec le stock d'abord :`];
	const ordre = ordonnerRecettes(recettes, produits, "toutes", (r) => avis(r) === "aime", (r) => avis(r) === "non").sort((a, b) => disponibilite(a, produits).manquants.length - disponibilite(b, produits).manquants.length);
	for (const r of ordre.slice(0, 30)) {
		const d = disponibilite(r, produits);
		const manque = d.manquants.length ? `, manque ${d.manquants.map((i) => i.nom.toLowerCase()).slice(0, 5).join(", ")}` : "";
		const a = avis(r);
		const extra = [a === "aime" ? "aimée" : a === "non" ? "pas pour eux" : "", r.fois ? `faite ${r.fois} fois` : ""].filter(Boolean).join(", ");
		lignes.push(`- ${r.titre} : ${decrireDisponibilite(d).toLowerCase()}${manque}${extra ? ` (${extra})` : ""}`);
	}
	const prevus = soirsPrevus(recettes, aujourdhui);
	if (prevus.length) lignes.push(`Recettes prévues : ${prevus.map((p) => `${p.jour} ${p.recette.titre}`).join(", ")}.`);
	return lignes;
}
//#endregion
//#region src/domaine/meteo.ts
function meteoDu(meteo, jour) {
	return meteo?.jours.find((j) => j.jour === jour) ?? null;
}
//#endregion
//#region src/domaine/plantes.ts
const EXPOSITIONS = {
	soleil: {
		nom: "Plein soleil",
		detail: "6 h de soleil et plus"
	},
	"mi-ombre": {
		nom: "Mi-ombre",
		detail: "3 à 6 h de soleil"
	},
	ombre: {
		nom: "Ombre",
		detail: "moins de 3 h de soleil"
	}
};
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
const PAR_CLE = new Map(ESPECES.map((x) => [x.cle, x]));
function espece(cle) {
	return cle ? PAR_CLE.get(cle) ?? null : null;
}
/** « tomates » → « tomate » : sans majuscules, accents ni pluriel. */
const cleDeTexte = (texte) => normaliser(texte).replace(/[^a-z0-9]+/g, " ").trim().split(" ").map((mot) => mot.length > 3 ? mot.replace(/[sx]$/, "") : mot).join(" ");
/**
* Reconnaît une plante dans ce qu'on a écrit : « 2 pieds de tomates cerises » → Tomate.
* Le nom le plus long qui figure dans le texte gagne (« tomate cerise » avant « tomate »).
*/
function trouverEspece(texte) {
	const cherche = ` ${cleDeTexte(texte)} `;
	let meilleure = null;
	for (const x of ESPECES) for (const nom of [
		x.nom,
		x.cle.replace(/-/g, " "),
		...x.autres
	]) {
		const cle = cleDeTexte(nom);
		if (cle && cherche.includes(` ${cle} `) && (!meilleure || cle.length > meilleure.longueur)) meilleure = {
			espece: x,
			longueur: cle.length
		};
	}
	return meilleure?.espece ?? null;
}
//#endregion
//#region src/domaine/jardin.ts
const TYPES_ZONE = {
	pot: "Pot",
	jardiniere: "Jardinière",
	bac: "Bac",
	"pleine-terre": "Pleine terre"
};
const ABRIS = {
	dehors: {
		nom: "Dehors",
		detail: "reçoit la pluie"
	},
	couvert: {
		nom: "Sous un toit",
		detail: "à l'abri de la pluie, pas du froid"
	},
	interieur: {
		nom: "Dedans",
		detail: "derrière une fenêtre"
	}
};
const nettoyer = (texte) => texte.trim().replace(/\s+/g, " ");
const majuscule$1 = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);
const plusJours = (jour, n) => decaler(jour, {
	unite: "jour",
	tous: n
});
const moisDe$1 = (jour) => Number(jour.slice(5, 7));
/** Une plante écrite comme on la dit : « basilic », « 2 pieds de tomates cerises ». */
function nouvellePlante(texte, aujourdhui, par, ctx) {
	const nom = nettoyer(texte);
	if (!nom) throw new ErreurValidation("Écris le nom de la plante.");
	return {
		id: ctx.nouvelId(),
		nom: majuscule$1(nom),
		espece: trouverEspece(nom)?.cle ?? null,
		depuis: aujourdhui,
		ajoutePar: par
	};
}
function ajouterPlante(zone, plante) {
	return {
		...zone,
		plantes: [...zone.plantes, plante]
	};
}
function arroser(zone, aujourdhui, par) {
	return {
		...zone,
		arroseeLe: aujourdhui,
		arrosePar: par
	};
}
const especeDe = (p) => espece(p.espece);
/** Pour une plante que Kora ne connaît pas : tous les 3 jours en été. */
const ARROSAGE_PAR_DEFAUT = 3;
/** L'hiver, la terre sèche bien moins vite ; dedans, le chauffage la sèche quand même. */
const FACTEUR_SAISON = [
	4,
	4,
	2,
	1.5,
	1,
	1,
	1,
	1,
	1.2,
	1.5,
	2.5,
	4
];
/** Plus il y a de terre, plus elle garde l'eau. */
const FACTEUR_CONTENANT = {
	pot: 1,
	jardiniere: 1.2,
	bac: 1.5,
	"pleine-terre": 2
};
function facteurChaleur(jour, abri) {
	if (!jour || abri === "interieur") return 1;
	if (jour.max >= 30) return .5;
	if (jour.max >= 26) return .75;
	return 1;
}
/** Tous les combien de jours arroser cette zone aujourd'hui ; null tant qu'elle est vide. */
function intervalleArrosage(zone, aujourdhui, meteo) {
	if (zone.plantes.length === 0) return null;
	const base = Math.min(...zone.plantes.map((p) => especeDe(p)?.arrosageJours ?? ARROSAGE_PAR_DEFAUT));
	const saison = FACTEUR_SAISON[moisDe$1(aujourdhui) - 1];
	const n = base * (zone.abri === "interieur" ? Math.min(saison, 2) : saison) * FACTEUR_CONTENANT[zone.type] * facteurChaleur(meteoDu(meteo, aujourdhui), zone.abri);
	return Math.max(1, Math.round(n));
}
function etatArrosage(zone, aujourdhui, meteo) {
	const intervalle = intervalleArrosage(zone, aujourdhui, meteo);
	if (intervalle === null) return null;
	const pluies = zone.abri === "dehors" ? (meteo?.jours ?? []).filter((j) => j.pluie >= 5) : [];
	const derniereAverse = pluies.filter((j) => j.jour < aujourdhui).map((j) => j.jour).sort().pop() ?? null;
	const parLaPluie = !!derniereAverse && (!zone.arroseeLe || derniereAverse > zone.arroseeLe);
	const dernier = parLaPluie ? derniereAverse : zone.arroseeLe;
	const prochain = dernier ? plusJours(dernier, intervalle) : aujourdhui;
	const pluiePrevue = pluies.find((j) => j.jour === aujourdhui || j.jour === plusJours(aujourdhui, 1)) ?? null;
	return {
		intervalle,
		dernier,
		parLaPluie,
		prochain,
		pluiePrevue,
		du: prochain <= aujourdhui && !pluiePrevue
	};
}
const dansNJours = (n) => n === 0 ? "aujourd'hui" : n === 1 ? "demain" : `dans ${n} jours`;
/** « À arroser aujourd'hui », « Pluie prévue demain : pas besoin », « Prochain arrosage dans 2 jours ». */
function decrireArrosage(etat, aujourdhui) {
	const retard = ecartJours(etat.prochain, aujourdhui);
	if (etat.du) {
		if (!etat.dernier) return "À arroser";
		return retard > 0 ? `À arroser, en retard de ${retard} jour${retard > 1 ? "s" : ""}` : "À arroser aujourd'hui";
	}
	if (etat.pluiePrevue && etat.prochain <= plusJours(aujourdhui, 1)) return `Pluie prévue ${etat.pluiePrevue.jour === aujourdhui ? "aujourd'hui" : "demain"} : pas besoin d'arroser`;
	const avant = etat.dernier === aujourdhui ? "Arrosé aujourd'hui" : etat.parLaPluie ? "Arrosé par la pluie" : null;
	const suite = `prochain arrosage ${dansNJours(Math.max(0, ecartJours(aujourdhui, etat.prochain)))}`;
	return avant ? `${avant} · ${suite}` : majuscule$1(suite);
}
/**
* Le gel annoncé pour les deux nuits qui viennent, et ce qu'il menace. La minimale d'un
* jour tombe au petit matin : celle de demain, c'est la nuit qui vient.
*/
function alerteGel(zones, meteo, aujourdhui) {
	const froid = (meteo?.jours ?? []).filter((j) => j.jour > aujourdhui && j.jour <= plusJours(aujourdhui, 2) && j.min <= 2).sort((a, b) => a.jour.localeCompare(b.jour))[0];
	if (!froid) return null;
	const plantes = /* @__PURE__ */ new Set();
	for (const z of zones) {
		if (z.abri === "interieur") continue;
		for (const p of z.plantes) {
			const x = especeDe(p);
			const enPot = z.type === "pot" || z.type === "jardiniere";
			if (x?.gelive || froid.min <= -5 && enPot) plantes.add(p.nom.toLowerCase());
		}
	}
	return plantes.size ? {
		jour: froid.jour,
		min: froid.min,
		plantes: [...plantes]
	} : null;
}
const enumerer$1 = (mots) => mots.length <= 1 ? mots[0] ?? "" : `${mots.slice(0, -1).join(", ")} et ${mots[mots.length - 1]}`;
/** Tout ce qui demande un geste au jardin aujourd'hui, du plus pressé au moins pressé. */
function gestesDuJardin(zones, meteo, aujourdhui) {
	const gestes = [];
	const gel = alerteGel(zones, meteo, aujourdhui);
	if (gel) {
		const quand = gel.jour === plusJours(aujourdhui, 1) ? "cette nuit" : "demain dans la nuit";
		gestes.push({
			texte: `Gel ${quand} (${Math.round(gel.min)}°) : rentre ou couvre ${enumerer$1(gel.plantes.slice(0, 4))}`,
			urgent: true
		});
	}
	for (const z of zones) if (etatArrosage(z, aujourdhui, meteo)?.du) gestes.push({
		texte: `Arroser : ${z.nom.toLowerCase()}`,
		urgent: true,
		zoneId: z.id
	});
	const jour = meteoDu(meteo, aujourdhui);
	if (jour && jour.max >= 30 && zones.some((z) => z.plantes.length && z.abri !== "interieur")) gestes.push({
		texte: `Forte chaleur (${Math.round(jour.max)}°) : arrose tôt le matin ou le soir`,
		urgent: false
	});
	return gestes;
}
/** Le résumé du jardin pour Jarvis. */
function decrireJardin(zones, meteo, aujourdhui) {
	if (zones.length === 0) return ["Jardin : aucune zone notée."];
	const lignes = ["Jardin :"];
	for (const z of zones) {
		const etat = etatArrosage(z, aujourdhui, meteo);
		const plantes = z.plantes.length ? z.plantes.map((p) => p.nom.toLowerCase()).join(", ") : "vide";
		lignes.push(`- ${z.nom} (${TYPES_ZONE[z.type].toLowerCase()}, ${EXPOSITIONS[z.exposition].nom.toLowerCase()}, ${ABRIS[z.abri].nom.toLowerCase()}) : ${plantes}` + (etat ? ` ; ${decrireArrosage(etat, aujourdhui).toLowerCase()}` : ""));
	}
	const jour = meteoDu(meteo, aujourdhui);
	if (jour) lignes.push(`Météo du jour : ${Math.round(jour.min)} à ${Math.round(jour.max)} °C, ${Math.round(jour.pluie)} mm de pluie.`);
	for (const g of gestesDuJardin(zones, meteo, aujourdhui)) if (!g.zoneId) lignes.push(`Alerte : ${g.texte}.`);
	return lignes;
}
//#endregion
//#region src/domaine/stock.ts
const LIEUX = {
	frigo: "Frigo",
	congelateur: "Congélateur",
	placard: "Placard"
};
function creerProduit(saisie, ajoutePar, ctx) {
	const nom = majuscule(saisie.nom.trim().replace(/\s+/g, " "));
	if (nom.length === 0) throw new ErreurValidation("Le produit est vide.");
	return avecQuantite({
		id: ctx.nouvelId(),
		nom,
		quantite: null,
		nombre: saisie.nombre,
		unite: saisie.nombre === null ? null : saisie.unite ?? "piece",
		lieu: saisie.lieu,
		peremption: saisie.peremption,
		code: saisie.code ?? null,
		image: saisie.image ?? null,
		ajoutePar,
		creeLe: ctx.maintenant()
	});
}
/** Ajout d'une ligne de texte, comme en 0.0.9 : « 2 yaourts ». */
function nouveauProduit(saisie, ajoutePar, ctx) {
	const { texte, quantite } = analyserSaisie(saisie.texte);
	const { nombre, unite } = lireQuantite(quantite);
	return creerProduit({
		nom: texte,
		nombre,
		unite,
		lieu: saisie.lieu,
		peremption: saisie.peremption
	}, ajoutePar, ctx);
}
const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1);
/** « 500 g » → 500 g ; « 1,5 l » → 1.5 l ; « 2 » → 2 pièces ; « 33 cl » → 330 ml. */
function lireQuantite(texte) {
	const m = texte?.trim().toLowerCase().match(/^(\d+(?:[.,]\d+)?)\s*([a-zéèêîôû]*)$/);
	if (!m) return {
		nombre: null,
		unite: null
	};
	const n = Number(m[1].replace(",", "."));
	const u = m[2];
	if (u === "cl") return {
		nombre: n * 10,
		unite: "ml"
	};
	if (u === "g" || u === "kg" || u === "ml" || u === "l") return {
		nombre: n,
		unite: u
	};
	return {
		nombre: n,
		unite: "piece"
	};
}
/** Le nombre et l'unité d'un produit, y compris d'un produit écrit avant les unités. */
function quantiteDe(p) {
	if (p.nombre !== void 0) return {
		nombre: p.nombre ?? null,
		unite: p.nombre == null ? null : p.unite ?? "piece"
	};
	return lireQuantite(p.quantite);
}
const nombreEnTexte = (n) => String(Math.round(n * 100) / 100).replace(".", ",");
/** « 2 », « 500 g », « 1,5 l » ; null sans quantité. */
function decrireQuantite(nombre, unite) {
	if (nombre === null) return null;
	return !unite || unite === "piece" ? nombreEnTexte(nombre) : `${nombreEnTexte(nombre)} ${unite}`;
}
/** Recopie la quantité en texte, que lisent encore les téléphones restés en 0.0.9. */
function avecQuantite(p) {
	const { nombre, unite } = quantiteDe(p);
	return {
		...p,
		nombre,
		unite,
		quantite: decrireQuantite(nombre, unite)
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
	const jourMois = `${p.peremption.slice(8, 10)}.${p.peremption.slice(5, 7)}`;
	return ecart > 180 ? `jusqu'au ${jourMois}.${p.peremption.slice(2, 4)}` : `jusqu'au ${jourMois}`;
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
[
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
	DE(4, 6),
	DE(5, 7),
	DE(5, 7),
	DE(4, 10),
	DE(4, 10),
	[...DE(3, 5), ...DE(9, 11)],
	DE(6, 9),
	DE(6, 9),
	DE(6, 9),
	DE(7, 9),
	DE(7, 9),
	DE(7, 10),
	DE(8, 9),
	DE(9, 3),
	DE(9, 3),
	DE(9, 4),
	DE(10, 3),
	DE(10, 2),
	DE(9, 4),
	DE(9, 12),
	DE(6, 11)
];
/** Les menus en cours : le plus récent préparé dans les 7 derniers jours. */
function menuDeLaSemaine(docs, aujourdhui) {
	return docs.filter((d) => d.type === "menu").filter((m) => {
		const ecart = ecartJours(m.semaine, aujourdhui);
		return ecart >= 0 && ecart < 7;
	}).sort((a, b) => b.semaine.localeCompare(a.semaine))[0] ?? null;
}
[...RAYONS];
const clePlat = (titre) => normaliser(titre).replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
const cleAvis = (titre, avis) => `chef:${avis}:${clePlat(titre)}`;
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
//#region src/domaine/catalogue.ts
function trouverHabituel(catalogue, nom, code) {
	if (code) {
		const parCode = catalogue.find((h) => h.code === code);
		if (parCode) return parCode;
	}
	const cle = cleProduit(nom);
	return cle ? catalogue.find((h) => h.cle === cle) ?? null : null;
}
function proposer(catalogue, nom) {
	const h = trouverHabituel(catalogue, nom);
	if (h) return {
		lieu: h.lieu,
		dureeJours: h.dureeJours,
		nombre: h.nombre,
		unite: h.unite,
		source: "habitude",
		habituel: h
	};
	const c = connaissanceDe(nom);
	if (c) return {
		lieu: c.lieu,
		dureeJours: c.jours,
		nombre: null,
		unite: c.unite ?? null,
		source: "connaissance",
		habituel: null
	};
	return null;
}
//#endregion
//#region src/domaine/habitudes.ts
/** Un article est proposé quand 80 % de son intervalle habituel est passé. */
const SEUIL = .8;
const cle = (texte) => normaliser(texte);
/**
* Ce qu'il faudra bientôt racheter : les articles achetés au moins trois fois, dont le
* moment habituel approche, et qui ne sont pas déjà sur la liste. Le plus en retard d'abord.
*/
function suggestions(liste, elements, aujourdhui, max = 6) {
	const surLaListe = new Set(elements.filter((e) => e.listeId === liste.id && !e.coche).map((e) => cle(e.texte)));
	const candidats = [];
	for (const a of liste.achats ?? []) {
		if (a.jours.length < 3 || surLaListe.has(cle(a.texte))) continue;
		const ecarts = a.jours.slice(1).map((j, i) => ecartJours(a.jours[i], j));
		const intervalle = ecarts.reduce((s, e) => s + e, 0) / ecarts.length;
		if (intervalle < 1) continue;
		const avance = ecartJours(a.jours[a.jours.length - 1], aujourdhui) / intervalle;
		if (avance >= SEUIL) candidats.push({
			texte: a.texte,
			avance,
			intervalle
		});
	}
	return candidats.sort((x, y) => y.avance - x.avance).slice(0, max).map((c) => ({
		texte: c.texte,
		rythme: `tous les ${Math.round(c.intervalle)} jours environ`
	}));
}
//#endregion
//#region src/domaine/retours.ts
function nouveauRetour(saisie, ctx, journal = []) {
	const texte = saisie.texte.trim();
	if (texte.length === 0) throw new ErreurValidation("La note est vide.");
	const creeLe = ctx.maintenant();
	return {
		id: ctx.nouvelId(),
		texte,
		genre: saisie.genre,
		ecran: saisie.ecran.trim() || "Écran inconnu",
		version: saisie.version,
		auteur: saisie.auteur,
		creeLe,
		regleLe: null,
		avant: evenementsAvant(journal, creeLe)
	};
}
/** Les derniers événements avant une note, pour savoir ce qui l'a précédée. */
function evenementsAvant(journal, quand, nombre = 6) {
	return journal.filter((e) => e.h <= quand && e.type !== "note").slice(-nombre);
}
//#endregion
//#region src/domaine/vetements.ts
/** Les pièces dont on retient la taille. Le texte de la taille reste libre (« M », « 38 », « W30 L32 »). */
const PIECES = [
	{
		id: "haut",
		nom: "Haut",
		exemple: "M, 38"
	},
	{
		id: "pantalon",
		nom: "Pantalon",
		exemple: "38, W30 L32"
	},
	{
		id: "robe",
		nom: "Robe ou costume",
		exemple: "36, 48"
	},
	{
		id: "chaussures",
		nom: "Chaussures",
		exemple: "39"
	},
	{
		id: "sousVetements",
		nom: "Sous-vêtements",
		exemple: "S, 85B"
	},
	{
		id: "manteau",
		nom: "Manteau",
		exemple: "L"
	}
];
const idTaille = (membreId, piece) => `taille-${membreId}-${piece}`;
/** La taille d'une pièce pour une personne, ou null. */
function tailleDe(docs, membreId, piece) {
	return docs.find((d) => d.type === "taille" && d.membreId === membreId && d.piece === piece) ?? null;
}
/** Poser ou changer une taille ; une valeur vide la retire (rend null : à supprimer). */
function poserTaille(membreId, piece, valeur, ctx) {
	const v = valeur.trim().slice(0, 20);
	if (!v) return null;
	return {
		id: idTaille(membreId, piece),
		type: "taille",
		membreId,
		piece,
		valeur: v,
		modifieLe: ctx.maintenant()
	};
}
const PRIX_AU_BOUT = /\s+(?:CHF\s*)?(\d{1,5}(?:[.,]\d{1,2})?)(?:\s*(?:CHF|fr\.?|francs?|\.-|-))?\s*$/i;
/** Lit une envie écrite d'une traite : le titre, et le prix s'il est au bout. */
function lireEnvie(texte) {
	const t = texte.trim().replace(/\s+/g, " ");
	const m = PRIX_AU_BOUT.exec(t);
	if (!m || m.index === 0) return {
		titre: t.slice(0, 80),
		prix: null
	};
	return {
		titre: t.slice(0, m.index).trim().slice(0, 80),
		prix: Number(m[1].replace(",", "."))
	};
}
function nouvelleEnvie(texte, membreId, ajoutePar, ctx) {
	const { titre, prix } = lireEnvie(texte);
	if (!titre) return null;
	return {
		id: ctx.nouvelId(),
		type: "envie",
		membreId,
		titre,
		prix,
		ou: null,
		creeLe: ctx.maintenant(),
		ajoutePar,
		acheteLe: null
	};
}
const recent = (quand, maintenant) => !quand || Date.parse(maintenant) - Date.parse(quand) < 2592e6;
/** Les envies d'une personne : à acheter d'abord (les plus récentes en haut), puis achetées ces trente jours. */
function enviesDe(docs, membreId, maintenant) {
	return docs.filter((d) => d.type === "envie" && d.membreId === membreId && recent(d.acheteLe, maintenant)).sort((a, b) => Number(!!a.acheteLe) - Number(!!b.acheteLe) || b.creeLe.localeCompare(a.creeLe));
}
//#endregion
//#region src/domaine/jarvis.ts
/** Les tailles et les envies de chacun, une ligne par personne. */
function decrireVetements(docs, foyer, maintenant) {
	const lignes = [];
	for (const m of foyer.membres) {
		const tailles = PIECES.map((p) => [p.nom, tailleDe(docs, m.id, p.id)?.valeur]).filter((x) => x[1]);
		const envies = enviesDe(docs, m.id, maintenant).filter((e) => !e.acheteLe);
		if (!tailles.length && !envies.length) continue;
		lignes.push(`Vêtements de ${m.prenom} : ${tailles.length ? `tailles ${tailles.map(([n, v]) => `${n.toLowerCase()} ${v}`).join(", ")}` : "tailles pas notées"}${envies.length ? ` ; envies ${envies.map((e) => `${e.titre}${e.prix !== null ? ` (${e.prix} CHF)` : ""}`).join(", ")}` : ""}.`);
	}
	return lignes;
}
const listeCourses = (d) => d.listes.find((l) => l.type === "courses") ?? null;
const prenomDe = (foyer, id) => foyer.membres.find((m) => m.id === id)?.prenom ?? null;
function nomDuJour(jour) {
	const [a, m, j] = jour.split("-").map(Number);
	return NOMS_JOURS[new Date(Date.UTC(a, m - 1, j)).getUTCDay()];
}
/** L'état du foyer, en quelques lignes, envoyé avec chaque demande. */
function decrireFoyer(d, membreId, aujourdhui) {
	const lignes = [];
	const moi = prenomDe(d.foyer, membreId);
	lignes.push(`Aujourd'hui : ${nomDuJour(aujourdhui)} ${aujourdhui}.`);
	lignes.push(`Foyer « ${d.foyer.nom} » : ${d.foyer.membres.map((m) => m.prenom).join(", ")}.`);
	lignes.push(moi ? `La personne qui parle : ${moi}.` : "La personne qui parle n'est pas connue.");
	lignes.push(...decrireMemoire(d.souvenirs ?? []));
	const liste = listeCourses(d);
	const aPrendre = liste ? d.elements.filter((e) => e.listeId === liste.id && !e.coche) : [];
	lignes.push(!liste ? "Pas de liste de courses." : aPrendre.length === 0 ? "Liste de courses : vide." : `Liste de courses : ${aPrendre.map((e) => e.quantite ? `${e.texte} (${e.quantite})` : e.texte).join(", ")}.`);
	const habitudes = liste ? suggestions(liste, d.elements, aujourdhui, 8) : [];
	if (habitudes.length) lignes.push(`Bientôt à racheter, d'après les habitudes : ${habitudes.map((h) => `${h.texte} (${h.rythme})`).join(", ")}.`);
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
		const poids = poidsDeReference(a);
		const ration = rationDuJour(a, aujourdhui);
		const aFaire = choseAFaire(a, aujourdhui).map((c) => c.texte);
		lignes.push(`Animal ${a.nom} : ${poids ? `${formaterPoids(poids.grammes)} (${poids.estime ? "estimé" : "pesé"} le ${poids.jour})` : "pas encore pesé"}${ration ? `, ration ${ration.grammes} g par jour` : ""}${aFaire.length ? `, à faire : ${aFaire.join(" ; ")}` : ""}.`);
		const soins = soinsAVenir(a).slice(0, 4);
		if (soins.length) lignes.push(`Carnet de ${a.nom}, prévu : ${soins.map((x) => `${x.libelle} le ${x.date}`).join(", ")}.`);
		const faits = soinsFaits(a).slice(0, 5);
		if (faits.length) lignes.push(`Carnet de ${a.nom}, derniers soins faits : ${faits.map((x) => `${x.libelle} le ${x.date}`).join(", ")}.`);
		const journal = journalRecent(a).slice(0, 5);
		if (journal.length) lignes.push(`Journal de ${a.nom} : ${journal.map((e) => `${TYPES_EVENEMENT[e.quoi].toLowerCase()}${e.note ? ` (${e.note})` : ""} le ${e.jour}`).join(", ")}.`);
	}
	if (d.menus) {
		const menu = menuDeLaSemaine(d.menus, aujourdhui);
		if (menu) lignes.push(`Menus du Chef cette semaine : ${menu.repas.map((r) => r.titre).join(", ")}.`);
		const avis = (r) => avisDuPlat(d.souvenirs ?? [], r.titre)?.avis ?? null;
		lignes.push(...decrireRecettes(recettesDe(d.menus), d.produits, aujourdhui, avis));
	}
	if (d.zones?.length) lignes.push(...decrireJardin(d.zones, d.meteo ?? null, aujourdhui));
	if (d.agenda) lignes.push(...decrireAgenda(evenementsDe(d.agenda), d.foyer, aujourdhui));
	if (d.budget) lignes.push(...decrireBudget(d.budget, (id) => prenomDe(d.foyer, id) ?? "", aujourdhui));
	if (d.vetements?.length) lignes.push(...decrireVetements(d.vetements, d.foyer, `${aujourdhui}T12:00:00.000Z`));
	return lignes.join("\n");
}
/**
* Ce qui attend le oui de la personne avant de se faire : supprimer. Ce que Jarvis remarque seul,
* il le retient tout de suite (Kora 0.0.70, souhait du foyer) ; « Annuler » ou sa page l'efface.
*/
function aConfirmer(action) {
	return action.outil === "supprimer_tache" || action.outil === "retirer_du_stock" || action.outil === "oublier" || action.outil === "supprimer_evenement";
}
/** La question posée avant une action à confirmer, et le libellé de son bouton « oui ». */
function questionPour(action) {
	switch (action.outil) {
		case "supprimer_tache": return {
			question: `Supprimer la tâche « ${action.titre} » ?`,
			oui: "Supprimer"
		};
		case "retirer_du_stock": return {
			question: `Retirer du stock : ${enumerer(action.produits)} ?`,
			oui: "Retirer"
		};
		case "oublier": return {
			question: `Oublier « ${action.fait} » ?`,
			oui: "Oublier"
		};
		case "supprimer_evenement": return {
			question: `Retirer « ${action.titre} » de l'agenda ?`,
			oui: "Retirer"
		};
		case "retenir": return {
			question: `J'ai remarqué : « ${action.fait} ». Je le retiens ?`,
			oui: "Retenir"
		};
		default: return {
			question: decrireAction(action),
			oui: "Oui"
		};
	}
}
const estTexte = (v) => typeof v === "string" && v.trim().length > 0;
const textes = (v) => Array.isArray(v) ? v.filter(estTexte) : [];
const RE_JOUR = /^\d{4}-\d{2}-\d{2}$/;
const jourOuNul = (v) => typeof v === "string" && RE_JOUR.test(v) ? v : null;
const heureOuNul = (v) => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null;
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
		} else if (nom === "attribuer_tache") {
			if (estTexte(e.titre)) actions.push({
				outil: nom,
				titre: e.titre,
				responsable: estTexte(e.responsable) ? e.responsable : null
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
				grammes: e.grammes,
				jour: jourOuNul(e.jour)
			});
		} else if (nom === "regler_animal") {
			const nombre = (v) => typeof v === "number" && Number.isFinite(v) ? v : null;
			const poidsEstime = nombre(e.poids_estime);
			const ration = nombre(e.ration);
			if (estTexte(e.animal) && (poidsEstime !== null || ration !== null)) actions.push({
				outil: nom,
				animal: e.animal,
				poidsEstime,
				ration
			});
		} else if (nom === "noter_journal") {
			if (estTexte(e.animal) && typeof e.quoi === "string" && e.quoi in TYPES_EVENEMENT) actions.push({
				outil: nom,
				animal: e.animal,
				quoi: e.quoi,
				note: typeof e.note === "string" ? e.note : "",
				jour: jourOuNul(e.jour)
			});
		} else if (nom === "noter_soin") {
			const date = jourOuNul(e.date);
			if (estTexte(e.animal) && typeof e.type === "string" && e.type in TYPES_SOIN && e.type !== "filtre" && date) actions.push({
				outil: nom,
				animal: e.animal,
				type: e.type,
				libelle: estTexte(e.libelle) ? e.libelle : "",
				date,
				fait: e.fait === true
			});
		} else if (nom === "ajouter_plante") {
			const plantes = textes(e.plantes);
			if (plantes.length) actions.push({
				outil: nom,
				plantes,
				zone: estTexte(e.zone) ? e.zone : null
			});
		} else if (nom === "arrosage_fait") actions.push({
			outil: nom,
			zone: estTexte(e.zone) ? e.zone : null
		});
		else if (nom === "modifier_tache") {
			const nouveauTitre = estTexte(e.nouveau_titre) ? e.nouveau_titre : null;
			const echeance = jourOuNul(e.echeance);
			if (estTexte(e.titre) && (nouveauTitre || echeance)) actions.push({
				outil: nom,
				titre: e.titre,
				nouveauTitre,
				echeance
			});
		} else if (nom === "supprimer_tache") {
			if (estTexte(e.titre)) actions.push({
				outil: nom,
				titre: e.titre
			});
		} else if (nom === "retirer_du_stock") {
			const produits = textes(e.produits);
			if (produits.length) actions.push({
				outil: nom,
				produits
			});
		} else if (nom === "retenir") {
			if (estTexte(e.fait)) actions.push({
				outil: nom,
				fait: e.fait.trim(),
				propose: e.propose !== false
			});
		} else if (nom === "oublier") {
			if (estTexte(e.fait)) actions.push({
				outil: nom,
				fait: e.fait.trim()
			});
		} else if (nom === "ajouter_evenement") {
			const jour = jourOuNul(e.jour);
			if (!estTexte(e.titre) || !jour) continue;
			actions.push({
				outil: nom,
				titre: e.titre.trim(),
				jour,
				fin: jourOuNul(e.fin),
				heure: heureOuNul(e.heure),
				heureFin: heureOuNul(e.heure_fin),
				pour: estTexte(e.pour) ? e.pour : null,
				categorie: typeof e.categorie === "string" && e.categorie in CATEGORIES ? e.categorie : "autre",
				repetition: typeof e.repetition === "string" && e.repetition in REPETITIONS ? e.repetition : "aucune",
				lieu: estTexte(e.lieu) ? e.lieu : null
			});
		} else if (nom === "supprimer_evenement") {
			if (estTexte(e.titre)) actions.push({
				outil: nom,
				titre: e.titre,
				jour: jourOuNul(e.jour)
			});
		} else if (nom === "noter_depense") {
			const montant = typeof e.montant === "number" ? e.montant : NaN;
			if (!(montant > 0) || montant > 1e5) continue;
			const pot = typeof e.pot === "string" && e.pot in POTS ? e.pot : "courses";
			actions.push({
				outil: nom,
				montant,
				libelle: estTexte(e.libelle) ? e.libelle.trim() : "",
				magasin: estTexte(e.magasin) ? e.magasin.trim() : null,
				pot,
				jour: jourOuNul(e.jour),
				charge: estTexte(e.charge) ? e.charge.trim() : null,
				articles: (Array.isArray(e.articles) ? e.articles : []).filter((a) => !!a && typeof a === "object" && estTexte(a.nom) && typeof a.prix === "number" && a.prix > 0 && a.prix < 1e4).slice(0, 80).map((a) => ({
					nom: a.nom.trim(),
					prix: a.prix
				}))
			});
		} else if (nom === "noter_taille") {
			const piece = PIECES.find((p) => p.id === e.piece)?.id;
			if (estTexte(e.pour) && estTexte(e.valeur) && piece) actions.push({
				outil: nom,
				pour: e.pour.trim(),
				piece,
				valeur: e.valeur.trim()
			});
		} else if (nom === "noter_envie") {
			if (estTexte(e.pour) && estTexte(e.envie)) actions.push({
				outil: nom,
				pour: e.pour.trim(),
				envie: e.envie.trim()
			});
		} else if (nom === "enregistrer_recette") {
			const recette = lireBrouillon(e, estTexte(e.lien) ? "lien" : "jarvis");
			if (recette) actions.push({
				outil: nom,
				recette
			});
		} else if (nom === "noter_souhait") {
			if (estTexte(e.demande)) actions.push({
				outil: nom,
				demande: e.demande.trim(),
				manque: estTexte(e.manque) ? e.manque.trim() : ""
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
	let zones = [...donnees.zones ?? []];
	let produits = [...donnees.produits];
	let souvenirs = [...donnees.souvenirs ?? []];
	let evenements = evenementsDe(donnees.agenda ?? []).filter((e) => !e.source);
	let recettes = recettesDe(donnees.menus ?? []);
	const liste = listeCourses(donnees);
	/** Une zone modifiée : la version d'avant reste celle de sa première modification. */
	const modifierZone = (avant, apres) => {
		zones = zones.map((z) => z.id === apres.id ? apres : z);
		const deja = modifications.find((m) => m.collection === "jardin" && m.apres.id === apres.id);
		if (deja) deja.apres = apres;
		else modifications.push({
			collection: "jardin",
			avant,
			apres
		});
	};
	/** La zone nommée ; sans nom, la seule zone du jardin. */
	const zoneNommee = (nom) => {
		if (nom) return trouverParNom(zones, nom, (z) => z.nom) ?? `Je ne trouve pas la zone « ${nom} » au jardin.`;
		if (zones.length === 1) return zones[0];
		return zones.length === 0 ? "Crée d'abord une zone dans le Jardin (un pot, un bac)." : "Dans quelle zone du jardin ?";
	};
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
				const tache = {
					...nouvelleTache(action.titre, action.frequence, action.echeance, ctx, responsable?.id ?? null),
					creePar: membreId
				};
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
			case "attribuer_tache": {
				const tache = trouverParNom(taches.filter((t) => !estTerminee(t)), action.titre, (t) => t.titre);
				if (!tache) {
					echecs.push(`Je ne trouve pas la tâche « ${action.titre} ».`);
					break;
				}
				const membre = action.responsable ? trouverParNom(donnees.foyer.membres, action.responsable, (m) => m.prenom) : void 0;
				if (action.responsable && !membre) {
					echecs.push(`Je ne connais personne nommé ${action.responsable}.`);
					break;
				}
				const confiee = {
					...tache,
					responsable: membre?.id ?? null
				};
				taches = taches.map((t) => t.id === confiee.id ? confiee : t);
				modifications.push({
					collection: "taches",
					avant: tache,
					apres: confiee
				});
				faits.push(membre ? `${tache.titre} : pour ${membre.prenom}.` : `${tache.titre} : libre.`);
				break;
			}
			case "ajouter_au_stock": {
				const ranges = [];
				for (const p of action.produits) {
					const duree = p.peremption ? null : proposer(donnees.catalogue ?? [], p.nom)?.dureeJours;
					const peremption = p.peremption ?? (duree ? decaler(aujourdhui, {
						unite: "jour",
						tous: duree
					}) : null);
					const produit = nouveauProduit({
						texte: p.nom,
						lieu: p.lieu,
						peremption
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
			case "noter_pesee":
			case "regler_animal":
			case "noter_journal":
			case "noter_soin": {
				const animal = trouverParNom(animaux, action.animal, (a) => a.nom);
				if (!animal) {
					echecs.push(`Je ne connais pas d'animal nommé ${action.animal}.`);
					break;
				}
				let apres;
				if (action.outil === "noter_pesee") {
					apres = ajouterPesee(animal, action.grammes, action.jour ?? aujourdhui, membreId, ctx);
					faits.push(`Pesée notée : ${animal.nom}, ${formaterPoids(Math.round(action.grammes))}${action.jour && action.jour !== aujourdhui ? ` le ${action.jour}` : ""}.`);
				} else if (action.outil === "regler_animal") {
					apres = reglerPoidsEtRation(animal, {
						...action.poidsEstime !== null ? { poidsEstime: action.poidsEstime } : {},
						...action.ration !== null ? { ration: action.ration } : {}
					}, aujourdhui);
					const ration = rationDuJour(apres, aujourdhui);
					faits.push(`${animal.nom} : ${action.poidsEstime !== null ? `environ ${formaterPoids(Math.round(action.poidsEstime))}` : "poids inchangé"}${ration ? `, ration ${ration.grammes} g par jour` : ""} (sans pesée au carnet).`);
				} else if (action.outil === "noter_journal") {
					apres = noterEvenement(animal, action.quoi, action.jour ?? aujourdhui, action.note, membreId, ctx);
					faits.push(`Noté pour ${animal.nom} : ${TYPES_EVENEMENT[action.quoi].toLowerCase()}${action.note ? ` (${action.note})` : ""}.`);
				} else {
					apres = noterSoin(animal, action, ctx);
					if (apres === animal) break;
					faits.push(`Carnet de ${animal.nom} : ${apres.soins[apres.soins.length - 1].libelle.toLowerCase()}, ${action.fait ? "fait" : "prévu"} le ${action.date}.`);
				}
				animaux = animaux.map((a) => a.id === apres.id ? apres : a);
				const deja = modifications.find((m) => m.collection === "animaux" && m.apres.id === animal.id);
				if (deja) deja.apres = apres;
				else modifications.push({
					collection: "animaux",
					avant: animal,
					apres
				});
				break;
			}
			case "ajouter_plante": {
				const zone = zoneNommee(action.zone);
				if (typeof zone === "string") {
					echecs.push(zone);
					break;
				}
				let apres = zone;
				for (const texte of action.plantes) apres = ajouterPlante(apres, nouvellePlante(texte, aujourdhui, membreId, ctx));
				modifierZone(zone, apres);
				faits.push(`Planté dans ${zone.nom.toLowerCase()} : ${enumerer(action.plantes.map((p) => p.toLowerCase()))}.`);
				break;
			}
			case "arrosage_fait": {
				const cibles = action.zone ? [zoneNommee(action.zone)] : zones.filter((z) => z.plantes.length > 0);
				const arrosees = [];
				for (const zone of cibles) {
					if (typeof zone === "string") {
						echecs.push(zone);
						continue;
					}
					modifierZone(zone, arroser(zone, aujourdhui, membreId));
					arrosees.push(zone.nom.toLowerCase());
				}
				if (arrosees.length) faits.push(`Arrosage noté : ${enumerer(arrosees)}.`);
				else if (!action.zone) echecs.push("Il n'y a encore rien à arroser au jardin.");
				break;
			}
			case "modifier_tache": {
				const tache = trouverParNom(taches.filter((t) => !estTerminee(t)), action.titre, (t) => t.titre);
				if (!tache) {
					echecs.push(`Je ne trouve pas la tâche « ${action.titre} ».`);
					break;
				}
				const modifiee = {
					...tache,
					titre: action.nouveauTitre?.trim() || tache.titre,
					echeance: action.echeance ?? tache.echeance
				};
				taches = taches.map((t) => t.id === modifiee.id ? modifiee : t);
				modifications.push({
					collection: "taches",
					avant: tache,
					apres: modifiee
				});
				faits.push(`Tâche modifiée : ${modifiee.titre.toLowerCase()}, ${decrireEcheance(modifiee.echeance, aujourdhui)}.`);
				break;
			}
			case "supprimer_tache": {
				const tache = trouverParNom(taches, action.titre, (t) => t.titre);
				if (!tache) {
					echecs.push(`Je ne trouve pas la tâche « ${action.titre} ».`);
					break;
				}
				taches = taches.filter((t) => t.id !== tache.id);
				modifications.push({
					collection: "taches",
					avant: tache,
					apres: tache,
					supprime: true
				});
				faits.push(`Tâche supprimée : ${tache.titre.toLowerCase()}.`);
				break;
			}
			case "retirer_du_stock": {
				const retires = [];
				for (const nom of action.produits) {
					const produit = trouverParNom(produits, nom, (p) => p.nom);
					if (!produit) {
						echecs.push(`« ${nom} » n'est pas dans le stock.`);
						continue;
					}
					produits = produits.filter((p) => p.id !== produit.id);
					modifications.push({
						collection: "stock",
						avant: produit,
						apres: produit,
						supprime: true
					});
					retires.push(produit.nom.toLowerCase());
				}
				if (retires.length) faits.push(`Retiré du stock : ${enumerer(retires)}.`);
				break;
			}
			case "retenir": {
				const deja = souvenirSemblable(souvenirs, action.fait);
				if (deja) {
					faits.push(`Je le savais déjà : ${deja.texte.charAt(0).toLowerCase()}${deja.texte.slice(1)}.`);
					break;
				}
				const souvenir = nouveauSouvenir(action.fait, action.propose ? "remarque" : "demande", membreId, ctx);
				souvenirs.push(souvenir);
				modifications.push({
					collection: "memoire",
					avant: null,
					apres: souvenir
				});
				faits.push(`Retenu : ${souvenir.texte.charAt(0).toLowerCase()}${souvenir.texte.slice(1)}.`);
				break;
			}
			case "oublier": {
				const souvenir = trouverSouvenir(souvenirs, action.fait);
				if (!souvenir) {
					echecs.push(`Je n'avais pas retenu « ${action.fait} ».`);
					break;
				}
				souvenirs = souvenirs.filter((s) => s.id !== souvenir.id);
				modifications.push({
					collection: "memoire",
					avant: souvenir,
					apres: souvenir,
					supprime: true
				});
				faits.push(`Oublié : ${souvenir.texte.charAt(0).toLowerCase()}${souvenir.texte.slice(1)}.`);
				break;
			}
			case "ajouter_evenement": {
				const membre = action.pour ? trouverParNom(donnees.foyer.membres, action.pour, (m) => m.prenom) : void 0;
				const doublon = evenements.find((x) => x.jour === action.jour && normaliser(x.titre) === normaliser(action.titre));
				if (doublon) {
					faits.push(`Déjà dans l'agenda : ${doublon.titre.toLowerCase()}, ${decrireJour(doublon.jour, aujourdhui).toLowerCase()}.`);
					break;
				}
				const evenement = preparerEvenement({
					...action,
					pour: membre?.id ?? null
				}, membreId, ctx);
				evenements.push(evenement);
				modifications.push({
					collection: "agenda",
					avant: null,
					apres: evenement
				});
				const heure = evenement.heure ? ` à ${evenement.heure}` : "";
				const qui = membre ? `, pour ${membre.prenom}` : "";
				faits.push(`Dans l'agenda : ${evenement.titre.toLowerCase()}, ${decrireJour(evenement.jour, aujourdhui).toLowerCase()}${heure}${qui}.`);
				break;
			}
			case "supprimer_evenement": {
				const evenement = trouverParNom(action.jour ? evenements.filter((x) => x.jour === action.jour) : evenements, action.titre, (x) => x.titre);
				if (!evenement) {
					echecs.push(`Je ne trouve pas « ${action.titre} » dans l'agenda.`);
					break;
				}
				evenements = evenements.filter((x) => x.id !== evenement.id);
				modifications.push({
					collection: "agenda",
					avant: evenement,
					apres: evenement,
					supprime: true
				});
				faits.push(`Retiré de l'agenda : ${evenement.titre.toLowerCase()}.`);
				break;
			}
			case "noter_depense": {
				const plan = planDe(donnees.budget ?? []);
				if (!plan) {
					echecs.push("Le budget n'est pas encore en place : ouvre la page Budget.");
					break;
				}
				const jour = action.jour ?? aujourdhui;
				const poste = action.charge ? trouverParNom(plan.postes.filter((p) => p.qui === null), action.charge, (p) => p.libelle) : void 0;
				let depense;
				if (poste) {
					const facture = facturesAPayer(plan, donnees.budget ?? [], jour, 45).find((f) => f.poste.id === poste.id);
					depense = facture ? {
						...payerFacture(facture, jour, membreId, ctx, "jarvis"),
						montant: Math.round(action.montant * 100) / 100
					} : nouvelleDepense({
						montant: action.montant,
						pot: poste.pot && poste.pot !== "commun" ? poste.pot : "factures",
						libelle: poste.libelle,
						jour,
						posteId: poste.id,
						source: "jarvis"
					}, membreId, ctx);
				} else depense = nouvelleDepense({
					montant: action.montant,
					pot: action.pot,
					libelle: action.libelle || action.magasin || POTS[action.pot].nom,
					magasin: action.magasin,
					jour,
					source: "jarvis",
					articles: action.articles
				}, membreId, ctx);
				const complete = completerPaiement(depense, donnees.budget ?? []);
				if (complete) {
					const avant = (donnees.budget ?? []).find((d) => d.genre === "depense" && d.id === complete.id) ?? null;
					modifications.push({
						collection: "budget",
						avant,
						apres: complete
					});
					faits.push(`Ajouté au paiement Apple Pay de ${formaterMontant(complete.montant)} (${(complete.magasin ?? complete.libelle).toLowerCase()}).`);
					break;
				}
				modifications.push({
					collection: "budget",
					avant: null,
					apres: depense
				});
				faits.push(`Noté au budget : ${depense.libelle.toLowerCase()}, ${formaterMontant(depense.montant)} (${POTS[depense.pot].nom.toLowerCase()}).`);
				break;
			}
			case "enregistrer_recette": {
				const { recette, avant } = apprendreRecette(recettes, action.recette, ctx);
				recettes = [...recettes.filter((r) => r.id !== recette.id), recette];
				const deja = modifications.find((m) => m.collection === "menus" && m.apres.id === recette.id);
				if (deja) deja.apres = recette;
				else modifications.push({
					collection: "menus",
					avant,
					apres: recette
				});
				faits.push(avant ? `« ${recette.titre} » était déjà dans vos recettes : elle monte dans la liste.` : `« ${recette.titre} » rangée dans vos recettes.`);
				break;
			}
			case "noter_taille": {
				const personne = trouverParNom(donnees.foyer.membres, action.pour, (m) => m.prenom);
				if (!personne) {
					echecs.push(`Je ne connais pas « ${action.pour} » dans le foyer.`);
					break;
				}
				const avant = tailleDe(donnees.vetements ?? [], personne.id, action.piece);
				const apres = poserTaille(personne.id, action.piece, action.valeur, ctx);
				if (!apres) break;
				modifications.push({
					collection: "vetements",
					avant,
					apres
				});
				faits.push(`Taille notée pour ${personne.prenom} : ${PIECES.find((p) => p.id === action.piece).nom.toLowerCase()} ${apres.valeur}.`);
				break;
			}
			case "noter_envie": {
				const personne = trouverParNom(donnees.foyer.membres, action.pour, (m) => m.prenom);
				if (!personne) {
					echecs.push(`Je ne connais pas « ${action.pour} » dans le foyer.`);
					break;
				}
				const envie = nouvelleEnvie(action.envie, personne.id, membreId, ctx);
				if (!envie) break;
				modifications.push({
					collection: "vetements",
					avant: null,
					apres: envie
				});
				faits.push(`Envie notée pour ${personne.prenom} : ${envie.titre.toLowerCase()}${envie.prix !== null ? ` (${formaterMontant(envie.prix)})` : ""}.`);
				break;
			}
			case "noter_souhait": {
				const texte = `Souhait pour Jarvis : ${action.demande}${action.manque ? ` (il faudrait : ${action.manque})` : ""}`;
				if ((donnees.retours ?? []).some((r) => !r.regleLe && normaliser(r.texte) === normaliser(texte))) {
					faits.push("Ce souhait était déjà noté pour Claude.");
					break;
				}
				const retour = nouveauRetour({
					texte,
					genre: "idee",
					ecran: "Jarvis",
					version: donnees.version ?? "",
					auteur: membreId
				}, ctx);
				modifications.push({
					collection: "retours",
					avant: null,
					apres: retour
				});
				faits.push("Souhait noté pour Claude.");
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
/** Une action proposée, en une ligne, pour la valider ou l'écarter (conseil du dimanche). */
function decrireAction(action) {
	switch (action.outil) {
		case "ajouter_courses": return `Courses : ${enumerer(action.articles)}`;
		case "cocher_courses": return `Cocher : ${enumerer(action.articles)}`;
		case "ajouter_tache": return `Nouvelle tâche : ${action.titre}, le ${action.echeance}${action.responsable ? `, pour ${action.responsable}` : ""}`;
		case "tache_faite": return `Marquer faite : ${action.titre}`;
		case "attribuer_tache": return action.responsable ? `${action.titre} → ${action.responsable}` : `${action.titre} → libre`;
		case "ajouter_au_stock": return `Ranger : ${enumerer(action.produits.map((p) => p.nom))}`;
		case "noter_pesee": return `Pesée de ${action.animal} : ${action.grammes} g`;
		case "regler_animal": return `${action.animal} : ${[action.poidsEstime !== null ? `environ ${action.poidsEstime} g` : "", action.ration !== null ? `ration ${action.ration} g par jour` : ""].filter(Boolean).join(", ")}`;
		case "noter_journal": return `${action.animal} : ${TYPES_EVENEMENT[action.quoi].toLowerCase()}${action.note ? ` (${action.note})` : ""}`;
		case "noter_soin": return `Carnet de ${action.animal} : ${action.libelle || TYPES_SOIN[action.type]}, ${action.fait ? "fait" : "prévu"} le ${action.date}`;
		case "ajouter_plante": return `Planter : ${enumerer(action.plantes)}${action.zone ? ` (${action.zone})` : ""}`;
		case "arrosage_fait": return action.zone ? `Arrosé : ${action.zone}` : "Arrosé : tout le jardin";
		case "modifier_tache": return `Modifier : ${action.titre}${action.nouveauTitre ? ` → ${action.nouveauTitre}` : ""}${action.echeance ? `, le ${action.echeance}` : ""}`;
		case "supprimer_tache": return `Supprimer la tâche : ${action.titre}`;
		case "retirer_du_stock": return `Retirer du stock : ${enumerer(action.produits)}`;
		case "retenir": return `Retenir : ${action.fait}`;
		case "oublier": return `Oublier : ${action.fait}`;
		case "noter_souhait": return `Souhait pour Claude : ${action.demande}`;
		case "enregistrer_recette": return `Recette : ${action.recette.titre} (${SOURCES_RECETTE[action.recette.source].toLowerCase()})`;
		case "ajouter_evenement": return `Agenda : ${action.titre}, le ${action.jour}${action.heure ? ` à ${action.heure}` : ""}${action.pour ? `, pour ${action.pour}` : ""}`;
		case "supprimer_evenement": return `Retirer de l'agenda : ${action.titre}`;
		case "noter_depense": return `Budget : ${action.charge ?? action.libelle ?? action.magasin ?? ""} ${formaterMontant(action.montant)}`;
		case "noter_taille": return `Taille de ${action.pour} : ${PIECES.find((p) => p.id === action.piece).nom.toLowerCase()} ${action.valeur}`;
		case "noter_envie": return `Envie de ${action.pour} : ${lireEnvie(action.envie).titre}`;
	}
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
//#endregion
//#region src/domaine/siri.ts
/** Les collections que Jarvis lit et modifie. */
const COLLECTIONS_SIRI = [
	"foyer",
	"listes",
	"elements",
	"taches",
	"animaux",
	"stock",
	"catalogue",
	"jardin",
	"memoire",
	"retours",
	"agenda",
	"budget",
	"menus",
	"vetements"
];
/** Une question en attente, ou le dernier tour (pour « annule » et la suite de la conversation), au plus tant de minutes. */
const MINUTES_RETENUES = 10;
/** La phrase que Siri ajoute à une question : le raccourci la repère pour réécouter tout de suite. */
const OUI_OU_NON = "Oui ou non ?";
/** Le nom proposé pour le raccourci : la fée du téléphone (Tael pour Dany, Navi pour Sarah). */
function nomPropose(prenom) {
	const p = normaliser(prenom ?? "");
	if (p.startsWith("d") || p.startsWith("melo")) return "Tael";
	if (p.startsWith("s")) return "Navi";
	return "Jarvis";
}
/** Le nom gardé avec le jeton : un mot ou deux, sans rien d'autre. */
function nomAssistant(v) {
	return (typeof v === "string" ? v.replace(/[^\p{L}\p{N} '-]/gu, "").trim().slice(0, 30) : "") || "Jarvis";
}
/** Ce que Jarvis sait de sa voix quand il passe par Siri. */
function consignesSiri(consignes, nom) {
	return `${consignes}
Ici, tu passes par Siri et tu t'appelles ${nom} : ta réponse est dite à voix haute, sans écran. Une ou deux phrases courtes, sans liste, sans emoji, sans adresse ni chiffre inutile. Pas de photo ni de lien possible par Siri.`;
}
/** Les données du foyer telles que le serveur les garde (une ligne par document). */
function donneesDepuisDocuments(lignes, version = "Siri") {
	const de = (c) => lignes.filter((l) => l.collection === c && l.donnees).map((l) => l.donnees);
	const foyer = de("foyer")[0];
	if (!foyer) return null;
	return {
		foyer,
		listes: de("listes"),
		elements: de("elements"),
		taches: de("taches"),
		animaux: de("animaux"),
		produits: de("stock"),
		catalogue: de("catalogue"),
		zones: de("jardin"),
		meteo: null,
		souvenirs: de("memoire"),
		retours: de("retours"),
		agenda: de("agenda"),
		budget: de("budget"),
		menus: de("menus"),
		vetements: de("vetements"),
		version
	};
}
/** « Oui », « non » ou « annule » dit seul (ou presque) ; null pour une vraie demande. */
function reponseCourte(phrase) {
	const t = normaliser(phrase).replace(/[.!?,;]/g, " ").replace(/\s+/g, " ").trim();
	if (/^(oui|ouais|ok|okay|d'accord|dac|vas-y|vas y|go|confirme|je confirme|c'est ca|exact|bien sur|oui vas-y|oui vas y|oui merci|oui oui|oui s'il te plait|fais-le|fais le)$/.test(t)) return "oui";
	if (/^(non|non merci|laisse|laisse tomber|pas maintenant|surtout pas|non non|rien)$/.test(t)) return "non";
	if (/^(annule|annule ca|annule tout|defais|defais ca|reviens en arriere|annuler|annule le|annule la derniere chose)$/.test(t)) return "annule";
	return null;
}
/** La suite d'avant, si elle date de moins de MINUTES_RETENUES. */
function suiteRecente(v, maintenant) {
	if (!v || typeof v !== "object") return null;
	const s = v;
	if (typeof s.le !== "string" || Date.parse(maintenant) - Date.parse(s.le) > 6e5) return null;
	return {
		attente: s.attente ?? null,
		modifications: Array.isArray(s.modifications) ? s.modifications : [],
		tours: Array.isArray(s.tours) ? s.tours.slice(-6) : [],
		le: s.le
	};
}
/** Ce qu'il faut écrire sur le serveur pour chaque modification de Jarvis. */
function lignesAEcrire(modifications) {
	return modifications.map((m) => {
		if (!("supprime" in m && m.supprime)) return {
			collection: m.collection,
			id: m.apres.id,
			donnees: m.apres
		};
		if (m.collection === "agenda" && m.apres.icloud) return {
			collection: "agenda",
			id: m.apres.id,
			donnees: {
				...m.apres,
				aRetirer: true
			}
		};
		return {
			collection: m.collection,
			id: m.apres.id,
			donnees: null
		};
	});
}
/** Ce qu'il faut écrire pour défaire le dernier tour. */
function lignesAnnulation(modifications) {
	return annulation(modifications).map(({ collection, id, remettre }) => ({
		collection,
		id,
		donnees: remettre
	}));
}
/** Retire ce que Siri dirait mal : mise en forme, emoji, retours à la ligne. */
function pourLaVoix(texte) {
	return texte.replace(/[*_#`>]/g, "").replace(/\p{Extended_Pictographic}/gu, "").replace(/\s+/g, " ").trim().slice(0, 600);
}
/** Applique ce que Jarvis a demandé ; une action qui supprime devient la question du tour. */
function tourSiri(texteModele, appels, donnees, membreId, aujourdhui, ctx) {
	const actions = lireActions(appels);
	const directes = actions.filter((a) => !aConfirmer(a));
	const attente = actions.find(aConfirmer) ?? null;
	const resultat = appliquerActions(directes, donnees, membreId, aujourdhui, ctx);
	const phrases = [
		texteModele,
		...resultat.faits,
		...resultat.echecs
	].filter(Boolean);
	if (attente) phrases.push(`${questionPour(attente).question} ${OUI_OU_NON}`);
	return {
		dit: pourLaVoix(phrases.join(" ")) || "C'est fait.",
		modifications: resultat.modifications,
		attente
	};
}
/** « Oui » à la question d'avant : l'action se fait. */
function confirmer(attente, donnees, membreId, aujourdhui, ctx) {
	const resultat = appliquerActions([attente], donnees, membreId, aujourdhui, ctx);
	return {
		dit: pourLaVoix([...resultat.faits, ...resultat.echecs].join(" ")) || "C'est fait.",
		modifications: resultat.modifications,
		attente: null
	};
}
/** La phrase à coller dans « Décrire un raccourci » (Raccourcis, iOS 26) : le raccourci entier, l'adresse dedans. */
function demandeRaccourciSiri(adresse, nom) {
	return [
		`Crée un raccourci nommé « ${nom} », pour que je puisse dire « Dis Siri, ${nom} ».`,
		"1. Action « Demander une saisie » : type Texte, question « Je t'écoute ».",
		"2. Action « Obtenir le contenu de l'URL » :",
		`- URL : ${adresse}`,
		"- Méthode : POST",
		"- Corps de la requête : JSON, avec un champ de type Texte : demande = la saisie demandée à l'étape 1",
		"3. Action « Énoncer le texte » (ou « Afficher le résultat ») avec le contenu obtenu.",
		`4. Si le contenu obtenu contient « ${OUI_OU_NON} » : redemander une saisie (question « Oui ou non ? »), l'envoyer de la même façon à la même URL (champ demande), puis énoncer la réponse.`,
		"Pas d'autre action."
	].join("\n");
}
const RACCOURCIS_ECRAN = [
	{
		id: "courses",
		nom: "Aux courses",
		resume: "Demande quoi, puis l'ajoute à la liste de courses.",
		question: "Quoi ajouter aux courses ?",
		demande: "Ajoute aux courses : {saisie}"
	},
	{
		id: "soir",
		nom: "Ce soir",
		resume: "Dit ce qu'il reste à faire ce soir et ce qu'on mange.",
		question: null,
		demande: "Qu'est-ce qu'il reste à faire ce soir, et qu'est-ce qu'on mange ?"
	},
	{
		id: "depense",
		nom: "Dépense",
		resume: "Demande le montant et le libellé, puis la note au budget.",
		question: "Quelle dépense ? (ex. Migros 84.30)",
		demande: "Note cette dépense au budget : {saisie}"
	}
];
/** La phrase à coller dans « Décrire un raccourci » pour un bouton de l'écran d'accueil, avec l'adresse de cet iPhone. */
function demandeRaccourciEcran(adresse, nomFee, r) {
	const corps = r.question ? "le texte de l'étape 1 dans la demande ci-dessous à la place de {saisie}" : "la demande ci-dessous telle quelle";
	return [
		`Crée un raccourci nommé « ${r.nom} » à mettre sur l'écran d'accueil ; il parle à ${nomFee}, l'assistant de notre app, sans que j'aie à ouvrir l'app.`,
		...r.question ? [`1. Action « Demander une saisie » : type Texte, question « ${r.question} ».`] : [],
		`${r.question ? "2" : "1"}. Action « Obtenir le contenu de l'URL » :`,
		`- URL : ${adresse}`,
		"- Méthode : POST",
		`- Corps de la requête : JSON, un champ de type Texte nommé demande, qui contient ${corps} :`,
		`« ${r.demande} »`,
		`${r.question ? "3" : "2"}. Action « Afficher la notification » avec le contenu obtenu.`,
		"Pas d'autre action. Propose ensuite de l'ajouter à l'écran d'accueil."
	].join("\n");
}
//#endregion
export { COLLECTIONS_SIRI, CONSIGNES_JARVIS, MINUTES_RETENUES, MODELE_JARVIS, OUI_OU_NON, OUTILS_JARVIS, RACCOURCIS_ECRAN, TOURS_RETENUS, aConfirmer, annulation, appliquerActions, confirmer, consignesSiri, coutMicroChf, decrireFoyer, demandeRaccourciEcran, demandeRaccourciSiri, donneesDepuisDocuments, etatBudget, formaterChf, lignesAEcrire, lignesAnnulation, lireActions, messageDemande, moisDe, nomAssistant, nomPropose, pourLaVoix, questionPour, reponseCourte, suiteRecente, tourSiri };
