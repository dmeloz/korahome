// Généré par `npm run fonction` depuis src/domaine/jarvisModele.ts : ne pas modifier à la main.
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
/** Le plafond choisi par Melo : 5 CHF par mois pour tout le foyer. */
const PLAFOND_CHF = 5;
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
		name: "attribuer_tache",
		description: "Confie une tâche existante à une personne du foyer, ou la rend libre.",
		strict: true,
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
		strict: true,
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
		name: "noter_journal",
		description: "Note dans le journal d'un animal ce qui s'est passé : litière changée, a vomi, n'a pas mangé, selles molles, boite, se cache ou autre remarque.",
		strict: true,
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
		strict: true,
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
		strict: true,
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
		strict: true,
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
		strict: true,
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
		strict: true,
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
		description: "Retient durablement un fait sur le foyer : un goût, une habitude, une règle de la maison. propose: false quand on te demande de le retenir ; true quand tu l'as remarqué toi-même (l'app demande alors si elle doit le retenir).",
		strict: true,
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
		strict: true,
		input_schema: {
			type: "object",
			additionalProperties: false,
			required: ["fait"],
			properties: { fait: texte("Le fait tel qu'il figure dans ta mémoire.") }
		}
	},
	{
		name: "noter_souhait",
		description: "Quand on te demande une chose que tu ne sais pas faire (aucun outil ne convient, ou l'app n'a pas cette fonction), note-la comme souhait d'amélioration pour Claude, qui fait évoluer l'app.",
		strict: true,
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
Si la demande n'est pas claire, pose une seule question courte.
Si on te demande une chose qu'aucun outil ne permet et que l'état du foyer ne te laisse pas répondre, utilise noter_souhait, et écris : « Je ne sais pas encore le faire, je l'ai noté pour Claude. »
Ta mémoire est dans l'état du foyer : sers-t'en pour chaque demande (goûts, habitudes, règles de la maison). Quand on te dit « retiens que… » ou « n'oublie pas que… », utilise retenir (propose: false). Quand tu remarques une préférence ou une habitude durable qui n'est pas encore dans ta mémoire, propose-la avec retenir (propose: true), au plus une par réponse, jamais une information passagère ni de santé ou d'argent. Quand on te dit qu'un fait de ta mémoire est faux, utilise oublier, et retenir pour le fait juste.
Pour une question sur le foyer, réponds à partir de l'état du foyer fourni ; s'il ne contient pas la réponse, dis-le.
Avec une photo (lettre, facture, carte de rendez-vous, flyer) : relève les rendez-vous, échéances et paiements, et crée pour chacun une tâche unique à sa date, avec l'heure et le lieu dans le titre s'ils sont indiqués.
Avec un ticket de caisse : range au stock (ajouter_au_stock) les produits alimentaires achetés, avec leur quantité dans le nom (« 1 l lait », « 500 g beurre ») et le lieu où on les range d'habitude ; laisse la date de péremption vide si elle n'est pas écrite, l'app la devine. Coche aussi les courses correspondantes (cocher_courses).
Avec une page de carnet de santé ou une facture de vétérinaire : note chaque vaccin, vermifuge, antiparasitaire ou visite avec noter_soin (fait: true à sa date, et fait: false pour la date du prochain rappel écrite), et les poids écrits avec noter_pesee à leur date.
Quand on te dit qu'un animal a vomi, n'a pas mangé, ou que la litière est changée, note-le avec noter_journal ; si une tâche correspond (litière), marque-la aussi faite.
Avec une recette : compare ses ingrédients au stock et à la liste de courses, et n'ajoute aux courses que ce qui manque, avec les quantités de la recette.
Avec une photo de plante : reconnais-la (nom courant en français, le plus précis possible). Si on te demande de l'ajouter, utilise ajouter_plante, et écris quand même une phrase : son nom, puis son besoin principal (soleil, arrosage, gel). Si tu n'es pas sûr, dis-le et donne les deux noms les plus probables.`;
/** Le conseil du dimanche : Jarvis prépare la semaine, le foyer valide ensemble. */
const CONSIGNES_CONSEIL = `Tu es Jarvis, l'assistant d'un foyer en Suisse romande. C'est le conseil de la semaine : le foyer décide ensemble de la semaine qui vient, et tu prépares une proposition qu'il validera ligne par ligne.
Utilise les outils pour proposer :
- de confier chaque tâche des sept prochains jours à une personne (attribuer_tache), en équilibrant la charge et en tenant compte de qui a fait quoi ;
- les courses de la semaine (ajouter_courses) : les ingrédients de cinq repas simples de saison qui utilisent d'abord ce qui arrive à sa date dans le stock, et ce qui manque pour la maison ;
- les tâches qui manquent pour la semaine (ajouter_tache), seulement si l'état du foyer le justifie.
En plus des outils, écris en français, en tutoyant, un court résumé : la répartition proposée, les cinq repas (un par ligne, « Lundi : … »), et ce qui demande de l'attention. Pas plus de dix lignes.`;
const decoder = (t) => t.replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
/** Cherche une recette dans les données structurées (JSON-LD) d'une page : Betty Bossi, Marmiton, Fooby… */
function extraireRecette(html) {
	const blocs = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
	for (const [, contenu] of blocs) {
		let donnees;
		try {
			donnees = JSON.parse(contenu.trim());
		} catch {
			continue;
		}
		const aVisiter = [donnees];
		while (aVisiter.length) {
			const n = aVisiter.shift();
			if (Array.isArray(n)) {
				aVisiter.push(...n);
				continue;
			}
			if (!n || typeof n !== "object") continue;
			const o = n;
			const type = o["@type"];
			if ((type === "Recipe" || Array.isArray(type) && type.includes("Recipe")) && Array.isArray(o.recipeIngredient)) {
				const ingredients = o.recipeIngredient.filter((i) => typeof i === "string").map(decoder).filter(Boolean);
				if (!ingredients.length) continue;
				const rendement = Array.isArray(o.recipeYield) ? o.recipeYield[0] : o.recipeYield;
				return {
					titre: typeof o.name === "string" ? decoder(o.name) : "Recette",
					ingredients,
					portions: typeof rendement === "string" || typeof rendement === "number" ? String(rendement) : null
				};
			}
			if (o["@graph"]) aVisiter.push(o["@graph"]);
		}
	}
	return null;
}
/** Le texte lisible d'une page, sans balises, pour une recette sans données structurées. */
function texteDePage(html, max = 6e3) {
	return decoder(html.replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")).slice(0, max);
}
/** Le premier lien d'une demande (« ajoute les ingrédients de https://… »). */
function lienDans(demande) {
	return demande.match(/https:\/\/[^\s<>"']+/)?.[0] ?? null;
}
/** Ce que le modèle lit d'une recette trouvée derrière un lien. */
function decrireRecette(r) {
	return `Recette « ${r.titre} »${r.portions ? ` (${r.portions})` : ""}, ingrédients :\n${r.ingredients.map((i) => `- ${i}`).join("\n")}`;
}
/** Les derniers échanges, pour que « et du beurre aussi » se comprenne. */
const TOURS_RETENUS = 6;
/** Le message envoyé au modèle : les derniers échanges, l'état du foyer, puis la demande. */
function messageDemande(etat, demande, historique = [], lien) {
	const tours = historique.slice(-6).map((t) => `${t.role === "personne" ? "Personne" : "Jarvis"} : ${t.texte}`);
	const avant = tours.length ? `Échanges précédents :\n${tours.join("\n")}\n\n` : "";
	const page = lien ? `\n\nCe qu'il y a derrière le lien :\n${lien}` : "";
	return `${avant}État du foyer :\n${etat}\n\nDemande : ${demande.trim()}${page}`;
}
/** Ce que Jarvis lit d'une page : la recette si elle est décrite, sinon son texte. */
function lirePage(html) {
	const recette = extraireRecette(html);
	return recette ? decrireRecette(recette) : texteDePage(html);
}
/** Les adresses qu'on accepte d'ouvrir : https, nom de domaine public (ni IP, ni réseau local). */
function lienAutorise(adresse) {
	let url;
	try {
		url = new URL(adresse);
	} catch {
		return false;
	}
	const hote = url.hostname.toLowerCase();
	if (url.protocol !== "https:" || url.port || url.username) return false;
	if (!hote.includes(".") || hote.endsWith(".local") || hote.endsWith(".internal") || hote === "localhost") return false;
	return !/^[\d.]+$/.test(hote) && !hote.includes(":") && !hote.startsWith("[");
}
//#endregion
export { CONSIGNES_CONSEIL, CONSIGNES_JARVIS, MODELE_CONSEIL, MODELE_JARVIS, OUTILS_JARVIS, PLAFOND_CHF, TOURS_RETENUS, coutMicroChf, decrireRecette, etatBudget, extraireRecette, formaterChf, lienAutorise, lienDans, lirePage, messageDemande, moisDe, texteDePage };
