// L'atelier de finition : capture chaque écran de Kora et ses états importants, en sombre et en
// clair, aux tailles des appareils du foyer, avec la carte de chaque élément visible (place au
// point près, composant React, fichier, styles) et les différences avec la version d'avant.
// Le tout se publie dans la page « Atelier de finition » (voir docs/atelier-de-finition.md).
//
//   node scripts/atelier-captures.mjs [--sortie dossier] [--avant dossier] [--appareils air,pro] [--themes sombre]
//
// --avant : le dossier de la version précédente (même forme), pour les différences.
// Construit lui-même une copie non minifiée de l'app, pour garder le nom des composants.
import { spawn, execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLAYWRIGHT = process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs";
const NAVIGATEUR = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const { chromium } = await import(PLAYWRIGHT);

const arg = (nom, defaut) => {
  const i = process.argv.indexOf(`--${nom}`);
  return i > 0 ? process.argv[i + 1] : defaut;
};
const version = JSON.parse(readFileSync(join(RACINE, "package.json"), "utf8")).version;
const sortie = arg("sortie", join(RACINE, ".atelier", version));
const avant = arg("avant", null);

// Les appareils du foyer, en points (px CSS) et à leur densité réelle.
const APPAREILS = {
  air: { nom: "iPhone 17 Air", qui: "Melo", largeur: 420, hauteur: 912, densite: 3, mobile: true },
  pro: { nom: "iPhone 14 Pro", qui: "Sarah", largeur: 393, hauteur: 852, densite: 3, mobile: true },
  ipad: { nom: "iPad (9e génération)", qui: "Maison", largeur: 810, hauteur: 1080, densite: 2, mobile: true },
  ipadair: { nom: "iPad Air (M1)", qui: "Maison", largeur: 820, hauteur: 1180, densite: 2, mobile: true },
};
const THEMES = { sombre: "dark", clair: "light" };
const appareils = arg("appareils", Object.keys(APPAREILS).join(",")).split(",");
const themes = arg("themes", Object.keys(THEMES).join(",")).split(",");

// L'iPhone dessine en SF Pro, absente ici : Inter en est la plus proche (mêmes proportions).
const POLICES = `:root{--police:"Inter",system-ui,sans-serif!important;--police-titre:"Inter Display","Inter",system-ui,sans-serif!important;--police-fixe:"JetBrains Mono",monospace!important}`;

// Tout tombe au même endroit d'une version à l'autre : heure, hasard et identifiants fixés.
// L'heure avance normalement depuis l'heure fictive (l'horloge de Playwright fige aussi
// performance.now, et Motion n'avance plus) ; « atelier:heure » la change pour la nuit.
const DETERMINISTE = (heure) => {
  let fictive = heure;
  try { fictive = sessionStorage.getItem("atelier:heure") ?? heure; } catch { /* rien */ }
  const Vraie = Date, ecart = new Vraie(fictive).getTime() - Vraie.now();
  class Fictive extends Vraie {
    constructor(...a) { if (a.length) super(...a); else super(Vraie.now() + ecart); }
    static now() { return Vraie.now() + ecart; }
  }
  globalThis.Date = Fictive;
  let graine = 20261020;
  Math.random = () => {
    graine = (graine * 1664525 + 1013904223) % 4294967296;
    return graine / 4294967296;
  };
  let n = 0;
  crypto.randomUUID = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
};

// ---- Les composants : nom → fichier, pour dire où corriger ----
function indexComposants() {
  const index = {};
  const parcourir = (dossier) => {
    for (const nom of readdirSync(dossier)) {
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (nom.endsWith(".tsx") && !/\.test\./.test(nom)) {
        readFileSync(chemin, "utf8").split("\n").forEach((ligne, i) => {
          const m = ligne.match(/^(?:export\s+)?(?:default\s+)?function\s+([A-Z]\w*)|^(?:export\s+)?const\s+([A-Z]\w*)\s*=\s*(?:memo\(|forwardRef\(|\()/);
          const n = m && (m[1] ?? m[2]);
          if (n && !index[n]) index[n] = `${relative(RACINE, chemin)}:${i + 1}`;
        });
      }
    }
  };
  parcourir(join(RACINE, "src", "ui"));
  return index;
}

// ---- Les données d'essai : un foyer rempli, toujours le même ----
const JOUR = "2026-10-20";
const CREE = "2026-10-12T08:00:00.000Z";
function donneesEssai(foyer, listes) {
  const [melo, sarah] = foyer.membres;
  const courses = listes.find((l) => l.type === "courses") ?? listes[0];
  const article = (id, texte, rayon, quantite = null, coche = false, par = melo.id) => ({ id, listeId: courses.id, texte, quantite, rayon, coche, ajoutePar: par, creeLe: CREE, cocheLe: coche ? "2026-10-20T07:40:00.000Z" : null });
  const tache = (id, titre, echeance, extra = {}) => ({ id, titre, recurrence: { unite: "semaine", tous: 1 }, echeance, responsable: melo.id, faiteLe: null, faitePar: null, creeLe: CREE, ...extra });
  const produit = (id, nom, nombre, unite, lieu, peremption) => ({ id, nom, quantite: nombre == null ? null : `${nombre}${unite && unite !== "piece" ? ` ${unite}` : ""}`, nombre, unite, lieu, peremption, ajoutePar: sarah.id, creeLe: CREE });
  const evenement = (id, titre, jour, heure, extra = {}) => ({ id, titre, jour, fin: null, heure, heureFin: null, pour: null, categorie: "rdv", repetition: "aucune", lieu: null, note: null, creePar: melo.id, creeLe: CREE, ...extra });
  return {
    elements: [
      article("essai-a1", "Lait", "Crèmerie", "2 l"),
      article("essai-a2", "Pommes", "Fruits et légumes", "2 kg", false, sarah.id),
      article("essai-a3", "Pain complet", "Boulangerie"),
      article("essai-a4", "Croquettes pour Mitsu, sans céréales, le grand sac de 7 kg", "Animaux", "1"),
      article("essai-a5", "Tomates cerises", "Fruits et légumes", "250 g"),
      article("essai-a6", "Café en grains", "Épicerie salée", null, true),
      article("essai-a7", "Liquide vaisselle", "Entretien", null, true, sarah.id),
      article("essai-a8", "Yaourts nature", "Crèmerie", "4"),
    ],
    taches: [
      tache("essai-t1", "Vider la litière de Mitsu", JOUR, { heure: "08:30", recurrence: { unite: "jour", tous: 2 } }),
      tache("essai-t2", "Arroser les herbes du balcon", JOUR, { heure: "19:00", responsable: sarah.id }),
      tache("essai-t3", "Sortir le verre et le papier", "2026-10-18", { heure: null }),
      tache("essai-t4", "Passer l'aspirateur dans le salon, la chambre et le couloir avant l'arrivée des parents samedi", "2026-10-22", { responsable: null }),
      tache("essai-t5", "Changer les draps", "2026-10-24", { responsable: sarah.id }),
      tache("essai-t6", "Détartrer la machine à café", "2026-11-02", { categorie: "entretien", recurrence: { unite: "mois", tous: 3 } }),
      tache("essai-t7", "Payer la prime d'assurance maladie", "2026-10-25", { categorie: "administratif", recurrence: { unite: "mois", tous: 1 } }),
    ],
    stock: [
      produit("essai-p1", "Lait demi-écrémé", 1, "l", "frigo", "2026-10-22"),
      produit("essai-p2", "Gruyère", 250, "g", "frigo", "2026-11-05"),
      produit("essai-p3", "Épinards", 400, "g", "frigo", "2026-10-19"),
      produit("essai-p4", "Petits pois", 1, "kg", "congelateur", "2027-03-01"),
      produit("essai-p5", "Riz basmati", 1, "kg", "placard", null),
      produit("essai-p6", "Œufs", 6, "piece", "frigo", "2026-10-28"),
    ],
    agenda: [
      evenement("essai-e1", "Vétérinaire de Mitsu", "2026-10-21", "17:30", { lieu: "Renens", pour: sarah.id }),
      evenement("essai-e2", "Souper chez les parents", "2026-10-24", "19:00"),
      evenement("essai-e3", "Anniversaire de Sarah", "2026-11-03", null, { categorie: "anniversaire", repetition: "annee" }),
      evenement("essai-e4", "Vacances au Tessin", "2026-12-26", null, { fin: "2027-01-02", categorie: "vacances" }),
    ],
  };
}

async function remplir(p) {
  await p.evaluate(async (fabrique) => {
    const ouvrir = () => new Promise((ok, ko) => { const r = indexedDB.open("korahome"); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
    const base = await ouvrir();
    const tout = (m) => new Promise((ok) => { const r = base.transaction(m).objectStore(m).getAll(); r.onsuccess = () => ok(r.result); });
    const foyer = (await tout("foyer"))[0];
    const listes = await tout("listes");
    const donnees = new Function("foyer", "listes", `return (${fabrique})(foyer, listes)`)(foyer, listes);
    const tx = base.transaction(Object.keys(donnees), "readwrite");
    for (const [m, docs] of Object.entries(donnees)) for (const d of docs) tx.objectStore(m).put(d);
    await new Promise((ok) => (tx.oncomplete = ok));
    base.close();
  }, donneesEssai.toString().replace(/\bJOUR\b/g, JSON.stringify(JOUR)).replace(/\bCREE\b/g, JSON.stringify(CREE)));
}

// ---- La carte des éléments : tout ce qui est visible, et qui est touché à chaque point ----
function lireCarte(pas) {
  const L = innerWidth, H = innerHeight;
  const elements = [], numero = new Map(), styles = [], numeroStyle = new Map(), composants = [], numeroComposant = new Map();
  const PROPRIETES = ["font-family", "font-size", "font-weight", "line-height", "letter-spacing", "color", "background-color", "border-radius", "padding", "margin", "gap", "border", "opacity", "box-shadow", "display", "text-align", "backdrop-filter"];
  const chaine = (el) => {
    const cle = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
    let f = cle ? el[cle] : null;
    const noms = [];
    while (f && noms.length < 5) {
      const t = f.type;
      const nom = typeof t === "function" ? t.displayName || t.name : t && typeof t === "object" ? (t.type?.name || t.render?.name) : null;
      if (nom && /^[A-Z]/.test(nom) && noms[noms.length - 1] !== nom) noms.push(nom);
      f = f.return;
    }
    const texte = noms.join(" › ");
    if (!numeroComposant.has(texte)) { numeroComposant.set(texte, composants.length); composants.push(texte); }
    return numeroComposant.get(texte);
  };
  const selecteur = (el) => {
    const morceaux = [];
    for (let e = el; e && e !== document.body && morceaux.length < 5; e = e.parentElement) {
      let m = e.tagName.toLowerCase();
      const classes = [...e.classList].filter((c) => !/^(sortie|entree|actif|ouverte?)$/.test(c)).slice(0, 2);
      if (classes.length) m += "." + classes.join(".");
      const freres = e.parentElement ? [...e.parentElement.children].filter((x) => x.tagName === e.tagName) : [];
      if (freres.length > 1) m += `:nth-of-type(${freres.indexOf(e) + 1})`;
      morceaux.unshift(m);
    }
    return morceaux.join(" > ");
  };
  const ajouter = (el) => {
    if (numero.has(el)) return numero.get(el);
    const r = el.getBoundingClientRect();
    const parent = el.parentElement && el.parentElement !== document.documentElement ? ajouter(el.parentElement) : -1;
    const s = getComputedStyle(el);
    const style = PROPRIETES.map((k) => s.getPropertyValue(k)).join("|");
    if (!numeroStyle.has(style)) { numeroStyle.set(style, styles.length); styles.push(style); }
    const direct = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
    const i = elements.length;
    numero.set(el, i);
    const arrondi = (v) => Math.round(v * 2) / 2;
    elements.push({
      p: parent,
      r: [arrondi(r.left), arrondi(r.top), arrondi(r.width), arrondi(r.height)],
      s: selecteur(el),
      t: direct.slice(0, 80) || undefined,
      a: el.getAttribute("aria-label") || el.getAttribute("placeholder") || undefined,
      c: chaine(el),
      y: numeroStyle.get(style),
    });
    return i;
  };
  // La grille : à chaque case de `pas` points, l'élément que le doigt toucherait (le plus haut).
  const colonnes = Math.ceil(L / pas), lignes = Math.ceil(H / pas), grille = [];
  for (let y = 0; y < lignes; y++) {
    for (let x = 0; x < colonnes; x++) {
      const el = document.elementFromPoint(Math.min(L - 1, x * pas + pas / 2), Math.min(H - 1, y * pas + pas / 2));
      grille.push(el && el !== document.documentElement ? ajouter(el) : -1);
    }
  }
  // Ce que le doigt ne touche pas (pointer-events: none) mais qui se voit.
  for (const el of document.body.querySelectorAll("*")) {
    if (elements.length > 2500) break;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.right < 0 || r.top > H || r.left > L) continue;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none") continue;
    ajouter(el);
  }
  // La grille compressée en suites (valeur, nombre).
  const suites = [];
  for (const v of grille) {
    if (suites.length && suites[suites.length - 2] === v) suites[suites.length - 1]++;
    else suites.push(v, 1);
  }
  const racine = getComputedStyle(document.documentElement);
  const jetons = {};
  for (const feuille of document.styleSheets) {
    try {
      for (const regle of feuille.cssRules) {
        if (regle.selectorText === ":root" && regle.style) for (const k of regle.style) if (k.startsWith("--") && !jetons[k]) jetons[k] = racine.getPropertyValue(k).trim();
      }
    } catch { /* feuille d'un autre domaine */ }
  }
  return { elements, styles, composants, grille: { pas, colonnes, lignes, suites }, jetons, defilement: document.scrollingElement?.scrollTop ?? 0 };
}

// ---- Les différences avec la version d'avant, au pixel ----
async function comparer(outil, imageAvant, imageApres, densite) {
  return outil.evaluate(async ({ a, b, densite }) => {
    const charger = (src) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });
    const [ia, ib] = await Promise.all([charger(a), charger(b)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return { part: 1, boites: [[0, 0, ib.width / densite, ib.height / densite]], taille: true };
    const pixels = (img) => { const c = new OffscreenCanvas(img.width, img.height); const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height).data; };
    const pa = pixels(ia), pb = pixels(ib);
    const cote = 8 * densite, cols = Math.ceil(ib.width / cote), rangs = Math.ceil(ib.height / cote);
    const cases = new Uint8Array(cols * rangs);
    let changes = 0;
    for (let y = 0; y < ib.height; y++) {
      for (let x = 0; x < ib.width; x++) {
        const i = (y * ib.width + x) * 4;
        if (Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]) > 40) {
          changes++;
          cases[Math.floor(y / cote) * cols + Math.floor(x / cote)] = 1;
        }
      }
    }
    // Les cases voisines se regroupent en boîtes.
    const vu = new Uint8Array(cases.length), boites = [];
    for (let k = 0; k < cases.length; k++) {
      if (!cases[k] || vu[k]) continue;
      let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
      const pile = [k];
      vu[k] = 1;
      while (pile.length) {
        const c = pile.pop(), cx = c % cols, cy = (c - cx) / cols;
        x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy, n = ny * cols + nx;
          if (nx >= 0 && ny >= 0 && nx < cols && ny < rangs && cases[n] && !vu[n]) { vu[n] = 1; pile.push(n); }
        }
      }
      boites.push([x0 * 8, y0 * 8, (x1 - x0 + 1) * 8, (y1 - y0 + 1) * 8]);
    }
    return { part: Math.round((changes / (ib.width * ib.height)) * 10000) / 10000, boites: boites.slice(0, 40) };
  }, { a: imageAvant, b: imageApres, densite });
}

function comparerElements(carteAvant, carteApres) {
  if (!carteAvant) return [];
  const PROPRIETES = ["police", "taille", "graisse", "interligne", "approche", "couleur", "fond", "arrondi", "marge intérieure", "marge", "écart", "bordure", "opacité", "ombre", "affichage", "alignement", "flou"];
  const parSelecteur = new Map(carteAvant.elements.map((e) => [e.s + "|" + (e.t ?? ""), e]));
  const changements = [];
  for (const e of carteApres.elements) {
    const a = parSelecteur.get(e.s + "|" + (e.t ?? ""));
    if (!a) continue;
    const quoi = [];
    const dx = e.r[0] - a.r[0], dy = e.r[1] - a.r[1], dl = e.r[2] - a.r[2], dh = e.r[3] - a.r[3];
    if (dx || dy) quoi.push(`déplacé de ${dx} × ${dy} pt`);
    if (dl || dh) quoi.push(`taille ${a.r[2]}×${a.r[3]} → ${e.r[2]}×${e.r[3]} pt`);
    const sa = carteAvant.styles[a.y].split("|"), sb = carteApres.styles[e.y].split("|");
    sb.forEach((v, k) => { if (v !== sa[k]) quoi.push(`${PROPRIETES[k]} : ${sa[k]} → ${v}`); });
    if (quoi.length) changements.push({ e: carteApres.elements.indexOf(e), quoi });
  }
  // Un parent qui bouge entraîne ses enfants : on garde les premiers de chaque branche.
  const gardes = new Set(changements.map((c) => c.e));
  return changements.filter((c) => !gardes.has(carteApres.elements[c.e].p) || c.quoi.some((q) => !q.startsWith("déplacé"))).slice(0, 40);
}

// ---- Le parcours : chaque écran et ses états ----
async function parcourir(p, capter) {
  const attendre = (ms = 650) => p.waitForTimeout(ms);
  const revenir = async () => { await p.locator(".page-dessus .retour").first().click().catch(() => {}); await attendre(500); };
  const fermerFeuille = async () => { await p.keyboard.press("Escape"); await attendre(300); const b = p.locator(".feuille-entete button").first(); if (await b.count()) await b.click().catch(() => {}); await attendre(400); };
  const tousLesEspaces = async () => { await p.mouse.move(200, 300); await p.mouse.wheel(0, -400); await attendre(700); };
  const espace = async (nom) => { await tousLesEspaces(); await p.locator(".tous-espaces").getByText(nom, { exact: true }).first().click(); await attendre(); };
  const onglet = async (nom) => { await p.locator(".page-dessus").getByRole("tab", { name: nom }).first().click(); await attendre(); };

  await capter("bienvenue", "Bienvenue", "Premier lancement");
  await p.getByText(/Créer|créer/).first().click().catch(() => {});
  await attendre(300);
  await p.getByPlaceholder("Chez nous").fill("Cassa");
  await p.getByPlaceholder("Melo").fill("Melo");
  await p.getByPlaceholder("Prénom").fill("Sarah");
  await p.getByText("Créer notre foyer").click();
  await attendre(1500);
  if (await p.locator(".visite").count()) await capter("visite", "Visite guidée", "Premier lancement");
  for (let k = 0; k < 12 && (await p.locator(".visite").count()); k++) {
    await p.locator(".visite button").last().click({ timeout: 1500 }).catch(() => {});
    await attendre(300);
  }
  await capter("accueil-vide", "Accueil, foyer neuf", "Accueil");

  await remplir(p);
  await p.reload();
  await attendre(1500);
  await capter("accueil", "Accueil", "Accueil");
  await p.mouse.wheel(0, 2000);
  await attendre(700);
  await capter("accueil-bas", "Accueil, en bas", "Accueil");
  await p.mouse.wheel(0, -4000);
  await attendre(500);
  await tousLesEspaces();
  await capter("tous-les-espaces", "Tous les espaces", "Accueil");
  await p.mouse.click(10, 10).catch(() => {});
  await p.keyboard.press("Escape");
  await attendre(500);
  const fee = p.getByLabel(/touche pour parler/).first();
  if (await fee.count()) {
    await fee.click();
    await attendre(700);
    await capter("fee-saisie", "Tael, saisie ouverte", "Accueil");
    await p.keyboard.press("Escape");
    await attendre(500);
  }

  await espace("Tâches");
  await capter("taches", "Tâches", "Tâches");
  // Le clic de Playwright passe par Glissable, qui le prend pour un début de geste : clic direct.
  await p.locator(".tache-texte").first().evaluate((b) => b.click()).catch(() => {});
  await attendre(700);
  await capter("taches-feuille", "Tâches, détail d'une tâche", "Tâches");
  await fermerFeuille();
  await onglet("Entretien"); await capter("taches-entretien", "Tâches › Entretien", "Tâches");
  await onglet("Administratif"); await capter("taches-administratif", "Tâches › Administratif", "Tâches");
  await revenir();

  await espace("Courses");
  await capter("courses", "Courses", "Courses");
  if (await fee.count()) {
    await fee.click();
    await attendre(500);
    await p.locator("input:visible, textarea:visible").last().fill("2 kg de pommes et du pain").catch(() => {});
    await attendre(500);
    await capter("courses-saisie", "Courses, phrase dite à Tael", "Courses");
    await p.keyboard.press("Escape");
    await attendre(500);
  }
  await onglet("Autres listes"); await capter("courses-autres", "Courses › Autres listes", "Courses");
  await revenir();

  await espace("Cuisine");
  await capter("cuisine", "Cuisine › Cette semaine", "Cuisine");
  await onglet("Nos recettes"); await capter("cuisine-recettes", "Cuisine › Nos recettes", "Cuisine");
  await onglet("Frigo"); await capter("cuisine-frigo", "Cuisine › Frigo", "Cuisine");
  await revenir();

  await espace("Maison");
  await capter("maison", "Maison", "Maison");
  await onglet("Mitsu"); await capter("maison-mitsu", "Maison › Mitsu", "Maison");
  await onglet("Jardin"); await capter("maison-jardin", "Maison › Jardin", "Maison");
  await revenir();

  await espace("Agenda");
  await capter("agenda", "Agenda", "Agenda");
  await revenir();
  await espace("Budget");
  await capter("budget", "Budget", "Budget");
  await revenir();

  await tousLesEspaces();
  await p.getByLabel(/^Réglages/).first().click();
  await attendre();
  await capter("reglages", "Réglages", "Réglages");
  const PAGES = [["Apparence", "apparence"], ["Partage", "partage"], ["Sauvegarde", "sauvegarde"], ["Notifications", "notifications"], ["Calendrier de l'iPhone", "calendrier"], ["Siri", "siri"], ["Ce que", "ce-que-tael-sait"], ["Retours de test", "retours"]];
  for (const [ligne, cle] of PAGES) {
    await p.locator(".page-dessus").getByText(ligne).first().click().catch(() => {});
    await attendre();
    const titre = await p.locator(".page-dessus h1").first().textContent({ timeout: 2000 }).catch(() => ligne);
    await capter(`reglages-${cle}`, `Réglages › ${titre?.trim() || ligne}`, "Réglages");
    await revenir();
  }
  await revenir();

  // La nuit de la fée : le même accueil à 23 h 40.
  await p.evaluate(() => sessionStorage.setItem("atelier:heure", "2026-10-20T23:40:00+02:00"));
  await p.reload();
  await attendre(1500);
  await capter("accueil-nuit", "Accueil, la nuit", "Accueil");
}

// ---- Le tout ----
mkdirSync(join(sortie, "cartes"), { recursive: true });
const dist = mkdtempSync(join(tmpdir(), "kora-atelier-"));
console.log("Construction non minifiée…");
execFileSync("npx", ["vite", "build", "--minify", "false", "--outDir", dist, "--emptyOutDir"], { cwd: RACINE, stdio: "ignore" });
const port = 4800 + Math.floor(Math.random() * 400);
const serveur = spawn("npx", ["vite", "preview", "--outDir", dist, "--port", String(port), "--strictPort"], { cwd: RACINE, stdio: "ignore" });
await new Promise((ok) => setTimeout(ok, 2500));

const composantsFichiers = indexComposants();
const manifeste = { version, date: new Date().toISOString(), heureFictive: "2026-10-20T09:15:00+02:00", police: "Inter (à la place de SF Pro)", appareils: {}, themes: Object.keys(THEMES), ecrans: [], captures: {}, composants: composantsFichiers, avant: null, erreurs: [] };
const manifesteAvant = avant && existsSync(join(avant, "atelier.json")) ? JSON.parse(readFileSync(join(avant, "atelier.json"), "utf8")) : null;
if (manifesteAvant) manifeste.avant = manifesteAvant.version;

const navigateur = await chromium.launch({ executablePath: NAVIGATEUR, args: ["--lang=fr-CH"] });
const outil = await (await navigateur.newContext()).newPage();
const versWebp = (png) => outil.evaluate(async (b64) => {
  const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
  const c = new OffscreenCanvas(img.width, img.height);
  c.getContext("2d").drawImage(img, 0, 0);
  const blob = await c.convertToBlob({ type: "image/webp", quality: 0.92 });
  const octets = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < octets.length; i += 32768) s += String.fromCharCode(...octets.subarray(i, i + 32768));
  return btoa(s);
}, png.toString("base64"));

