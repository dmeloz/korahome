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
function versHeure(minutes) {
	const m = (Math.round(minutes) % 1440 + 1440) % 1440;
	return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
/**
* L'heure à un instant ISO, en minutes depuis minuit : celle du téléphone, ou celle d'un fuseau
* (le serveur, réglé en UTC, demande celle du foyer).
*/
function minutesLocales(instant, fuseau) {
	const d = new Date(instant);
	if (Number.isNaN(d.getTime())) return null;
	if (!fuseau) return d.getHours() * 60 + d.getMinutes();
	const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
		timeZone: fuseau,
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23"
	}).formatToParts(d).map((x) => [x.type, x.value]));
	return Number(p.hour) * 60 + Number(p.minute);
}
/**
* L'heure où la tâche est faite d'habitude : la médiane des heures de ses coches, arrondie
* au quart d'heure, dès trois coches. Avant, aucune.
*/
function heureProposee(tache, fuseau) {
	const minutes = (tache.historique ?? []).map((f) => f.a ? minutesLocales(f.a, fuseau) : null).filter((m) => m !== null).sort((a, b) => a - b);
	if (minutes.length < 3) return null;
	const milieu = Math.floor(minutes.length / 2);
	const mediane = minutes.length % 2 ? minutes[milieu] : (minutes[milieu - 1] + minutes[milieu]) / 2;
	return versHeure(Math.round(mediane / 15) * 15);
}
/** L'heure affichée : celle choisie à la main, sinon celle que propose Kora. */
function heureDe(tache, fuseau) {
	return tache.heure !== void 0 ? tache.heure : heureProposee(tache, fuseau);
}
/** Une tâche unique faite est terminée ; une tâche qui revient ne l'est jamais. */
function estTerminee(tache) {
	return !tache.recurrence && tache.faiteLe !== null;
}
//#endregion
//#region src/domaine/mitsu.ts
const TYPES_SOIN = {
	vaccin: "Vaccin",
	vermifuge: "Vermifuge",
	antiparasitaire: "Antipuces et tiques",
	sterilisation: "Stérilisation",
	visite: "Visite chez le vétérinaire",
	filtre: "Changer le filtre de la fontaine",
	autre: "Autre soin"
};
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
/** Les soins à venir, du plus proche au plus lointain. */
function soinsAVenir(animal) {
	return animal.soins.filter((s) => !s.fait).sort((a, b) => a.date.localeCompare(b.date));
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
const TYPES_EVENEMENT = {
	litiere: "Litière changée",
	vomi: "A vomi",
	pas_mange: "N'a pas mangé",
	selles: "Selles molles",
	boite: "Boite",
	cachee: "Se cache, abattue",
	autre: "Autre"
};
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
//#region src/domaine/agenda.ts
const estEvenement = (d) => "titre" in d && "jour" in d && !d.aRetirer;
const evenementsDe = (docs) => docs.filter(estEvenement);
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
/** Ce qui se passe un jour donné, y compris ce qui a commencé avant (des vacances). */
function duJour(occ, jour) {
	return occ.filter((o) => o.debut <= jour && o.fin >= jour).sort((a, b) => {
		const enCours = (o) => o.evenement.heure && o.debut === jour ? o.evenement.heure : "";
		return enCours(a).localeCompare(enCours(b)) || a.evenement.titre.localeCompare(b.evenement.titre, "fr");
	});
}
function filtrer(occ, filtre) {
	if (filtre === "tout") return [...occ];
	if (filtre === "nous") return occ.filter((o) => o.evenement.pour === null);
	return occ.filter((o) => o.evenement.pour === null || o.evenement.pour === filtre);
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
/** Le lundi de la semaine d'un jour. */
function lundiDe(jour) {
	return decaler(jour, {
		unite: "jour",
		tous: -((jourSemaine(jour) + 6) % 7)
	});
}
/** Ce qui concerne une personne aujourd'hui : le commun et le sien. */
function evenementsDuMatin(evenements, membreId, aujourdhui) {
	const occ = duJour(occurrences(evenements, aujourdhui, aujourdhui), aujourdhui);
	return membreId === null ? occ : filtrer(occ, membreId);
}
/** « Dentiste à 14:30 », « Vacances (jusqu'au 27 déc.) ». */
function decrireCourt(o, jour) {
	const e = o.evenement;
	if (o.fin > jour && o.debut < jour) return `${titreDe(o)} (jusqu'au ${dateCourte(o.fin)})`;
	return e.heure && o.debut === jour ? `${titreDe(o)} à ${e.heure}` : titreDe(o);
}
//#endregion
//#region src/domaine/budget.ts
/** « 84.30 CHF », « 2’000 CHF », « −12.50 CHF » : comme sur un relevé suisse. */
function formaterMontant(n, avecDevise = true) {
	const c = Math.round(Math.abs(n) * 100);
	const entier = Math.floor(c / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "’");
	const centimes = c % 100;
	const texte = `${n < 0 && c > 0 ? "−" : ""}${entier}${centimes ? `.${String(centimes).padStart(2, "0")}` : ""}`;
	return avecDevise ? `${texte} CHF` : texte;
}
function planDe(docs) {
	return docs.find((d) => d.genre === "plan") ?? null;
}
function moisDe$1(jour) {
	return jour.slice(0, 7);
}
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
	for (let mois = moisDe$1(de); mois <= moisDe$1(a); mois = moisSuivant(mois)) {
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
	return poste.frequence === "an" ? ecart >= -45 && ecart <= 45 : moisDe$1(d.jour) === moisDe$1(echeance);
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
/** Les factures du jour pour la carte « Aujourd'hui » et le rappel du matin. */
function facturesDuJour(docs, aujourdhui, jours = 3) {
	const plan = planDe(docs);
	if (!plan) return [];
	return facturesAPayer(plan, docs, aujourdhui, jours).map((f) => ({
		id: `${f.poste.id}-${f.echeance}`,
		libelle: `${f.poste.libelle} (${formaterMontant(f.montant)})`,
		echeance: f.echeance
	}));
}
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
/** « le 15 mars », « aujourd'hui », « demain », « en retard (le 3 octobre) ». */
function decrireEcheanceFacture(echeance, aujourdhui) {
	const ecart = ecartJours(aujourdhui, echeance);
	const date = `le ${Number(echeance.slice(8, 10))} ${NOMS_MOIS[Number(echeance.slice(5, 7)) - 1]}`;
	if (ecart < 0) return `en retard (${date})`;
	if (ecart === 0) return "aujourd'hui";
	if (ecart === 1) return "demain";
	return date;
}
//#endregion
//#region src/domaine/meteo.ts
/** Le jardin du foyer, à Renens (VD). */
const LIEU_DU_JARDIN = {
	nom: "Renens",
	latitude: 46.5354,
	longitude: 6.5918
};
function adresseMeteo(lieu = LIEU_DU_JARDIN) {
	return `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({
		latitude: String(lieu.latitude),
		longitude: String(lieu.longitude),
		daily: "temperature_2m_min,temperature_2m_max,precipitation_sum,weather_code",
		timezone: "Europe/Zurich",
		past_days: "2",
		forecast_days: "7"
	})}`;
}
const nombres = (v) => Array.isArray(v) && v.every((x) => typeof x === "number" || x === null);
/** Relit la réponse d'Open-Meteo ; null si elle n'a pas la forme attendue. */
function lireMeteo(brut, lue, lieu = LIEU_DU_JARDIN) {
	const d = brut?.daily;
	if (!d || !Array.isArray(d.time)) return null;
	const { time, temperature_2m_min: min, temperature_2m_max: max, precipitation_sum: pluie, weather_code: code } = d;
	if (!nombres(min) || !nombres(max) || !nombres(pluie) || !nombres(code)) return null;
	const jours = [];
	time.forEach((jour, i) => {
		if (typeof jour !== "string" || min[i] === null || max[i] === null) return;
		jours.push({
			jour,
			min: min[i],
			max: max[i],
			pluie: pluie[i] ?? 0,
			code: code[i] ?? 0
		});
	});
	return jours.length ? {
		lieu: lieu.nom,
		jours,
		lue
	} : null;
}
function meteoDu(meteo, jour) {
	return meteo?.jours.find((j) => j.jour === jour) ?? null;
}
/** Une météo de plus de 12 heures ne sert plus aux alertes. */
function meteoFraiche(meteo, maintenant, heures = 12) {
	return !!meteo && Date.parse(maintenant) - Date.parse(meteo.lue) < heures * 36e5;
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
const PAR_CLE = new Map(ESPECES.map((x) => [x.cle, x]));
function espece(cle) {
	return cle ? PAR_CLE.get(cle) ?? null : null;
}
//#endregion
//#region src/domaine/jardin.ts
const plusJours = (jour, n) => decaler(jour, {
	unite: "jour",
	tous: n
});
const moisDe = (jour) => Number(jour.slice(5, 7));
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
	const saison = FACTEUR_SAISON[moisDe(aujourdhui) - 1];
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
//#endregion
//#region src/domaine/listes.ts
const UNITES = "(?:kg|g|l|cl|ml|x|paquets?|boites?|boîtes?|bouteilles?|pots?|sachets?|tranches?)";
new RegExp(`^(\\d+(?:[.,]\\d+)?\\s*${UNITES}?)\\s+(?:de\\s+|d')?(.+)$`, "i");
new RegExp(`^(.+?)\\s+(?:x\\s*)?(\\d+(?:[.,]\\d+)?\\s*${UNITES}?)$`, "i");
function etatProduit(p, aujourdhui) {
	if (!p.peremption) return "sansDate";
	const ecart = ecartJours(aujourdhui, p.peremption);
	if (ecart < 0) return "perime";
	if (ecart === 0) return "aujourdhui";
	return ecart <= 3 ? "bientot" : "ok";
}
/** Périmé, à consommer aujourd'hui ou dans les trois jours. */
function estAConsommer(p, aujourdhui) {
	const e = etatProduit(p, aujourdhui);
	return e === "perime" || e === "aujourdhui" || e === "bientot";
}
const parDate = (a, b) => (a.peremption ?? "9999-12-31").localeCompare(b.peremption ?? "9999-12-31") || a.nom.localeCompare(b.nom, "fr");
/** Ce que le stock montre sur l'accueil et dans le rappel du matin. */
function resumeStock(produits, aujourdhui) {
	const aConsommer = produits.filter((p) => estAConsommer(p, aujourdhui)).sort(parDate);
	return {
		aConsommer,
		urgent: aConsommer.some((p) => {
			const e = etatProduit(p, aujourdhui);
			return e === "perime" || e === "aujourdhui";
		})
	};
}
//#endregion
//#region src/domaine/bandeau.ts
/**
* Les mots programmés que le passage de l'heure doit annoncer : ceux devenus visibles depuis
* le passage précédent. Fenêtre calée sur l'heure pleine, pour qu'un passage en retard de
* quelques secondes n'en oublie ni n'en double aucun.
*/
function fenetreMotsProgrammes(maintenant) {
	const heure = Math.floor(maintenant.getTime() / 36e5) * 36e5;
	return {
		apres: (/* @__PURE__ */ new Date(heure - 36e5)).toISOString(),
		jusqua: new Date(heure).toISOString()
	};
}
/** Le titre de la notification d'un mot. */
function notificationMot(foyer, m) {
	const prenom = foyer.membres.find((x) => x.id === m.de)?.prenom;
	return {
		titre: prenom ? `Un mot de ${prenom}` : "Un petit mot",
		corps: m.texte
	};
}
//#endregion
//#region src/domaine/rappels.ts
/** L'heure proposée au départ, décidée avec le foyer ; chacun peut la changer. */
const HEURE_DU_RAPPEL = 8;
/** Les heures possibles : de 5 h à 22 h. */
const HEURE_MIN = 5;
const HEURE_MAX = 22;
const TOUS_LES_JOURS = [
	1,
	2,
	3,
	4,
	5,
	6,
	0
];
const PREFERENCES_DE_DEPART = {
	taches: true,
	mitsu: true,
	stock: true,
	jardin: true,
	mots: true,
	agenda: true,
	budget: true,
	heure: 8,
	jours: TOUS_LES_JOURS
};
const FUSEAU_DU_FOYER = "Europe/Zurich";
function heureValide(heure) {
	return Number.isInteger(heure) && heure >= 5 && heure <= 22;
}
function minuteValide(minute) {
	return Number.isInteger(minute) && minute >= 0 && minute <= 59;
}
/** Relit « 07:45 » (la roue de l'iPhone) en heure et minute, ramenée entre 5:00 et 22:59. */
function lireHeure(texte) {
	const m = /^(\d{1,2}):(\d{2})/.exec(texte);
	if (!m) return null;
	const heure = Number(m[1]);
	const minute = Number(m[2]);
	if (heure > 23 || minute > 59) return null;
	if (heure < 5) return {
		heure: 5,
		minute: 0
	};
	if (heure > 22) return {
		heure: 22,
		minute: 59
	};
	return {
		heure,
		minute
	};
}
/** Une heure plus tôt (-1) ou plus tard (+1), sans sortir des heures possibles. */
function decalerHeure(heure, sens) {
	return Math.min(22, Math.max(5, heure + sens));
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
const SEMAINE = [
	1,
	2,
	3,
	4,
	5
];
const WEEK_END = [6, 0];
const memes = (a, b) => a.length === b.length && b.every((j) => a.includes(j));
/** Relit les jours enregistrés : sans doublon, dans l'ordre de la semaine ; tous les jours si rien de valable. */
function nettoyerJours(bruts) {
	if (!Array.isArray(bruts)) return [...TOUS_LES_JOURS];
	const jours = TOUS_LES_JOURS.filter((j) => bruts.includes(j));
	return jours.length ? jours : [...TOUS_LES_JOURS];
}
/** Ajoute ou retire un jour ; le dernier jour ne peut pas être retiré (couper les rappels sert à ça). */
function basculerJour(jours, jour) {
	if (jours.includes(jour)) return jours.length > 1 ? jours.filter((j) => j !== jour) : [...jours];
	return TOUS_LES_JOURS.filter((j) => j === jour || jours.includes(j));
}
/** Les raccourcis, comme dans l'app Horloge de l'iPhone. */
const RACCOURCIS_JOURS = [
	{
		libelle: "Tous les jours",
		jours: TOUS_LES_JOURS
	},
	{
		libelle: "En semaine",
		jours: SEMAINE
	},
	{
		libelle: "Le week-end",
		jours: WEEK_END
	}
];
/** « Tous les jours », « En semaine », « Le week-end », ou « lun, mer, ven ». */
function decrireJours(jours) {
	const raccourci = RACCOURCIS_JOURS.find((r) => memes(jours, r.jours));
	if (raccourci) return raccourci.libelle;
	return JOURS_SEMAINE.filter((j) => jours.includes(j.numero)).map((j) => j.court).join(", ");
}
/** Le jour de la semaine d'une date « AAAA-MM-JJ ». */
function jourDeLaSemaine(jour) {
	return (/* @__PURE__ */ new Date(`${jour}T12:00:00Z`)).getUTCDay();
}
/** « 8:00 », « 7:45 ». */
function formaterHeure(heure, minute = 0) {
	return `${heure}:${String(minuteValide(minute) ? minute : 0).padStart(2, "0")}`;
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
/**
* Les tâches de cette personne (et les libres) dont c'est l'heure à cette minute : celles du jour
* et celles en retard, avec une heure choisie ou proposée par Kora.
*/
function tachesALHeure(taches, membreId, aujourdhui, hhmm, fuseau = FUSEAU_DU_FOYER) {
	const { aujourdhui: duJour, enRetard } = tachesDuMatin(taches, membreId, aujourdhui);
	return [...enRetard, ...duJour].filter((t) => heureDe(t, fuseau) === hhmm);
}
/** « C'est l'heure : Litière de Mitsu. » */
function notificationHeure(taches) {
	if (!taches.length) return null;
	return {
		titre: "C'est l'heure",
		corps: `${enumerer(taches.map((t) => t.titre))}.`,
		nombre: taches.length
	};
}
function rappelDuMatin(entree) {
	const { preferences, aujourdhui } = entree;
	const lignes = [];
	let nombre = 0;
	if (preferences.agenda && entree.evenements) {
		const occ = evenementsDuMatin(entree.evenements, entree.membreId, aujourdhui);
		if (occ.length) lignes.push(`Agenda : ${enumerer(occ.map((o) => decrireCourt(o, aujourdhui)))}`);
		nombre += occ.length;
	}
	if (preferences.taches) {
		const t = tachesDuMatin(entree.taches, entree.membreId, aujourdhui);
		if (t.aujourdhui.length) lignes.push(`Aujourd'hui : ${enumerer(t.aujourdhui.map((x) => x.titre))}`);
		if (t.enRetard.length) lignes.push(`En retard : ${enumerer(t.enRetard.map((x) => x.titre))}`);
		nombre += t.aujourdhui.length + t.enRetard.length;
	}
	if (preferences.budget && entree.factures?.length) {
		lignes.push(`Factures : ${enumerer(entree.factures.map((f) => `${f.libelle} ${decrireEcheanceFacture(f.echeance, aujourdhui)}`))}`);
		nombre += entree.factures.length;
	}
	if (preferences.mitsu) for (const animal of entree.animaux) {
		const urgentes = choseAFaire(animal, aujourdhui).filter((c) => c.urgent);
		if (!urgentes.length) continue;
		lignes.push(`${animal.nom} : ${urgentes.slice(0, 2).map((c) => c.texte).join(" · ")}${urgentes.length > 2 ? "…" : ""}`);
		nombre += urgentes.length;
	}
	if (preferences.stock && entree.produits) {
		const { aConsommer } = resumeStock(entree.produits, aujourdhui);
		if (aConsommer.length) lignes.push(`À consommer : ${enumerer(aConsommer.map((p) => p.nom))}`);
		nombre += aConsommer.length;
	}
	if (preferences.jardin && entree.zones?.length) {
		const meteo = !entree.maintenant || meteoFraiche(entree.meteo ?? null, entree.maintenant) ? entree.meteo ?? null : null;
		const gestes = gestesDuJardin(entree.zones, meteo, aujourdhui).filter((g) => g.urgent);
		if (gestes.length) lignes.push(`Jardin : ${gestes.slice(0, 2).map((g) => g.texte).join(" · ")}${gestes.length > 2 ? "…" : ""}`);
		nombre += gestes.length;
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
		minute: "2-digit",
		hourCycle: "h23"
	}).formatToParts(instant).map((p) => [p.type, p.value]));
	return {
		jour: `${parties.year}-${parties.month}-${parties.day}`,
		heure: Number(parties.hour),
		minute: Number(parties.minute)
	};
}
/**
* Le serveur passe chaque minute : un téléphone reçoit son rappel au premier passage
* à partir de son heure et de sa minute, une seule fois par jour (un passage manqué est rattrapé
* dans la matinée, jamais l'après-midi), et seulement les jours choisis.
*/
function rappelDu(instant, heure, dernierEnvoi, fuseau = FUSEAU_DU_FOYER, jours = TOUS_LES_JOURS, minute = 0) {
	const local = jourEtHeure(instant, fuseau);
	const maintenant = local.heure * 60 + local.minute;
	const prevu = heure * 60 + (minuteValide(minute) ? minute : 0);
	if (maintenant < prevu || maintenant >= Math.max(prevu + 60, 720)) return null;
	if (!nettoyerJours(jours).includes(jourDeLaSemaine(local.jour))) return null;
	return dernierEnvoi === local.jour ? null : local.jour;
}
//#endregion
export { FUSEAU_DU_FOYER, HEURE_DU_RAPPEL, HEURE_MAX, HEURE_MIN, JOURS_SEMAINE, PREFERENCES_DE_DEPART, RACCOURCIS_JOURS, TOUS_LES_JOURS, adresseMeteo, basculerJour, decalerHeure, decrireJours, evenementsDe, facturesDuJour, fenetreMotsProgrammes, formaterHeure, heureValide, jourDeLaSemaine, jourEtHeure, lireHeure, lireMeteo, minuteValide, nettoyerJours, notificationHeure, notificationMot, rappelDu, rappelDuMatin, tachesALHeure, tachesDuMatin };
