// Généré par `npm run fonction` depuis src/domaine/paiements.ts : ne pas modifier à la main.
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
const depenses = (docs) => docs.filter((d) => d.genre === "depense").sort((a, b) => b.jour.localeCompare(a.jour) || b.creeLe.localeCompare(a.creeLe));
//#endregion
//#region src/domaine/paiements.ts
/** Les pots qu'on peut donner à une carte, dans l'ordre des puces. */
const POTS_DE_CARTE = [
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
const cleDeCarte = (carte) => carte.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();
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
	if (choix && lu.devise === "CHF") return {
		genre: "depense",
		doc: {
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
		},
		message: `${formaterMontant(lu.montant)} noté dans ${POTS[choix].nom.toLowerCase()}.`
	};
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
function classerPaiement(paiement, pot, montantChf, ctx) {
	return {
		id: paiement.id,
		genre: "depense",
		jour: paiement.jour,
		montant: auCentime(Math.max(0, montantChf)),
		pot,
		libelle: paiement.marchand ?? POTS[pot].nom,
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
