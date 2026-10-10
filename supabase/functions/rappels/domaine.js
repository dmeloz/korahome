// Généré par `npm run fonction` depuis src/domaine/rappels.ts : ne pas modifier à la main.
//#region src/domaine/foyer.ts
var ErreurValidation = class extends Error {};
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
/** Une tâche unique faite est terminée ; une tâche qui revient ne l'est jamais. */
function estTerminee(tache) {
	return !tache.recurrence && tache.faiteLe !== null;
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
/** Prochaine pesée, au rythme choisi après la dernière. */
function prochainePesee(animal, aujourdhui) {
	const derniere = poidsActuel(animal);
	if (!derniere) return aujourdhui;
	return plusJours(derniere.jour, animal.reglages.peseeTousLes);
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
//#region src/domaine/rappels.ts
/** L'heure proposée au départ, décidée avec le foyer ; chacun peut la changer. */
const HEURE_DU_RAPPEL = 8;
/** Les heures possibles : de 5 h à 22 h. */
const HEURE_MIN = 5;
const HEURE_MAX = 22;
const PREFERENCES_DE_DEPART = {
	taches: true,
	mitsu: true,
	heure: 8
};
const FUSEAU_DU_FOYER = "Europe/Zurich";
function heureValide(heure) {
	return Number.isInteger(heure) && heure >= 5 && heure <= 22;
}
/** Une heure plus tôt (-1) ou plus tard (+1), sans sortir des heures possibles. */
function decalerHeure(heure, sens) {
	return Math.min(22, Math.max(5, heure + sens));
}
/** « 8:00 », « 18:00 ». */
function formaterHeure(heure) {
	return `${heure}:00`;
}
/** Au plus trois noms par ligne, puis « et 2 autres ». */
const MAX_PAR_LIGNE = 3;
function enumerer(noms) {
	if (noms.length <= MAX_PAR_LIGNE) return noms.join(", ");
	const reste = noms.length - MAX_PAR_LIGNE;
	return `${noms.slice(0, MAX_PAR_LIGNE).join(", ")} et ${reste} autre${reste > 1 ? "s" : ""}`;
}
/** Les tâches de cette personne et les tâches libres, dues aujourd'hui ou en retard. */
function tachesDuMatin(taches, membreId, aujourdhui) {
	const miennes = taches.filter((t) => !estTerminee(t) && (membreId === null || t.responsable === null || t.responsable === membreId)).sort((a, b) => a.echeance.localeCompare(b.echeance) || a.titre.localeCompare(b.titre, "fr"));
	return {
		aujourdhui: miennes.filter((t) => ecartJours(aujourdhui, t.echeance) === 0),
		enRetard: miennes.filter((t) => ecartJours(aujourdhui, t.echeance) < 0)
	};
}
function rappelDuMatin(entree) {
	const { preferences, aujourdhui } = entree;
	const lignes = [];
	let nombre = 0;
	if (preferences.taches) {
		const t = tachesDuMatin(entree.taches, entree.membreId, aujourdhui);
		if (t.aujourdhui.length) lignes.push(`Aujourd'hui : ${enumerer(t.aujourdhui.map((x) => x.titre))}`);
		if (t.enRetard.length) lignes.push(`En retard : ${enumerer(t.enRetard.map((x) => x.titre))}`);
		nombre += t.aujourdhui.length + t.enRetard.length;
	}
	if (preferences.mitsu) for (const animal of entree.animaux) {
		const urgentes = choseAFaire(animal, aujourdhui).filter((c) => c.urgent);
		if (!urgentes.length) continue;
		lignes.push(`${animal.nom} : ${urgentes.slice(0, 2).map((c) => c.texte).join(" · ")}${urgentes.length > 2 ? "…" : ""}`);
		nombre += urgentes.length;
	}
	if (nombre === 0) return null;
	const prenom = entree.foyer?.membres.find((m) => m.id === entree.membreId)?.prenom;
	return {
		titre: prenom ? `Bonjour ${prenom}` : "Bonjour",
		corps: lignes.join("\n"),
		nombre
	};
}
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
/**
* Le serveur passe chaque heure : un téléphone reçoit son rappel au premier passage
* à partir de son heure, une seule fois par jour (un passage manqué est rattrapé
* dans la matinée, jamais l'après-midi).
*/
function rappelDu(instant, heure, dernierEnvoi, fuseau = FUSEAU_DU_FOYER) {
	const local = jourEtHeure(instant, fuseau);
	if (local.heure < heure || local.heure >= Math.max(heure + 1, 12)) return null;
	return dernierEnvoi === local.jour ? null : local.jour;
}
//#endregion
export { FUSEAU_DU_FOYER, HEURE_DU_RAPPEL, HEURE_MAX, HEURE_MIN, PREFERENCES_DE_DEPART, decalerHeure, formaterHeure, heureValide, jourEtHeure, rappelDu, rappelDuMatin, tachesDuMatin };
