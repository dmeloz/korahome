// Essai des écrans dans un iPhone simulé (Chromium de Playwright) : crée un foyer, ouvre chaque
// espace (tuile de l'accueil puis sélecteur de la barre du haut) et chaque page des Réglages, et signale toute erreur ou page
// sans titre. À lancer avant une version : `npm run build`, puis `node scripts/essai-ecrans.mjs`.
// Les captures vont dans le dossier donné en argument (par défaut un dossier temporaire).
// Depuis 0.0.67, axe-core (le contrôleur d'accessibilité de Deque) passe sur chaque écran : une
// faute « grave » ou « critique » (contraste, bouton sans nom, rôle mal formé) fait échouer l'essai.
// Depuis 0.0.79, il passe aussi sur l'accueil, et toute la tournée se refait en mode clair, puis
// avec la plus grande taille de texte de l'iPhone (23 px au lieu de 17) : rien ne doit déborder.
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
const navigateur = await chromium.launch({ executablePath: NAVIGATEUR });
try {
  const ctx = await navigateur.newContext({ ...devices["iPhone 14 Pro"], colorScheme: "dark" });
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
  for (let k = 0; k < 12 && (await p.locator(".visite").count()); k++) {
    await p.locator(".visite button").last().click({ timeout: 1500 }).catch(() => {});
    await p.waitForTimeout(300);
  }

  let theme = "";
  const capture = (nom) => p.screenshot({ path: join(dossier, `${nom}${theme}.png`) });
  const verifier = async (nom) => {
    await p.waitForTimeout(700);
    const titre = await p.locator(".page-dessus h1").first().textContent({ timeout: 3000 }).catch(() => null);
    if (!titre) erreurs.push(`« ${nom} »${theme} : pas de titre`);
    await capture(nom.replace(/\W+/g, "-"));
    const fautes = (await accessibilite(nom)) + (await debordement(nom));
    console.log(`${titre && !fautes ? "ok " : "?? "} ${nom}${titre ? ` → ${titre}` : ""}${fautes ? ` · ${fautes} faute${fautes > 1 ? "s" : ""} d'accessibilité` : ""}`);
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
      erreurs.push(`« ${nom} »${theme} : ${v.help} (${v.id}, ${v.nodes.length}×)${cible ? ` — ${cible}` : ""}`);
    }
    return graves.length;
  };
  /** Ce qui dépasse de l'écran en largeur (texte trop grand, ligne trop longue). Rend 0 ou 1. */
  const debordement = async (nom) => {
    const hors = await p.evaluate(() => {
      const w = innerWidth;
      const vus = new Set();
      for (const el of document.querySelectorAll(".page-dessus *")) {
        const r = el.getBoundingClientRect();
        if (r.width && (r.right > w + 1 || r.left < -1)) vus.add(`${el.tagName.toLowerCase()}${[...el.classList].map((c) => `.${c}`).join("")}`);
      }
      return [...vus].slice(0, 4);
    });
    if (hors.length) erreurs.push(`« ${nom} »${theme} : dépasse de l'écran — ${hors.join(", ")}`);
    return hors.length ? 1 : 0;
  };
  const revenir = async () => {
    await p.locator(".page-dessus .retour").click();
    await p.waitForTimeout(500);
  };
  // Depuis 0.0.73, plus de « Tous les espaces » : on ouvre Tâches par sa tuile de l'accueil,
  // puis chaque espace par le sélecteur de la barre du haut.
  const allerEspace = async (espace) => {
    if (!(await p.locator(".page-dessus .barre-haut-espaces").count())) {
      await p.locator('.page-dessus .chiffres-accueil [data-widget="taches"]').click();
      await p.waitForTimeout(700);
    }
    await p.locator(".page-dessus .barre-haut-espaces").click();
    await p.locator(".barre-haut-menu").getByText(espace, { exact: true }).first().click();
    await p.waitForTimeout(700);
  };
  const accueil = async () => {
    for (let i = 0; i < 4 && (await p.locator(".page-dessus .retour").count()); i++) await revenir();
  };

  const tournee = async () => {
  await capture("accueil");
  const fautesAccueil = await accessibilite("Accueil");
  console.log(`${fautesAccueil ? "?? " : "ok "} Accueil${theme}${fautesAccueil ? ` · ${fautesAccueil} faute${fautesAccueil > 1 ? "s" : ""} d'accessibilité` : ""}`);
  // Les quatre espaces (Kora 0.0.75), et chaque onglet qui reprend une ancienne page.
  const ESPACES = {
    Organisation: ["Agenda", "Administratif"],
    Cuisine: ["Courses", "Autres listes", "Recettes", "Frigo"],
    Maison: ["Entretien", "Jardin", "Mitsu", "Vêtements"],
    Budget: [],
  };
  for (const [espace, onglets] of Object.entries(ESPACES)) {
    await allerEspace(espace);
    await verifier(espace);
    for (const onglet of onglets) {
      await p.locator(".page-dessus").getByRole("tab", { name: onglet }).first().click();
      await verifier(`${espace} › ${onglet}`);
    }
  }
  await accueil();
  // Le fil du foyer (0.0.65), depuis sa carte dans les piles de l'accueil.
  await p.locator('.page-dessus .pile-tirets [aria-label="Chez nous"]').first().click();
  await p.waitForTimeout(400);
  await p.locator('.page-dessus .pile-carte[aria-label$="Chez nous"] .pile-entete .lien').click();
  await verifier("Chez nous");
  await revenir();
  await p.getByLabel(/^Réglages/).first().click();
  await verifier("Réglages");
  for (const ligne of ["Apparence", "Partage", "Sauvegarde", "Corbeille", "Notifications", "Calendrier de l'iPhone", "Siri", "Ce que", "Retours de test"]) {
    await p.locator(".page-dessus").getByText(ligne).first().click();
    await verifier(ligne);
    await revenir();
  }
  await accueil();
  };
  await tournee();
  // La même tournée en mode clair : le laiton y est plus sombre, son contraste se vérifie à part.
  theme = "-clair";
  await p.emulateMedia({ colorScheme: "light" });
  await tournee();
  // Puis en grandes lettres (Réglages › Luminosité et affichage, dernier cran hors accessibilité).
  theme = "-grand";
  await p.emulateMedia({ colorScheme: "dark" });
  await p.addStyleTag({ content: "html { font-size: 23px !important; }" });
  await tournee();
  // L'iPhone Duo (pliable, sorti le 23 octobre 2026) : l'écran du dehors, court et étroit, qui
  // vaut aussi pour deux apps côte à côte sur l'écran du dedans (385 × 609 dans Safari 27.1),
  // puis l'écran du dedans, presque carré (669 × 902 dans Safari, un peu plus sans sa barre).
  await p.addStyleTag({ content: "html { font-size: 17px !important; }" });
  for (const [nom, largeur, hauteur] of [["plie", 382, 610], ["deplie", 669, 940]]) {
    theme = `-${nom}`;
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
