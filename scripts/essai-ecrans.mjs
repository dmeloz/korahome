// Essai des écrans dans un iPhone simulé (Chromium de Playwright) : crée un foyer, ouvre chaque
// espace (par la pile de Kora en bas à gauche, ou le rail sur l'iPad), chaque page qu'une carte
// ouvre, et chaque page des Réglages, et signale toute erreur ou page sans titre. À lancer avant
// une version : `npm run build`, puis `node scripts/essai-ecrans.mjs`.
// Les captures vont dans le dossier donné en argument (par défaut un dossier temporaire).
// Depuis 0.0.67, axe-core (le contrôleur d'accessibilité de Deque) passe sur chaque écran : une
// faute « grave » ou « critique » (contraste, bouton sans nom, rôle mal formé) fait échouer l'essai.
// Toute la tournée se refait en mode clair (Réglages › Apparence › Suit l'iPhone), avec la plus
// grande taille de texte de l'iPhone (23 px au lieu de 17), puis sur l'iPhone Duo plié et déplié
// et sur l'iPad couché : rien ne doit déborder.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const AXE = createRequire(import.meta.url).resolve("axe-core/axe.min.js");

// Playwright et son Chromium : ceux du conteneur de Claude s'ils sont là, sinon ceux installés par
// `npx playwright install chromium` (la CI de GitHub, le Mac).
const MODULE_CONTENEUR = "/opt/node22/lib/node_modules/playwright/index.mjs";
const CHROMIUM_CONTENEUR = "/opt/pw-browsers/chromium";
const PLAYWRIGHT = process.env.PLAYWRIGHT_MODULE ?? (existsSync(MODULE_CONTENEUR) ? MODULE_CONTENEUR : "playwright");
const NAVIGATEUR = process.env.PLAYWRIGHT_CHROMIUM ?? (existsSync(CHROMIUM_CONTENEUR) ? CHROMIUM_CONTENEUR : undefined);
const { chromium, devices } = await import(PLAYWRIGHT);
const dossier = process.argv[2] ?? mkdtempSync(join(tmpdir(), "kora-essai-"));
const port = 4300 + Math.floor(Math.random() * 500);

const serveur = spawn("npx", ["vite", "preview", "--port", String(port), "--strictPort"], { stdio: "ignore" });
await new Promise((ok) => setTimeout(ok, 2500));