try {
  for (const a of appareils) {
    const app = APPAREILS[a];
    manifeste.appareils[a] = app;
    for (const t of themes) {
      const groupe = `${a}-${t}`;
      mkdirSync(join(sortie, "captures", groupe), { recursive: true });
      const carte = { styles: [], composants: [], ecrans: {} };
      const carteAvant = manifesteAvant && existsSync(join(avant, "cartes", `${groupe}.json`)) ? JSON.parse(readFileSync(join(avant, "cartes", `${groupe}.json`), "utf8")) : null;
      const ctx = await navigateur.newContext({
        viewport: { width: app.largeur, height: app.hauteur },
        deviceScaleFactor: app.densite,
        isMobile: app.mobile,
        hasTouch: true,
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
        colorScheme: THEMES[t],
        reducedMotion: "reduce",
        serviceWorkers: "block",
        locale: "fr-CH",
        timezoneId: "Europe/Zurich",
      });
      await ctx.addInitScript(DETERMINISTE, manifeste.heureFictive);
      const p = await ctx.newPage();
      p.on("pageerror", (e) => manifeste.erreurs.push(`${groupe} : ${e.message}`));
      await p.goto(`http://localhost:${port}/`);
      await p.addStyleTag({ content: POLICES });
      await p.waitForTimeout(900);
      const vus = new Set();
      const capter = async (cle, titre, rubrique) => {
        if (vus.has(cle)) return;
        vus.add(cle);
        if (!(await p.locator("style[data-atelier]").count())) await p.addStyleTag({ content: POLICES }).then((h) => h.evaluate((s) => s.setAttribute("data-atelier", "")));
        await p.evaluate(() => document.fonts.ready);
        await p.waitForTimeout(250);
        if (!manifeste.ecrans.some((e) => e.cle === cle)) manifeste.ecrans.push({ cle, titre, rubrique });
        const png = await p.screenshot();
        const webp = Buffer.from(await versWebp(png), "base64");
        const chemin = join("captures", groupe, `${cle}.webp`);
        writeFileSync(join(sortie, chemin), webp);
        const c = await p.evaluate(lireCarte, 4);
        // Styles et composants mis en commun pour tout le groupe.
        const decaler = (table, liste) => liste.map((v) => { let i = table.indexOf(v); if (i < 0) { i = table.length; table.push(v); } return i; });
        const ns = decaler(carte.styles, c.styles), nc = decaler(carte.composants, c.composants);
        for (const e of c.elements) { e.y = ns[e.y]; e.c = nc[e.c]; }
        carte.ecrans[cle] = { elements: c.elements, grille: c.grille, jetons: c.jetons };
        const info = { image: chemin, octets: webp.length };
        const ancienne = manifesteAvant?.captures?.[`${groupe}/${cle}`];
        if (ancienne && existsSync(join(avant, ancienne.image))) {
          const d = await comparer(outil, `data:image/webp;base64,${readFileSync(join(avant, ancienne.image)).toString("base64")}`, `data:image/webp;base64,${webp.toString("base64")}`, app.densite);
          info.difference = d;
          if (d.part > 0) {
            const copie = join("avant", groupe, `${cle}.webp`);
            mkdirSync(join(sortie, "avant", groupe), { recursive: true });
            cpSync(join(avant, ancienne.image), join(sortie, copie));
            info.avant = copie;
            const ca = carteAvant?.ecrans?.[cle];
            if (ca) info.changements = comparerElements({ elements: ca.elements, styles: carteAvant.styles }, { elements: c.elements, styles: carte.styles });
          }
        } else if (manifesteAvant) info.nouveau = true;
        manifeste.captures[`${groupe}/${cle}`] = info;
        console.log(`${groupe.padEnd(16)} ${cle}${info.difference?.part ? `  (${(info.difference.part * 100).toFixed(2)} % changé)` : ""}`);
      };
      try {
        await parcourir(p, capter);
      } catch (e) {
        manifeste.erreurs.push(`${groupe} : parcours interrompu (${e.message.split("\n")[0]})`);
        console.log(`!! ${groupe} : ${e.message.split("\n")[0]}`);
      }
      writeFileSync(join(sortie, "cartes", `${groupe}.json`), JSON.stringify(carte));
      await ctx.close();
    }
  }
} finally {
  await navigateur.close();
  serveur.kill();
}

writeFileSync(join(sortie, "atelier.json"), JSON.stringify(manifeste));
// La liste des fichiers à publier avec la page (paramètre `files` de l'outil Artifact).
const fichiers = {};
const lister = (d) => { for (const n of readdirSync(join(sortie, d))) { const r = join(d, n); if (statSync(join(sortie, r)).isDirectory()) lister(r); else fichiers[`donnees/${r}`] = join(sortie, r); } };
for (const d of ["captures", "cartes", "avant"]) if (existsSync(join(sortie, d))) lister(d);
fichiers["donnees/atelier.json"] = join(sortie, "atelier.json");
writeFileSync(join(sortie, "publication.json"), JSON.stringify(fichiers, null, 1));
console.log(`\n${Object.keys(manifeste.captures).length} captures, ${Object.keys(fichiers).length} fichiers dans ${sortie}`);
if (manifeste.erreurs.length) console.log(manifeste.erreurs.join("\n"));
