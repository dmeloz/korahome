// Essai des écrans dans un iPhone simulé (Chromium de Playwright) : crée un foyer, ouvre chaque
// espace depuis « Tous les espaces » et chaque page des Réglages, et signale toute erreur ou page
// sans titre. À lancer avant une version : `npm run build`, puis `node scripts/essai-ecrans.mjs`.
// Les captures vont dans le dossier donné en argument (par défaut un dossier temporaire).
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PLAYWRIGHT = process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs";
const NAVIGATEUR = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
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

  const capture = (nom) => p.screenshot({ path: join(dossier, `${nom}.png`) });
  const verifier = async (nom) => {
    await p.waitForTimeout(700);
    const titre = await p.locator(".page-dessus h1").first().textContent({ timeout: 3000 }).catch(() => null);
    if (!titre) erreurs.push(`« ${nom} » : pas de titre`);
    await capture(nom.replace(/\W+/g, "-"));
    console.log(`${titre ? "ok " : "?? "} ${nom}${titre ? ` → ${titre}` : ""}`);
  };
  const revenir = async () => {
    await p.locator(".page-dessus .retour").click();
    await p.waitForTimeout(500);
  };
  const tousLesEspaces = async () => {
    await p.mouse.move(200, 300);
    await p.mouse.wheel(0, -400);
    await p.waitForTimeout(700);
  };

  await capture("accueil");
  // Les six espaces (Kora 0.0.62), et chaque onglet qui reprend une ancienne page.
  const ESPACES = {
    Tâches: ["Entretien", "Administratif"],
    Courses: ["Autres listes"],
    Agenda: [],
    Maison: ["Jardin", "Mitsu"],
    Cuisine: ["Nos recettes", "Frigo"],
    Budget: [],
  };
  for (const [espace, onglets] of Object.entries(ESPACES)) {
    await tousLesEspaces();
    await p.locator(".tous-espaces").getByText(espace, { exact: true }).first().click();
    await verifier(espace);
    for (const onglet of onglets) {
      await p.locator(".page-dessus").getByRole("tab", { name: onglet }).first().click();
      await verifier(`${espace} › ${onglet}`);
    }
    await revenir();
  }
  await tousLesEspaces();
  await p.getByLabel(/^Réglages/).first().click();
  await verifier("Réglages");
  for (const ligne of ["Apparence", "Partage", "Sauvegarde", "Notifications", "Calendrier de l'iPhone", "Siri", "Ce que", "Retours de test"]) {
    await p.locator(".page-dessus").getByText(ligne).first().click();
    await verifier(ligne);
    await revenir();
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