const erreurs = [];
/** La colonne de l'heure que l'iPhone Duo plié garde à droite (points), 0 ailleurs. */
let colonneDroite = 0;
const navigateur = await chromium.launch({ executablePath: NAVIGATEUR });
try {
  const ctx = await navigateur.newContext({ ...devices["iPhone 14 Pro"], colorScheme: "dark" });
  // Depuis 0.0.96 la pastille Dev et les retours de test sont cachés par défaut : l'essai les allume.
  // Le thème « Suit l'iPhone », pour que la tournée en clair soit vraiment claire.
  await ctx.addInitScript(() => {
    localStorage.setItem("korahome.coinDev", "visible");
    localStorage.setItem("korahome.theme", "auto");
  });
  const p = await ctx.newPage();
  await p.clock.install({ time: new Date("2026-10-20T09:15:00+02:00") });
  p.on("pageerror", (e) => erreurs.push(`Erreur JavaScript : ${e.message}`));
  await p.goto(`http://localhost:${port}/`);
  await p.waitForTimeout(800);
  await p.addScriptTag({ path: AXE });
  await p.getByText(/Créer|créer/).first().click().catch(() => {});
  await p.waitForTimeout(300);
  await p.getByPlaceholder("Chez nous").fill("Essai");
  await p.getByPlaceholder("Melo").fill("Melo");
  await p.getByPlaceholder("Prénom").fill("Sarah");
  await p.getByText("Créer notre foyer").click();
  await p.waitForTimeout(1500);
  // Le guide de première ouverture (0.1.1) : chaque page passe sous axe, puis « Commencer ».
  for (let i = 1; ; i++) {
    await p.waitForTimeout(600);
    // La page glisse en ressort : axe ne regarde qu'une fois qu'elle est arrivée (opacité pleine).
    await p.waitForFunction(() => { const el = document.querySelector(".guide-page"); return el && getComputedStyle(el).opacity === "1" && document.querySelectorAll(".guide-page").length === 1; }, null, { timeout: 5000 }).catch(() => {});
    const titre = await p.locator(".guide h1").textContent({ timeout: 3000 }).catch(() => null);
    if (!titre) erreurs.push(`Guide, page ${i} : pas de titre`);
    await p.screenshot({ path: join(dossier, `guide-${i}.png`) });
    const resultat = await p.evaluate(() => window.axe.run(document.querySelector(".guide"), { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] }, resultTypes: ["violations"] })).catch((e) => ({ violations: [{ id: "axe", impact: "critical", help: e.message, nodes: [] }] }));
    const graves = resultat.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    for (const v of graves) erreurs.push(`Guide, page ${i} : ${v.help} (${v.id}, ${v.nodes.length}×)`);
    console.log(`${titre && !graves.length ? "ok " : "?? "} Guide, page ${i}${titre ? ` → ${titre}` : ""}`);
    const commencer = p.locator(".guide").getByText("Commencer");
    if (await commencer.count()) {
      await commencer.click();
      break;
    }
    await p.locator(".guide").getByText("Suivant").click();
  }
  await p.waitForTimeout(800);

  let theme = "";
  const capture = (nom) => p.screenshot({ path: join(dossier, `${nom}${theme}.png`) });
  const verifier = async (nom) => {
    await p.waitForTimeout(700);
    const titre = await p.locator(".page-dessus h1").first().textContent({ timeout: 3000 }).catch(() => null);
    if (!titre) erreurs.push(`« ${nom} »${theme} : pas de titre`);
    await capture(nom.replace(/\W+/g, "-"));
    const fautes = (await accessibilite(nom)) + (await debordement(nom));
    console.log(`${titre && !fautes ? "ok " : "?? "} ${nom}${theme}${titre ? ` → ${titre}` : ""}${fautes ? ` · ${fautes} faute${fautes > 1 ? "s" : ""}` : ""}`);
  };
  /** axe sur la page du dessus : WCAG A et AA, fautes graves et critiques seulement. Rend leur nombre. */
  const accessibilite = async (nom) => {
    const resultat = await p
      .evaluate(() =>
        window.axe.run(document.querySelector(".page-dessus") ?? document.body, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
          resultTypes: ["violations"],
        }),
      )
      .catch((e) => ({ violations: [{ id: "axe", impact: "critical", help: `axe n'a pas tourné : ${e.message}`, nodes: [] }] }));
    const graves = resultat.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    for (const v of graves) {
      const cible = v.nodes[0]?.target?.join(" ") ?? "";
      console.log(`   ${v.help} (${v.id}) — ${cible}`);
      erreurs.push(`« ${nom} »${theme} : ${v.help} (${v.id}, ${v.nodes.length}×)${cible ? ` — ${cible}` : ""}`);
    }
    return graves.length;
  };
  /** Ce qui dépasse de l'écran en largeur (texte trop grand, ligne trop longue). Rend 0 ou 1. */
  const debordement = async (nom) => {
    const hors = await p.evaluate((colonne) => {
      const w = innerWidth;
      const vus = new Set();
      // Une rangée qui défile de côté (catégories du Budget, filtres) cache ce qui dépasse : pas une faute.
      const defile = (el) => {
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) if (/auto|scroll/.test(getComputedStyle(a).overflowX)) return true;
        return false;
      };
      for (const el of document.querySelectorAll(".page-dessus *")) {
        const r = el.getBoundingClientRect();
        if (r.width && (r.right > w + 1 || r.left < -1) && !defile(el)) vus.add(`${el.tagName.toLowerCase()}${[...el.classList].map((c) => `.${c}`).join("")}`);
      }
      // L'iPhone Duo plié : rien qu'on touche sous la colonne de l'heure, à droite.
      if (colonne) {
        for (const el of document.querySelectorAll("button, a, input, textarea, select, [role=button], .orbe, .pastille-dev")) {
          const r = el.getBoundingClientRect();
          if (r.width && r.height && r.right > w - colonne + 1 && getComputedStyle(el).visibility !== "hidden" && !defile(el)) vus.add(`${el.tagName.toLowerCase()}${[...el.classList].map((c) => `.${c}`).join("")} sous la colonne`);
        }
      }
      return [...vus].slice(0, 4);
    }, colonneDroite);
    if (hors.length) {
      console.log(`   dépasse : ${hors.join(", ")}`);
      erreurs.push(`« ${nom} »${theme} : dépasse de l'écran — ${hors.join(", ")}`);
    }
    return hors.length ? 1 : 0;
  };
  const revenir = async () => {
    await p.locator(".page-dessus .retour").click();
    await p.waitForTimeout(500);
  };
  /** Un espace, par la pile de Kora (iPhone) ou le rail (iPad, Duo ouvert). */
  const allerEspace = async (espace) => {
    const kora = p.locator(".pile-kora .kora");
    if (await kora.isVisible()) {
      await kora.click();
      await p.waitForTimeout(300);
      await p.locator(".pile-kora .item").filter({ hasText: espace }).first().click();
    } else {
      await p.locator(`.rail button[aria-label="${espace}"]`).click();
    }
    await p.waitForTimeout(700);
  };
  /** Une page d'un espace, par sa carte : toute la carte, ou son bouton « Tout voir ». */
  const ouvrirCarte = async (carte) => {
    const tuile = p.locator(".page-dessus .tuile").filter({ has: p.locator(`[aria-label^="${carte}"], .etiq:has-text("${carte}")`) }).or(p.locator(`.page-dessus .tuile[aria-label^="${carte}"]`)).first();
    const toutVoir = tuile.getByText(/^Tout voir/);
    if (await toutVoir.count()) await toutVoir.first().click();
    else await tuile.click();
    await p.waitForTimeout(700);
  };

  /**
   * Les tuiles qui ouvrent une page sur l'une de ses cartes (0.1.2) : la carte doit être dans le
   * haut de l'écran, ou tout entière à l'écran quand elle finit la page.
   */
  const ANCRES = { Carnet: "carnet", "Où est quoi": "rangements" };
  const arriveSur = async (nom, ancre) => {
    const place = await p.evaluate((id) => {
      const el = document.querySelector(`.page-dessus #ancre-${id}`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { haut: r.top / innerHeight, bas: r.bottom / innerHeight };
    }, ancre);
    const bien = place && place.haut >= 0 && (place.haut <= 0.5 || place.bas <= 1);
    if (!bien) erreurs.push(`« ${nom} »${theme} : la page ne s'ouvre pas sur sa carte (${place ? `à ${Math.round(place.haut * 100)} % de l'écran` : "carte absente"})`);
  };

  /**
   * Un budget comme celui du foyer (depuis 0.1.3) : un plan, le mois confirmé, des dépenses à soi
   * (dont Apple Pay), et deux paiements à classer, l'un en euros. Écrit dans IndexedDB, puis Kora
   * se recharge.
   */
  let budgetRempli = false;
  const remplirBudget = async () => {
    await p.evaluate(async () => {
      const base = await new Promise((ok, ko) => { const r = indexedDB.open("korahome"); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
      const foyer = await new Promise((ok) => { const r = base.transaction("foyer").objectStore("foyer").getAll(); r.onsuccess = () => ok(r.result[0]); });
      const [melo, sarah] = foyer.membres;
      const cree = "2026-09-26T08:00:00.000Z";
      const poste = (id, libelle, montant, extra = {}) => ({ id, libelle, montant, frequence: "mois", qui: null, pot: "factures", categorie: "logement", jour: null, mois: null, prelevement: false, ...extra });
      const depense = (id, jour, montant, pot, libelle, extra = {}) => ({ id, genre: "depense", jour, montant, pot, libelle, magasin: null, posteId: null, echeance: null, source: "main", par: melo.id, creeLe: cree, ...extra });
      const docs = [
        {
          id: "plan", genre: "plan", partPlaisir: 0.3, jourDePaie: 25, projet: null, majLe: cree,
          personnes: [{ membreId: melo.id, revenu: 5200, versement: 2100 }, { membreId: sarah.id, revenu: 4300, versement: 1700 }],
          postes: [
            poste("essai-b1", "Loyer", 1850, { jour: 1, prelevement: true }),
            poste("essai-b2", "Assurance maladie", 420, { categorie: "sante", jour: 28 }),
            poste("essai-b3", "Sunrise", 59, { categorie: "abonnement", jour: 22 }),
            poste("essai-b4", "Serafe", 335, { frequence: "an", categorie: "abonnement", mois: 12 }),
            poste("essai-b5", "Téléphone de Melo", 35, { qui: melo.id, pot: null, categorie: "abonnement", jour: 5 }),
          ],
          comptes: { courses: "Carte courses" }, cartes: { "Carte courses": "courses", "UBS Visa": "perso" },
          depart: { mois: "2026-10", soldes: { epargne: 4200 } },
        },
        { id: "mois-2026-10", genre: "mois", mois: "2026-10", versements: { courses: 900, plaisir: 300, factures: 2300, epargne: 300 }, confirmeLe: cree, par: melo.id },
        depense("essai-d1", "2026-09-28", 86.4, "courses", "Courses", { magasin: "Migros", source: "applepay", carte: "Carte courses" }),
        depense("essai-d2", "2026-10-06", 124.9, "courses", "Courses", { magasin: "Coop", par: sarah.id }),
        depense("essai-d3", "2026-10-12", 6.8, "perso", "Café", { source: "applepay", carte: "UBS Visa" }),
        depense("essai-d4", "2026-10-16", 42, "perso", "Essence", { source: "jarvis" }),
        depense("essai-d5", "2026-10-18", 68, "plaisir", "Pizzeria", { par: sarah.id }),
        { id: "essai-a1", genre: "paiement", jour: "2026-10-19", montant: 23.9, devise: "CHF", marchand: "Manor", carte: "Revolut", par: melo.id, creeLe: cree },
        { id: "essai-a2", genre: "paiement", jour: "2026-10-20", montant: 9.5, devise: "EUR", marchand: "Amazon.fr", carte: "Revolut", par: melo.id, creeLe: cree },
      ];
      const tx = base.transaction("budget", "readwrite");
      for (const d of docs) tx.objectStore("budget").put(d);
      await new Promise((ok) => (tx.oncomplete = ok));
      base.close();
    });
    await p.reload();
    await p.waitForTimeout(1500);
    // Au rechargement, Tael vole jusqu'à sa carte : axe attend que les mouvements finis soient finis.
    await p.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getComputedTiming().iterations === Infinity), null, { timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(400);
    await p.addScriptTag({ path: AXE });
    budgetRempli = true;
  };

  /**
   * Le langage des gestes (0.1.5) : la fée ajoute un article et la carte Courses respire avec son
   * trait ; dans Cuisine, cocher ce seul article fait respirer la ligne puis dessine le sceau.
   */
  const gestes = async () => {
    const attendu = async (quoi, selecteur) => {
      const vu = await p.waitForSelector(selecteur, { state: "attached", timeout: 2500 }).then(() => true, () => false);
      if (!vu) erreurs.push(`Gestes : ${quoi} (${selecteur} jamais vu)`);
      console.log(`${vu ? "ok " : "?? "} Gestes : ${quoi}`);
    };
    await p.locator(".page-dessus .orbe").first().click();
    await p.waitForTimeout(400);
    await p.locator(".barre-jarvis input").fill("lait");
    await p.locator(".barre-jarvis input").press("Enter");
    await attendu("la carte Courses respire après un ajout", '.page-dessus [data-widget="courses"].respire-fait');
    await p.waitForTimeout(1200);
    await allerEspace("Cuisine");
    await p.locator(".page-dessus .courses-c .li").first().click();
    await attendu("la ligne cochée respire", ".page-dessus .courses-c .li.respire");
    await attendu("le sceau se dessine au dernier article", ".sceau");
    await p.waitForTimeout(1600);
    await allerEspace("Aujourd'hui");
  };
  const tournee = async () => {
    await capture("aujourdhui");
    const fautesAccueil = (await accessibilite("Aujourd'hui")) + (await debordement("Aujourd'hui"));
    console.log(`${fautesAccueil ? "?? " : "ok "} Aujourd'hui${theme}${fautesAccueil ? ` · ${fautesAccueil} faute${fautesAccueil > 1 ? "s" : ""}` : ""}`);
    // Les quatre espaces (Kora 0.1) : leur page de cartes, puis chaque page qu'une carte ouvre.
    const ESPACES = {
      Cuisine: ["Courses", "Cette semaine", "Nos recettes", "Frigo", "Autres listes"],
      Maison: ["Entretien", "Balcon", "Mitsu", "Vêtements", "Carnet", "Où est quoi"],
      Organisation: ["Tâches", "Agenda", "Administratif"],
      // Sans plan (premier tour), le Budget n'a qu'une carte : celle qui le commence. Ensuite il est
      // rempli (`remplirBudget`) : chaque carte ouvre son onglet, avec deux paiements à classer.
      Budget: budgetRempli ? ["À toi ce mois", "À classer", "Prochaine facture", "Épargne"] : ["Commencer le budget"],
    };
    for (const [espace, cartes] of Object.entries(ESPACES)) {
      await allerEspace(espace);
      await verifier(espace);
      for (const carte of cartes) {
        await ouvrirCarte(carte);
        await verifier(`${espace} › ${carte}`);
        if (ANCRES[carte]) await arriveSur(`${espace} › ${carte}`, ANCRES[carte]);
        await revenir();
      }
    }
    // Le fil du foyer (0.0.65), depuis sa carte d'Aujourd'hui.
    await allerEspace("Aujourd'hui");
    await ouvrirCarte("Chez nous");
    await verifier("Chez nous");
    await revenir();
    await allerEspace("Réglages");
    await verifier("Réglages");
    for (const ligne of ["Apparence", "Nos mots", "Partage", "Sauvegarde", "Corbeille", "Notifications", "Calendrier de l'iPhone", "Siri", /^Ce que \w+ sait/, "Retours de test"]) {
      await p.locator(".page-dessus").getByText(ligne).first().click();
      await verifier(typeof ligne === "string" ? ligne : "Ce que Tael sait");
      await revenir();
    }
    await allerEspace("Aujourd'hui");
  };
  await tournee();
  await gestes();
  await remplirBudget();
  // La même tournée en mode clair : le laiton y est plus sombre, son contraste se vérifie à part.
  theme = "-clair";
  await p.emulateMedia({ colorScheme: "light" });
  await tournee();
  // Puis en grandes lettres (Réglages › Luminosité et affichage, dernier cran hors accessibilité).
  theme = "-grand";
  await p.emulateMedia({ colorScheme: "dark" });
  await p.addStyleTag({ content: "html { font-size: 23px !important; }" });
  await tournee();
  // L'iPhone Duo (pliable, sorti le 23 octobre 2026), en app de l'écran d'accueil : l'écran du
  // dehors (466 × 678 points, dont une colonne de 84 à droite pour l'heure et l'île dynamique,
  // simulée par --bord-droit), puis l'écran du dedans, presque carré (669 × 951, le rail),
  // puis l'iPad couché (1180 × 820, le rail avec les noms, six colonnes).
  await p.addStyleTag({ content: "html { font-size: 17px !important; }" });
  const colonne = await p.addStyleTag({ content: ":root { --bord-droit: 84px !important; }" });
  for (const [nom, largeur, hauteur, bord] of [["plie", 466, 678, 84], ["deplie", 669, 951, 0], ["ipad", 1180, 820, 0]]) {
    theme = `-${nom}`;
    colonneDroite = bord;
    if (!bord) await colonne.evaluate((el) => el.remove());
    await p.setViewportSize({ width: largeur, height: hauteur });
    await tournee();
  }
} finally {
  await navigateur.close();
  serveur.kill();
}
console.log(`Captures : ${dossier}`);
if (erreurs.length) {
  console.log(erreurs.join("\n"));
  process.exit(1);
}
