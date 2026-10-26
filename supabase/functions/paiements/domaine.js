// Généré par `npm run fonction` depuis src/domaine/paiements.ts : ne pas modifier à la main.
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
//#endregion
//#region src/domaine/texte.ts
/** « Pâtes fraîches » → « Pates fraiches » : la casse est gardée, seuls les accents partent. */
const sansAccents$1 = (t) => t.normalize("NFD").replace(/\p{M}/gu, "");
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
function planDe(docs) {
	return docs.find((d) => d.genre === "plan") ?? null;
}
function moisDe(jour) {
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
	for (let mois = moisDe(de); mois <= moisDe(a); mois = moisSuivant(mois)) {
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
	return poste.frequence === "an" ? ecart >= -45 && ecart <= 45 : moisDe(d.jour) === moisDe(echeance);
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
const motsDe = (t) => sansAccents(t).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((m) => m.length >= 4);
/**
* La facture qu'un paiement règle, reconnue seule (Kora 0.0.37) : une facture à payer à la main,
* dont l'échéance tombe de 25 jours après à 30 jours avant le paiement, et dont le nom se retrouve
* dans le libellé (à 10 % près sur le montant), ou dont le montant est exactement le même quand le
* paiement sort du pot de cette facture (ou du pot factures). Null si rien ne correspond.
*/
function factureReglee(paiement, plan, docs) {
	const mots = new Set(motsDe(`${paiement.libelle} ${paiement.magasin ?? ""}`));
	return factures(plan, docs, paiement.jour, 30).filter((f) => !f.payee && !f.automatique).map((f) => {
		const ecart = ecartJours(f.echeance, paiement.jour);
		const nom = motsDe(f.poste.libelle).some((m) => mots.has(m));
		const exact = Math.abs(f.montant - paiement.montant) < .01;
		const proche = f.montant > 0 && Math.abs(f.montant - paiement.montant) / f.montant <= .1;
		const memePot = paiement.pot === "factures" || paiement.pot === (f.poste.pot ?? "factures");
		return {
			f,
			retenue: ecart >= -25 && ecart <= 30 && (nom && proche || exact && memePot),
			score: (nom ? 2 : 0) + (exact ? 1 : 0),
			ecart: Math.abs(ecart)
		};
	}).filter((x) => x.retenue).sort((a, b) => b.score - a.score || a.ecart - b.ecart)[0]?.f ?? null;
}
/** La dépense, liée à la facture qu'elle règle si Kora la reconnaît (sinon telle quelle). */
function reglerFacture(d, plan, docs) {
	if (d.posteId) return d;
	const f = factureReglee(d, plan, docs);
	if (!f) return d;
	return {
		...d,
		posteId: f.poste.id,
		echeance: f.echeance,
		pot: f.poste.pot ?? "factures",
		libelle: f.poste.libelle
	};
}
const sansAccents = (t) => sansAccents$1(t).toLowerCase();
//#endregion
//#region src/domaine/paiements.ts
/** Les pots qu'on peut donner à une carte, dans l'ordre des puces. */
const POTS_DE_CARTE = [
	"perso",
	"courses",
	"plaisir",
	"factures",
	"commun",
	"epargne"
];
/** « CHF 12.50 », « 12,50 CHF », « €8.90 », « 1’234.50 », 12.5 → le montant et sa monnaie ; null si illisible. */
function lireMontantPaye(valeur) {
	if (typeof valeur === "number") return Number.isFinite(valeur) && valeur > 0 ? {
		montant: auCentime(valeur),
		devise: "CHF"
	} : null;
	if (typeof valeur !== "string") return null;
	const texte = valeur.trim().slice(0, 40);
	const devise = /€|eur/i.test(texte) ? "EUR" : /\$|usd/i.test(texte) ? "USD" : /£|gbp/i.test(texte) ? "GBP" : /\b(?!CHF)[A-Z]{3}\b/.exec(texte)?.[0] ?? "CHF";
	const nombre = /\d[\d’' .,]*/.exec(texte)?.[0].replace(/[’' ]/g, "").replace(/[.,]$/, "");
	if (!nombre) return null;
	const derniere = Math.max(nombre.lastIndexOf("."), nombre.lastIndexOf(","));
	let propre = nombre;
	if (derniere >= 0) propre = nombre.length - derniere - 1 <= 2 ? `${nombre.slice(0, derniere).replace(/[.,]/g, "")}.${nombre.slice(derniere + 1)}` : nombre.replace(/[.,]/g, "");
	const montant = Number(propre);
	return Number.isFinite(montant) && montant > 0 && montant < 1e5 ? {
		montant: auCentime(montant),
		devise
	} : null;
}
/** Le nom de la carte sans aucun chiffre (« Revolut •••• 1234 » → « Revolut »). */
function nomDeCarte(valeur) {
	return (typeof valeur === "string" ? valeur : "").replace(/\d/g, "").replace(/[•*·#]+/g, " ").replace(/\s+[-–]\s*$/, "").replace(/\s+/g, " ").trim().slice(0, 40) || "Carte";
}
/** « MIGROS M RENENS » → « Migros M Renens » ; un nom déjà écrit normalement reste tel quel. */
function nomDeCommercant(valeur) {
	const texte = (typeof valeur === "string" ? valeur : "").replace(/\s+/g, " ").trim().slice(0, 60);
	if (!texte) return null;
	if (texte !== texte.toUpperCase()) return texte;
	return texte.toLowerCase().replace(/(^|[\s'’.-])(\p{L})/gu, (_, avant, l) => avant + l.toUpperCase());
}
const cleDeCarte = (carte) => sansAccents$1(carte.toLowerCase()).trim();
/** Ce que le foyer a décidé pour cette carte ; undefined si elle est encore inconnue. */
function choixDeCarte(plan, carte) {
	const cle = cleDeCarte(carte);
	return Object.entries(plan.cartes ?? {}).find(([nom]) => cleDeCarte(nom) === cle)?.[1];
}
/** Retenir le pot d'une carte (ou l'oublier avec null). */
function retenirCarte(plan, carte, choix, ctx) {
	const cle = cleDeCarte(carte);
	const cartes = Object.fromEntries(Object.entries(plan.cartes ?? {}).filter(([nom]) => cleDeCarte(nom) !== cle));
	if (choix) cartes[nomDeCarte(carte)] = choix;
	return {
		...plan,
		cartes,
		majLe: ctx.maintenant()
	};
}
const paiementsAClasser = (docs) => docs.filter((d) => d.genre === "paiement").sort((a, b) => b.jour.localeCompare(a.jour) || b.creeLe.localeCompare(a.creeLe));
const memeMontant = (a, b) => Math.abs(a - b) < .005;
/** Un paiement envoyé par le raccourci d'un iPhone : une dépense, un paiement à classer, ou rien. */
function recevoirPaiement(entree, docs, par, jour, ctx) {
	const plan = planDe(docs);
	if (!plan) return {
		genre: "refuse",
		message: "Le budget n'est pas encore en place dans Kora."
	};
	const lu = lireMontantPaye(entree.montant);
	if (!lu) return {
		genre: "refuse",
		message: "Montant illisible."
	};
	const carte = nomDeCarte(entree.carte);
	const magasin = nomDeCommercant(entree.marchand);
	const choix = choixDeCarte(plan, carte);
	if (choix === "aucun") return {
		genre: "ignore",
		message: `Carte ${carte} : hors du budget du foyer.`
	};
	const deja = lu.devise === "CHF" && depenses(docs).some((d) => d.jour === jour && memeMontant(d.montant, lu.montant) && (d.source !== "applepay" || d.magasin === magasin));
	const dejaAClasser = paiementsAClasser(docs).some((p) => p.jour === jour && memeMontant(p.montant, lu.montant) && p.devise === lu.devise && p.marchand === magasin);
	if (deja || dejaAClasser) return {
		genre: "doublon",
		message: "Déjà noté."
	};
	if (choix && lu.devise === "CHF") {
		const doc = reglerFacture({
			id: ctx.nouvelId(),
			genre: "depense",
			jour,
			montant: lu.montant,
			pot: choix,
			libelle: magasin ?? POTS[choix].nom,
			magasin,
			posteId: null,
			echeance: null,
			source: "applepay",
			carte,
			par,
			creeLe: ctx.maintenant()
		}, plan, docs);
		if (doc.posteId) return {
			genre: "depense",
			doc,
			message: `Facture ${doc.libelle} payée.`
		};
		return {
			genre: "depense",
			doc,
			message: `${formaterMontant(lu.montant)} noté dans ${POTS[choix].nom.toLowerCase()}.`
		};
	}
	return {
		genre: "paiement",
		doc: {
			id: ctx.nouvelId(),
			genre: "paiement",
			jour,
			montant: lu.montant,
			devise: lu.devise,
			marchand: magasin,
			carte,
			par,
			creeLe: ctx.maintenant()
		},
		message: choix ? "Autre monnaie : à classer dans Kora." : `Carte ${carte} nouvelle : choisis son pot dans Kora.`
	};
}
/** Classer un paiement : il devient une dépense du pot choisi (montant en francs, revu s'il venait d'une autre monnaie). */
function classerPaiement(paiement, pot, montantChf, ctx, etiquette) {
	if (etiquette) pot = etiquette.pot;
	return {
		id: paiement.id,
		genre: "depense",
		jour: paiement.jour,
		montant: auCentime(Math.max(0, montantChf)),
		pot,
		libelle: etiquette?.nom ?? paiement.marchand ?? POTS[pot].nom,
		...etiquette ? { etiquette: etiquette.id } : {},
		magasin: paiement.marchand,
		posteId: null,
		echeance: null,
		source: "applepay",
		carte: paiement.carte,
		par: paiement.par,
		creeLe: ctx.maintenant()
	};
}
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
/** Les cartes que le foyer connaît, avec leur pot, et le dernier paiement reçu de chacune. */
function cartesDuFoyer(plan, docs) {
	const recus = [...depenses(docs), ...paiementsAClasser(docs)].filter((d) => d.carte);
	return Object.entries(plan.cartes ?? {}).map(([carte, choix]) => ({
		carte,
		choix,
		dernier: recus.filter((d) => cleDeCarte(d.carte) === cleDeCarte(carte)).reduce((m, d) => !m || d.jour > m ? d.jour : m, null)
	})).sort((a, b) => a.carte.localeCompare(b.carte));
}
/**
* La phrase à coller dans « Décrire un raccourci » (l'IA de l'app Raccourcis, iOS 26) : elle crée
* le raccourci « Kora paiement » avec son déclencheur « Lorsque n'importe quelle carte est présentée »,
* l'adresse de cet iPhone déjà dedans.
*/
function demandeRaccourci(adresse) {
	return [
		"Crée un raccourci nommé « Kora paiement » qui se lance tout seul, sans demander, lorsque n'importe quelle carte de Wallet est présentée pour payer (déclencheur Transaction), et reçoit cette transaction en entrée.",
		"Il contient une seule action « Obtenir le contenu de l'URL » :",
		`- URL : ${adresse}`,
		"- Méthode : POST",
		"- Corps de la requête : JSON, avec trois champs de type Texte :",
		"  • montant = le Montant de la transaction (entrée du raccourci)",
		"  • marchand = le Commerçant de la transaction",
		"  • carte = le nom de la Carte de la transaction",
		"Pas d'autre action, pas de notification, ne rien afficher."
	].join("\n");
}
//#endregion
export { POTS_DE_CARTE, cartesDuFoyer, choixDeCarte, classerPaiement, completerPaiement, demandeRaccourci, lireMontantPaye, nomDeCarte, nomDeCommercant, paiementsAClasser, recevoirPaiement, retenirCarte };
