import type { Jour } from "./types";

// La météo du jardin, d'Open-Meteo (gratuit, sans compte ni clé) : les deux jours passés
// et la semaine qui vient, jour par jour. Le téléphone et le serveur des rappels la lisent
// à la même adresse ; ce fichier construit l'adresse et relit la réponse, sans réseau.

export interface Lieu {
  nom: string;
  latitude: number;
  longitude: number;
}

/** Le jardin du foyer, à Renens (VD). */
export const LIEU_DU_JARDIN: Lieu = { nom: "Renens", latitude: 46.5354, longitude: 6.5918 };

export interface JourMeteo {
  jour: Jour;
  /** Températures minimale et maximale, en °C. */
  min: number;
  max: number;
  /** Pluie (et neige fondue) sur la journée, en millimètres. */
  pluie: number;
  /** Le code du temps (norme WMO), pour le décrire. */
  code: number;
}

export interface Meteo {
  lieu: string;
  jours: JourMeteo[];
  /** Quand elle a été lue (ISO 8601). */
  lue: string;
}

export function adresseMeteo(lieu: Lieu = LIEU_DU_JARDIN): string {
  const p = new URLSearchParams({
    latitude: String(lieu.latitude),
    longitude: String(lieu.longitude),
    daily: "temperature_2m_min,temperature_2m_max,precipitation_sum,weather_code",
    timezone: "Europe/Zurich",
    past_days: "2",
    forecast_days: "7",
  });
  return `https://api.open-meteo.com/v1/forecast?${p}`;
}

const nombres = (v: unknown): v is number[] => Array.isArray(v) && v.every((x) => typeof x === "number" || x === null);

/** Relit la réponse d'Open-Meteo ; null si elle n'a pas la forme attendue. */
export function lireMeteo(brut: unknown, lue: string, lieu: Lieu = LIEU_DU_JARDIN): Meteo | null {
  const d = (brut as { daily?: Record<string, unknown> } | null)?.daily;
  if (!d || !Array.isArray(d.time)) return null;
  const { time, temperature_2m_min: min, temperature_2m_max: max, precipitation_sum: pluie, weather_code: code } = d;
  if (!nombres(min) || !nombres(max) || !nombres(pluie) || !nombres(code)) return null;
  const jours: JourMeteo[] = [];
  time.forEach((jour, i) => {
    if (typeof jour !== "string" || min[i] === null || max[i] === null) return;
    jours.push({ jour, min: min[i], max: max[i], pluie: pluie[i] ?? 0, code: code[i] ?? 0 });
  });
  return jours.length ? { lieu: lieu.nom, jours, lue } : null;
}

export function meteoDu(meteo: Meteo | null, jour: Jour): JourMeteo | null {
  return meteo?.jours.find((j) => j.jour === jour) ?? null;
}

/** Une météo de plus de 12 heures ne sert plus aux alertes. */
export function meteoFraiche(meteo: Meteo | null, maintenant: string, heures = 12): meteo is Meteo {
  return !!meteo && Date.parse(maintenant) - Date.parse(meteo.lue) < heures * 3600_000;
}

/** Le temps en quelques mots, d'après le code WMO. */
export function decrireTemps(code: number): string {
  if (code === 0) return "Grand soleil";
  if (code <= 2) return "Éclaircies";
  if (code === 3) return "Couvert";
  if (code === 45 || code === 48) return "Brouillard";
  if (code >= 51 && code <= 57) return "Bruine";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "Pluie";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "Neige";
  if (code >= 95) return "Orage";
  return "Variable";
}

/** « 4° / 12° » */
export function formaterTemperatures(j: JourMeteo): string {
  return `${Math.round(j.min)}° / ${Math.round(j.max)}°`;
}

/** « 3 mm » ; rien sous un demi-millimètre. */
export function formaterPluie(mm: number): string | null {
  if (mm < 0.5) return null;
  return `${mm < 10 ? mm.toLocaleString("fr-CH", { maximumFractionDigits: 1 }) : Math.round(mm)} mm`;
}
