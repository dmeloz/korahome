// Généré par `npm run fonction` depuis src/domaine/icloud.ts : ne pas modifier à la main.
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
//#endregion
//#region src/domaine/texte.ts
/** « Pâtes fraîches » → « Pates fraiches » : la casse est gardée, seuls les accents partent. */
const sansAccents = (t) => t.normalize("NFD").replace(/\p{M}/gu, "");
/** 7 → « 07 ». */
const deuxChiffres = (n) => String(n).padStart(2, "0");
//#endregion
//#region src/domaine/rayons.ts
function normaliser(texte) {
	return sansAccents(texte.toLowerCase()).replace(/œ/g, "oe").trim();
}
//#endregion
//#region src/domaine/agenda.ts
const idCompteIcloud = (membre) => `icloud-compte-${membre}`;
const estEvenement = (d) => "titre" in d && "jour" in d && !d.aRetirer;
/** Les événements iCloud retirés dans Kora, que le serveur doit encore effacer d'iCloud. */
const aRetirerDe = (docs) => docs.filter((d) => "titre" in d && !!d.aRetirer);
const evenementsDe = (docs) => docs.filter(estEvenement);
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
const MOTS_CATEGORIES = [
	["anniversaire", /\banniv/],
	["vacances", /\b(vacances?|conges?|week-?end a|voyage|sejour)\b/],
	["travail", /\b(travail|boulot|bureau|horaire|service|garde|equipe|shift|reunion)\b/],
	["rdv", /\b(rdv|rendez-?vous|medecin|docteur|dentiste|veto|veterinaire|ophtalmo|gyneco|kine|physio|osteo|pediatre|coiffeur|hopital|controle|vaccin|banque|garage|notaire)\b/],
	["sortie", /\b(resto|restaurant|cinema|cine|concert|theatre|expo|musee|apero|soiree|diner chez|brunch|fete|match|spectacle|balade|sortie|festival|mariage|bapteme)\b/]
];
/** La catégorie d'après les mots : « dentiste » est un rendez-vous, « apéro » une sortie. */
function devinerCategorie(texte) {
	const cle = normaliser(texte);
	return MOTS_CATEGORIES.find(([, re]) => re.test(cle))?.[0] ?? "autre";
}
//#endregion
//#region src/domaine/icloud.ts
const FUSEAU = "Europe/Zurich";
const NOM_CALENDRIER_KORA = "Kora";
/** La couleur du calendrier « Kora » dans l'app Calendrier : le laiton de l'app. */
const COULEUR_KORA = "#D3A14AFF";
/** Les agendas iCloud sont lus de 30 jours en arrière à un an en avant. */
const JOURS_PASSES = 30;
const JOURS_A_VENIR = 366;
/** Une empreinte courte et stable d'un texte (FNV-1a, deux passes) : pour comparer et nommer. */
function empreinte(texte) {
	let a = 2166136261;
	let b = 16777619;
	for (let i = 0; i < texte.length; i++) {
		const c = texte.charCodeAt(i);
		a = Math.imul(a ^ c, 16777619) >>> 0;
		b = Math.imul(b ^ c, 1540483477) >>> 0;
	}
	return a.toString(36) + b.toString(36);
}
/** Le décalage d'un fuseau à un instant, en minutes (Zurich en été : +120). */
function decalage(instant, fuseau) {
	const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
		timeZone: fuseau,
		hourCycle: "h23",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit"
	}).formatToParts(new Date(instant)).map((x) => [x.type, x.value]));
	const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute));
	return Math.round((local - instant) / 6e4);
}
/** Une date et une heure d'un fuseau (ou UTC), ramenées à l'heure de Zurich. */
function versZurich(jour, heure, fuseau) {
	const [a, m, d] = jour.split("-").map(Number);
	const [h, mn] = heure.split(":").map(Number);
	const naif = Date.UTC(a, m - 1, d, h, mn);
	let instant = naif;
	if (fuseau !== "UTC") try {
		instant = naif - decalage(naif, fuseau) * 6e4;
		instant = naif - decalage(instant, fuseau) * 6e4;
	} catch {
		return {
			jour,
			heure
		};
	}
	const local = new Date(instant + decalage(instant, FUSEAU) * 6e4);
	return {
		jour: `${local.getUTCFullYear()}-${deuxChiffres(local.getUTCMonth() + 1)}-${deuxChiffres(local.getUTCDate())}`,
		heure: `${deuxChiffres(local.getUTCHours())}:${deuxChiffres(local.getUTCMinutes())}`
	};
}
/** L'heure d'été suisse, comme l'attend l'app Calendrier. */
const VTIMEZONE = [
	"BEGIN:VTIMEZONE",
	`TZID:${FUSEAU}`,
	"BEGIN:DAYLIGHT",
	"TZOFFSETFROM:+0100",
	"TZOFFSETTO:+0200",
	"TZNAME:CEST",
	"DTSTART:19700329T020000",
	"RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
	"END:DAYLIGHT",
	"BEGIN:STANDARD",
	"TZOFFSETFROM:+0200",
	"TZOFFSETTO:+0100",
	"TZNAME:CET",
	"DTSTART:19701025T030000",
	"RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
	"END:STANDARD",
	"END:VTIMEZONE"
];
const echapper = (t) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const dateIcs = (j) => j.replace(/-/g, "");
const heureIcs = (h) => `${h.replace(":", "")}00`;
/** Une ligne de plus de 75 octets se replie (RFC 5545, 3.1), sans couper un caractère en deux. */
function plier(ligne) {
	const morceaux = [];
	let courant = "";
	let octets = 0;
	for (const c of ligne) {
		const n = new TextEncoder().encode(c).length;
		if (octets + n > (morceaux.length ? 74 : 75)) {
			morceaux.push(courant);
			courant = "";
			octets = 0;
		}
		courant += c;
		octets += n;
	}
	morceaux.push(courant);
	return morceaux.join("\r\n ");
}
const REGLES = {
	jour: "DAILY",
	semaine: "WEEKLY",
	mois: "MONTHLY",
	annee: "YEARLY"
};
const JOURS_ICS = [
	"SU",
	"MO",
	"TU",
	"WE",
	"TH",
	"FR",
	"SA"
];
/** L'identifiant de l'événement dans iCloud : le sien quand il vient de l'iPhone. */
const uidDe = (e) => e.uid ?? `${e.id}@korahome`;
/**
* Un événement seul, comme iCloud le range (un fichier par événement). `prefixe` : le prénom
* devant le titre pour ce qui concerne l'autre personne (« Sarah · Dentiste »).
*/
function icsEvenement(e, prefixe, maintenant) {
	const tampon = `${maintenant.replace(/[-:]/g, "").slice(0, 15)}Z`;
	const lignes = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//KoraHome//Agenda commun//FR",
		"CALSCALE:GREGORIAN"
	];
	if (e.heure) lignes.push(...VTIMEZONE);
	lignes.push("BEGIN:VEVENT", `UID:${uidDe(e)}`, `DTSTAMP:${tampon}`, `SUMMARY:${echapper(prefixe ? `${prefixe} · ${e.titre}` : e.titre)}`);
	const dernier = e.fin ?? e.jour;
	if (e.heure) {
		lignes.push(`DTSTART;TZID=${FUSEAU}:${dateIcs(e.jour)}T${heureIcs(e.heure)}`);
		if (e.heureFin) lignes.push(`DTEND;TZID=${FUSEAU}:${dateIcs(dernier)}T${heureIcs(e.heureFin)}`);
		else if (e.fin) lignes.push(`DTEND;TZID=${FUSEAU}:${dateIcs(decaler(e.fin, {
			unite: "jour",
			tous: 1
		}))}T000000`);
		else lignes.push("DURATION:PT1H");
	} else lignes.push(`DTSTART;VALUE=DATE:${dateIcs(e.jour)}`, `DTEND;VALUE=DATE:${dateIcs(decaler(dernier, {
		unite: "jour",
		tous: 1
	}))}`, "TRANSP:TRANSPARENT");
	if (e.repetition !== "aucune") {
		const regle = [`FREQ=${REGLES[e.repetition]}`];
		if ((e.intervalle ?? 1) > 1) regle.push(`INTERVAL=${e.intervalle}`);
		if (e.repetition === "semaine" && e.joursSemaine?.length) regle.push(`BYDAY=${e.joursSemaine.map((j) => JOURS_ICS[j]).join(",")}`);
		if (e.jusquau) regle.push(`UNTIL=${dateIcs(e.jusquau)}${e.heure ? "T235959Z" : ""}`);
		lignes.push(`RRULE:${regle.join(";")}`);
		if (e.sauf?.length) lignes.push(e.heure ? `EXDATE;TZID=${FUSEAU}:${e.sauf.map((j) => `${dateIcs(j)}T${heureIcs(e.heure)}`).join(",")}` : `EXDATE;VALUE=DATE:${e.sauf.map(dateIcs).join(",")}`);
	}
	if (e.lieu) lignes.push(`LOCATION:${echapper(e.lieu)}`);
	if (e.note) lignes.push(`DESCRIPTION:${echapper(e.note)}`);
	lignes.push("END:VEVENT", "END:VCALENDAR");
	return lignes.map(plier).join("\r\n") + "\r\n";
}
const desechapper = (t) => t.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
function lireLigne(ligne) {
	let i = 0;
	let guillemets = false;
	for (; i < ligne.length; i++) if (ligne[i] === "\"") guillemets = !guillemets;
	else if (ligne[i] === ":" && !guillemets) break;
	if (i >= ligne.length) return null;
	const [nom, ...params] = ligne.slice(0, i).split(";");
	return {
		nom: nom.toUpperCase(),
		params: Object.fromEntries(params.map((p) => [p.split("=")[0].toUpperCase(), p.slice(p.indexOf("=") + 1).replace(/^"|"$/g, "")])),
		valeur: ligne.slice(i + 1)
	};
}
/** Une date iCalendar : « 20261023 », « 20261023T143000 », « 20261023T123000Z », ramenée à Zurich. */
function lireDate(p) {
	const m = p.valeur.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})\d{0,2}(Z)?)?$/);
	if (!m) return null;
	const jour = `${m[1]}-${m[2]}-${m[3]}`;
	if (!m[4] || p.params.VALUE === "DATE") return {
		jour,
		heure: null
	};
	const heure = `${m[4]}:${m[5]}`;
	if (m[6]) return versZurich(jour, heure, "UTC");
	if (p.params.TZID && p.params.TZID !== "Europe/Zurich") return versZurich(jour, heure, p.params.TZID.replace(/^\//, ""));
	return {
		jour,
		heure
	};
}
const FREQUENCES = {
	DAILY: "jour",
	WEEKLY: "semaine",
	MONTHLY: "mois",
	YEARLY: "annee"
};
/** Les événements d'un fichier iCalendar ; les exceptions d'une série et les annulés sont laissés de côté. */
function lireIcs(texte) {
	const lignes = texte.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
	const lus = [];
	let props = null;
	let profondeur = 0;
	for (const brute of lignes) {
		const ligne = brute.trimEnd();
		if (/^BEGIN:VEVENT$/i.test(ligne)) {
			props = [];
			profondeur = 0;
			continue;
		}
		if (!props) continue;
		if (/^BEGIN:/i.test(ligne)) profondeur++;
		else if (/^END:VEVENT$/i.test(ligne)) {
			const lu = versEvenementLu(props);
			if (lu) lus.push(lu);
			props = null;
		} else if (/^END:/i.test(ligne)) profondeur--;
		else if (profondeur === 0) {
			const p = lireLigne(ligne);
			if (p) props.push(p);
		}
	}
	return lus;
}
function versEvenementLu(props) {
	const une = (nom) => props.find((p) => p.nom === nom);
	if (une("RECURRENCE-ID") || une("STATUS")?.valeur.toUpperCase() === "CANCELLED") return null;
	const uid = une("UID")?.valeur.trim();
	const debutP = une("DTSTART");
	const debut = debutP && lireDate(debutP);
	if (!uid || !debut) return null;
	let fin = null;
	let heureFin = null;
	const finP = une("DTEND");
	const finLue = finP && lireDate(finP);
	if (finLue) {
		if (!debut.heure) {
			const dernier = decaler(finLue.jour, {
				unite: "jour",
				tous: -1
			});
			fin = dernier > debut.jour ? dernier : null;
		} else if (finLue.heure) {
			if (finLue.jour > debut.jour && !(finLue.heure === "00:00" && decaler(debut.jour, {
				unite: "jour",
				tous: 1
			}) === finLue.jour)) fin = finLue.jour;
			heureFin = finLue.heure === "00:00" && !fin ? null : finLue.heure;
		}
	} else if (debut.heure) {
		const duree = une("DURATION")?.valeur.match(/^P(?:T(?:(\d+)H)?(?:(\d+)M)?)$/);
		if (duree && (duree[1] || duree[2])) {
			const minutes = Number(debut.heure.slice(0, 2)) * 60 + Number(debut.heure.slice(3)) + Number(duree[1] ?? 0) * 60 + Number(duree[2] ?? 0);
			if (minutes < 1440) heureFin = `${deuxChiffres(Math.floor(minutes / 60))}:${deuxChiffres(minutes % 60)}`;
		}
	}
	const lu = {
		uid,
		titre: desechapper(une("SUMMARY")?.valeur ?? "").trim() || "Sans titre",
		jour: debut.jour,
		fin,
		heure: debut.heure,
		heureFin: heureFin && heureFin !== debut.heure ? heureFin : null,
		repetition: "aucune",
		lieu: desechapper(une("LOCATION")?.valeur ?? "").trim() || null,
		note: desechapper(une("DESCRIPTION")?.valeur ?? "").trim().slice(0, 500) || null,
		modifie: null
	};
	const modif = une("LAST-MODIFIED")?.valeur.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
	if (modif) lu.modifie = `${modif[1]}-${modif[2]}-${modif[3]}T${modif[4]}:${modif[5]}:${modif[6]}.000Z`;
	const regle = une("RRULE");
	if (regle) {
		const r = Object.fromEntries(regle.valeur.split(";").map((x) => [x.split("=")[0].toUpperCase(), x.split("=")[1] ?? ""]));
		const repetition = FREQUENCES[r.FREQ?.toUpperCase()];
		if (repetition) {
			lu.repetition = repetition;
			const intervalle = Number(r.INTERVAL);
			if (intervalle > 1) lu.intervalle = intervalle;
			if (repetition === "semaine" && r.BYDAY) {
				const jours = r.BYDAY.split(",").map((j) => JOURS_ICS.indexOf(j.slice(-2).toUpperCase())).filter((j) => j >= 0);
				if (jours.length) lu.joursSemaine = [...new Set(jours)].sort();
			}
			const jusqua = r.UNTIL?.match(/^(\d{4})(\d{2})(\d{2})/);
			if (jusqua) lu.jusquau = `${jusqua[1]}-${jusqua[2]}-${jusqua[3]}`;
			else if (Number(r.COUNT) > 0) {
				const n = Number(r.COUNT) - 1;
				const pas = lu.intervalle ?? 1;
				const parSemaine = lu.joursSemaine?.length ?? 1;
				lu.jusquau = repetition === "jour" ? decaler(lu.jour, {
					unite: "jour",
					tous: n * pas
				}) : repetition === "semaine" ? decaler(lu.jour, {
					unite: "jour",
					tous: Math.ceil((n + 1) / parSemaine) * 7 * pas
				}) : decaler(lu.jour, {
					unite: "mois",
					tous: n * pas * (repetition === "annee" ? 12 : 1)
				});
			}
			const sauf = props.filter((p) => p.nom === "EXDATE").flatMap((p) => p.valeur.split(",").map((v) => lireDate({
				...p,
				valeur: v
			})?.jour)).filter((j) => !!j);
			if (sauf.length) lu.sauf = sauf;
		}
	}
	return lu;
}
const XML = "<?xml version=\"1.0\" encoding=\"utf-8\"?>";
const CORPS_PRINCIPAL = `${XML}<d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>`;
const CORPS_MAISON = `${XML}<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>`;
const CORPS_CALENDRIERS = `${XML}<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:displayname/><d:resourcetype/><c:supported-calendar-component-set/></d:prop></d:propfind>`;
/** Les événements d'un calendrier ; avec une période, seulement ceux qui la touchent. */
function corpsEvenements(periode) {
	const plage = periode ? `<c:time-range start="${dateIcs(periode.du)}T000000Z" end="${dateIcs(periode.au)}T235959Z"/>` : "";
	return `${XML}<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT">${plage}</c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`;
}
function corpsCreerCalendrier(nom, couleur) {
	return `${XML}<c:mkcalendar xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:a="http://apple.com/ns/ical/"><d:set><d:prop><d:displayname>${nom}</d:displayname><a:calendar-color>${couleur}</a:calendar-color><c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set></d:prop></d:set></c:mkcalendar>`;
}
const decoderEntites = (t) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16))).replace(/&amp;/g, "&");
/** Le texte d'un morceau de XML : les entités décodées, le contenu des CDATA laissé tel quel. */
const decoderXml = (t) => t.split(/(<!\[CDATA\[[\s\S]*?\]\]>)/).map((morceau) => morceau.startsWith("<![CDATA[") ? morceau.slice(9, -3) : decoderEntites(morceau)).join("");
/** Le contenu texte d'une balise (le premier href, le displayname…). */
function texteDe(xml, balise) {
	const m = xml.match(new RegExp(`<(?:[\\w-]+:)?${balise}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${balise}>`));
	return m ? decoderXml(m[1].trim()) : null;
}
/** Lit une réponse « 207 Multi-Status » sans dépendre d'un lecteur XML (le serveur n'en a pas). */
function lireMultistatus(xml) {
	const reponses = [];
	for (const [, bloc] of xml.matchAll(/<(?:[\w-]+:)?response\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?response>/g)) {
		const href = texteDe(bloc, "href");
		if (!href) continue;
		const props = {};
		for (const [, propstat] of bloc.matchAll(/<(?:[\w-]+:)?propstat\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?propstat>/g)) {
			const statut = texteDe(propstat, "status") ?? "";
			if (!/\s2\d\d\s/.test(` ${statut} `)) continue;
			const prop = propstat.match(/<(?:[\w-]+:)?prop\b[^>]*>([\s\S]*)<\/(?:[\w-]+:)?prop>/)?.[1] ?? "";
			for (const [, nom, contenu] of prop.matchAll(/<(?:[\w-]+:)?([\w-]+)\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:[\w-]+:)?\1>)/g)) props[nom] = contenu ?? "";
		}
		reponses.push({
			href,
			props
		});
	}
	return reponses;
}
/** Les calendriers d'événements trouvés dans le dossier des calendriers. */
function lireCalendriers(xml, base) {
	return lireMultistatus(xml).filter((r) => /<(?:[\w-]+:)?calendar\b/.test(r.props.resourcetype ?? "") && /name=["']VEVENT["']/i.test(r.props["supported-calendar-component-set"] || "name=\"VEVENT\"")).map((r) => ({
		url: new URL(r.href, base).href,
		nom: decoderXml(r.props.displayname ?? "").trim() || "Calendrier"
	}));
}
/** Les événements d'un calendrier, avec leur adresse et leur version (etag). */
function lireRessources(xml, base) {
	return lireMultistatus(xml).filter((r) => r.props["calendar-data"]).map((r) => ({
		href: new URL(r.href, base).href,
		etag: r.props.getetag ? decoderXml(r.props.getetag).trim() : null,
		ics: decoderXml(r.props["calendar-data"])
	}));
}
const prefixeImport = (membre) => `icloud-${membre}-`;
const prenomDe = (foyer, id) => id ? foyer?.membres.find((m) => m.id === id)?.prenom ?? null : null;
const sansDtstamp = (ics) => ics.replace(/\r\nDTSTAMP:[^\r]*/, "");
const nomFichier = (id) => `${id.replace(/[^A-Za-z0-9_-]/g, "_")}.ics`;
/** Les champs qu'iCloud décrit ; le reste (pour qui, catégorie, auteur) reste celui de Kora. */
function champsLus(lu) {
	return {
		titre: lu.titre,
		jour: lu.jour,
		fin: lu.fin,
		heure: lu.heure,
		heureFin: lu.heureFin,
		repetition: lu.repetition,
		intervalle: lu.intervalle,
		joursSemaine: lu.joursSemaine,
		jusquau: lu.jusquau ?? null,
		sauf: lu.sauf,
		lieu: lu.lieu,
		note: lu.note
	};
}
/** Retire les champs vides, pour comparer et ranger proprement. */
function nettoyer(e) {
	const copie = { ...e };
	for (const k of [
		"intervalle",
		"joursSemaine",
		"jusquau",
		"sauf",
		"uid",
		"modifieLe",
		"source"
	]) if (copie[k] === void 0 || copie[k] === null || Array.isArray(copie[k]) && !copie[k].length) delete copie[k];
	return copie;
}
const memeContenu = (a, b) => {
	const cle = (e) => JSON.stringify({
		...nettoyer(e),
		modifieLe: null,
		creeLe: null,
		icloud: e.icloud ? [e.icloud.href, e.icloud.etag] : null
	});
	return cle(a) === cle(b);
};
/**
* Compare Kora, ce que Kora avait écrit dans iCloud (liens) et ce qu'iCloud contient
* maintenant, et décide. Ce qui a changé des deux côtés : la modification la plus récente gagne.
* Un événement de Kora effacé sur l'iPhone est retiré de Kora, sauf si presque tout a disparu
* d'un coup (calendrier vidé) : Kora le réécrit alors plutôt que de tout perdre.
*/
function planSynchro(x) {
	const plan = {
		ecrire: [],
		supprimer: [],
		envoyer: [],
		effacer: [],
		liens: [],
		modifierIcloud: [],
		retirerIcloud: []
	};
	const prefixe = prefixeImport(x.membre);
	const parId = new Map(x.evenements.map((e) => [e.id, e]));
	const source = `iCloud de ${prenomDe(x.foyer, x.membre) ?? "?"}`;
	if (x.autres) {
		const vus = /* @__PURE__ */ new Set();
		const retires = new Set((x.aRetirer ?? []).map((e) => e.id));
		for (const r of x.autres) for (const lu of lireIcs(r.ics)) {
			if (lu.uid.endsWith("@korahome")) continue;
			const id = `${prefixe}${empreinte(lu.uid)}`;
			if (vus.has(id)) continue;
			vus.add(id);
			if (retires.has(id)) {
				plan.retirerIcloud.push(r.href);
				plan.supprimer.push(id);
				continue;
			}
			const avant = parId.get(id);
			const lu0 = avant?.icloud;
			const koraAChange = !!lu0 && !!avant?.modifieLe && avant.modifieLe > lu0.importeLe;
			const iphoneAChange = !!lu0 && lu0.etag !== r.etag;
			if (avant && koraAChange && (!iphoneAChange || !lu.modifie || lu.modifie <= avant.modifieLe)) {
				plan.modifierIcloud.push({
					evenement: avant,
					href: r.href,
					etag: r.etag,
					ics: fusionnerIcs(r.ics, {
						...avant,
						uid: lu.uid
					}, x.maintenant)
				});
				continue;
			}
			const e = nettoyer({
				id,
				...champsLus(lu),
				pour: avant?.pour ?? x.membre,
				categorie: avant?.categorie ?? devinerCategorie(lu.titre),
				creePar: x.membre,
				creeLe: avant?.creeLe ?? x.maintenant,
				source,
				icloud: {
					href: r.href,
					etag: r.etag,
					importeLe: x.maintenant
				},
				modifieLe: x.maintenant
			});
			if (!avant || !memeContenu(avant, e)) plan.ecrire.push(e);
		}
		for (const e of x.evenements) if (e.id.startsWith(prefixe) && !vus.has(e.id)) plan.supprimer.push(e.id);
		for (const id of retires) if (id.startsWith(prefixe) && !vus.has(id)) plan.supprimer.push(id);
	}
	const ecrits = new Map(plan.ecrire.map((e) => [e.id, e]));
	const retires = new Set(plan.supprimer);
	const tous = [...[...x.evenements.filter((e) => !retires.has(e.id)).map((e) => ecrits.get(e.id) ?? e), ...plan.ecrire.filter((e) => !parId.has(e.id))], ...evenementsDesAnimaux(x.animaux ?? [])];
	const existe = new Set(tous.map((e) => e.id));
	const ancien = decaler(x.aujourdhui, {
		unite: "jour",
		tous: -30
	});
	const aEcrire = tous.filter((e) => !e.id.startsWith(prefixe) && (e.repetition !== "aucune" || (e.fin ?? e.jour) >= ancien));
	const ressources = new Map(x.kora.map((r) => [r.href, r]));
	const liens = new Map(x.liens.map((l) => [l.evenementId, l]));
	const lies = new Set([...liens.values()].map((l) => l.href));
	for (const r of x.kora) {
		if (lies.has(r.href)) continue;
		const lu = lireIcs(r.ics)[0];
		if (!lu) continue;
		const idKora = lu.uid.endsWith("@korahome") ? lu.uid.slice(0, -9) : null;
		if (idKora) {
			if (existe.has(idKora) && !liens.has(idKora)) liens.set(idKora, {
				evenementId: idKora,
				href: r.href,
				etag: r.etag,
				empreinte: ""
			});
			else plan.effacer.push(r.href);
			continue;
		}
		const id = `ical-${empreinte(lu.uid)}`;
		if (existe.has(id)) {
			if (!liens.has(id)) liens.set(id, {
				evenementId: id,
				href: r.href,
				etag: null,
				empreinte: ""
			});
			continue;
		}
		const nouveau = nettoyer({
			id,
			...champsLus(lu),
			pour: null,
			categorie: devinerCategorie(lu.titre),
			creePar: x.membre,
			creeLe: x.maintenant,
			uid: lu.uid,
			modifieLe: lu.modifie ?? x.maintenant
		});
		plan.ecrire.push(nouveau);
		plan.liens.push({
			evenementId: id,
			href: r.href,
			etag: r.etag,
			empreinte: empreinte(sansDtstamp(icsEvenement(nouveau, null, x.maintenant)))
		});
		liens.delete(id);
	}
	const natifsLies = aEcrire.filter((e) => !e.source && liens.has(e.id));
	const manquants = natifsLies.filter((e) => !ressources.has(liens.get(e.id).href));
	const calendrierVide = manquants.length > 3 && manquants.length > natifsLies.length / 2;
	for (const e of aEcrire) {
		const prefixeTitre = e.pour && e.pour !== x.membre ? prenomDe(x.foyer, e.pour) : null;
		const lien = liens.get(e.id);
		const distant = lien ? ressources.get(lien.href) : void 0;
		if (lien && !distant && !e.source && !calendrierVide) {
			plan.supprimer.push(e.id);
			continue;
		}
		let actuel = e;
		if (lien && distant && !e.source && lien.etag && distant.etag && distant.etag !== lien.etag) {
			const lu = lireIcs(distant.ics)[0];
			const koraAChange = empreinte(sansDtstamp(icsEvenement(e, prefixeTitre, x.maintenant))) !== lien.empreinte;
			if (lu && (!koraAChange || (lu.modifie ?? x.maintenant) >= (e.modifieLe ?? ""))) {
				const titre = prefixeTitre && lu.titre.startsWith(`${prefixeTitre} · `) ? lu.titre.slice(prefixeTitre.length + 3) : lu.titre;
				actuel = nettoyer({
					...e,
					...champsLus(lu),
					titre,
					modifieLe: lu.modifie ?? x.maintenant
				});
				if (!memeContenu(actuel, e)) plan.ecrire.push(actuel);
				const ics = icsEvenement(actuel, prefixeTitre, x.maintenant);
				plan.liens.push({
					evenementId: e.id,
					href: lien.href,
					etag: distant.etag,
					empreinte: empreinte(sansDtstamp(ics))
				});
				continue;
			}
		}
		const ics = icsEvenement(actuel, prefixeTitre, x.maintenant);
		const marque = empreinte(sansDtstamp(ics));
		if (lien && distant && lien.empreinte === marque) {
			plan.liens.push({
				...lien,
				etag: lien.etag ?? distant.etag
			});
			continue;
		}
		plan.envoyer.push({
			evenementId: e.id,
			href: lien?.href ?? new URL(nomFichier(e.id), x.calendrierKora.endsWith("/") ? x.calendrierKora : `${x.calendrierKora}/`).href,
			ics,
			empreinte: marque
		});
	}
	for (const lien of liens.values()) {
		if (existe.has(lien.evenementId) && !plan.supprimer.includes(lien.evenementId)) {
			if (!aEcrire.some((e) => e.id === lien.evenementId)) plan.liens.push(lien);
			continue;
		}
		if (ressources.has(lien.href)) plan.effacer.push(lien.href);
	}
	return plan;
}
const PREVUS = [
	"UID",
	"DTSTAMP",
	"SUMMARY",
	"DTSTART",
	"DTEND",
	"DURATION",
	"LOCATION",
	"DESCRIPTION",
	"RRULE",
	"RDATE",
	"EXDATE",
	"LAST-MODIFIED",
	"SEQUENCE",
	"TRANSP"
];
const nomDe = (ligne) => ligne.split(/[;:]/)[0].toUpperCase();
/**
* Un événement d'iCloud modifié dans Kora, prêt à y retourner : ce que Kora sait écrire (titre,
* dates, répétition, lieu, note) remplace l'ancien ; le reste (alertes, invités, exceptions
* d'une série, couleur…) est gardé tel quel.
*/
function fusionnerIcs(original, e, maintenant) {
	const logiques = (t) => t.replace(/(\r?\n)+$/, "").split(/\r?\n(?![ \t])/);
	const neuf = logiques(icsEvenement(e, null, maintenant));
	const lignes = logiques(original);
	const entete = [];
	const blocs = [];
	let bloc = null;
	let profondeur = 0;
	for (const l of lignes) {
		const nom = nomDe(l);
		if (nom === "BEGIN" && /^BEGIN:VCALENDAR$/i.test(l.trim())) continue;
		if (nom === "END" && /^END:VCALENDAR$/i.test(l.trim())) continue;
		if (bloc) {
			bloc.push(l);
			if (nom === "BEGIN") profondeur++;
			else if (nom === "END" && --profondeur === 0) {
				blocs.push(bloc);
				bloc = null;
			}
		} else if (nom === "BEGIN") {
			bloc = [l];
			profondeur = 1;
		} else entete.push(l);
	}
	const valeur = (b, nom) => {
		const l = b.find((x) => nomDe(x) === nom);
		return l ? l.replace(/\r?\n[ \t]/g, "").slice(l.replace(/\r?\n[ \t]/g, "").indexOf(":") + 1) : null;
	};
	const estEvenement = (b) => /^BEGIN:VEVENT$/i.test(b[0].trim());
	const maitre = blocs.find((b) => estEvenement(b) && valeur(b, "UID") === e.uid && !valeur(b, "RECURRENCE-ID")) ?? blocs.find((b) => estEvenement(b) && !valeur(b, "RECURRENCE-ID"));
	const enPlus = [];
	if (maitre) {
		let p = 0;
		for (const l of maitre.slice(1, -1)) {
			const nom = nomDe(l);
			if (p === 0 && nom !== "BEGIN" && PREVUS.includes(nom)) continue;
			if (p === 0 && nom === "X-APPLE-STRUCTURED-LOCATION" && (e.lieu ?? "") !== (lireIcs([
				"BEGIN:VEVENT",
				...maitre.filter((x) => nomDe(x) === "LOCATION"),
				"END:VEVENT"
			].join("\r\n"))[0]?.lieu ?? "")) continue;
			if (nom === "BEGIN") p++;
			else if (nom === "END") p--;
			enPlus.push(l);
		}
	}
	const sequence = Number(maitre ? valeur(maitre, "SEQUENCE") : 0) || 0;
	const tampon = `${maintenant.replace(/[-:]/g, "").slice(0, 15)}Z`;
	const debut = neuf.findIndex((l) => /^BEGIN:VEVENT$/i.test(l));
	const fin = neuf.findIndex((l) => /^END:VEVENT$/i.test(l));
	const evenement = [
		...neuf.slice(debut, fin),
		`SEQUENCE:${sequence + 1}`,
		`LAST-MODIFIED:${tampon}`,
		...enPlus,
		neuf[fin]
	];
	const fuseauNeuf = neuf.slice(neuf.findIndex((l) => /^BEGIN:VTIMEZONE$/i.test(l)), neuf.findIndex((l) => /^END:VTIMEZONE$/i.test(l)) + 1);
	const aDejaLeFuseau = blocs.some((b) => /^BEGIN:VTIMEZONE$/i.test(b[0].trim()) && valeur(b, "TZID") === "Europe/Zurich");
	return [
		"BEGIN:VCALENDAR",
		...entete.length ? entete : neuf.slice(1, debut).filter((l) => !/^(BEGIN|END):VTIMEZONE$/i.test(l) && !fuseauNeuf.includes(l)),
		...e.heure && !aDejaLeFuseau && fuseauNeuf.length > 1 ? fuseauNeuf : [],
		...blocs.filter((b) => b !== maitre).flat(),
		...evenement,
		"END:VCALENDAR"
	].join("\r\n") + "\r\n";
}
/** « d.z…@icloud.com » : assez pour se reconnaître, pas pour être lu par-dessus l'épaule. */
function masquerAppleId(appleId) {
	const [nom, domaine] = appleId.trim().split("@");
	if (!domaine) return `${appleId.slice(0, 3)}…`;
	return `${nom.slice(0, Math.min(3, Math.max(1, nom.length - 1)))}…@${domaine}`;
}
/** La date du jour à Zurich, pour le serveur. */
function aujourdhuiAZurich(instant) {
	return versZurich(instant.toISOString().slice(0, 10), instant.toISOString().slice(11, 16), "UTC").jour;
}
//#endregion
export { CORPS_CALENDRIERS, CORPS_MAISON, CORPS_PRINCIPAL, COULEUR_KORA, FUSEAU, JOURS_A_VENIR, JOURS_PASSES, NOM_CALENDRIER_KORA, aRetirerDe, aujourdhuiAZurich, corpsCreerCalendrier, corpsEvenements, decaler, empreinte, evenementsDe, fusionnerIcs, icsEvenement, idCompteIcloud, lireCalendriers, lireIcs, lireMultistatus, lireRessources, masquerAppleId, planSynchro, prefixeImport, texteDe, uidDe, versZurich };
