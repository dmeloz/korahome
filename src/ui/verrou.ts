import { CLES, ecrireTexte, effacer, lireTexte } from "./stockageLocal";

// Le verrou du Budget : Face ID, Touch ID sur l'iPhone Duo (0.0.90), ou le code, par WebAuthn, la clé reste dans
// l'iPhone et son identifiant sur ce téléphone. Rien ne part sur le serveur : c'est un rideau
// devant la page, pas un chiffrement. Une fois ouvert, il reste ouvert dix minutes.

const DUREE_OUVERT = 10 * 60_000;
let ouvertDepuis = 0;

export const verrouPossible = () => typeof PublicKeyCredential !== "undefined" && !!navigator.credentials;
export const verrouActif = () => !!lireTexte(CLES.verrouBudget);
export const verrouOuvert = () => !verrouActif() || Date.now() - ouvertDepuis < DUREE_OUVERT;

const enTexte = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
const enOctets = (t: string) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
const defi = () => crypto.getRandomValues(new Uint8Array(32));

/** Crée la clé dans l'iPhone (Face ID demandé) et pose le verrou. Faux si la personne a renoncé. */
export async function poserVerrou(prenom: string): Promise<boolean> {
  try {
    const cle = await navigator.credentials.create({
      publicKey: {
        challenge: defi(),
        rp: { name: "Kora", id: location.hostname },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: `budget-${prenom.toLowerCase()}`, displayName: `Budget de ${prenom}` },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
        timeout: 60_000,
      },
    });
    if (!(cle instanceof PublicKeyCredential)) return false;
    if (!ecrireTexte(CLES.verrouBudget, enTexte(cle.rawId))) return false;
    ouvertDepuis = Date.now();
    return true;
  } catch {
    return false;
  }
}

/** Demande Face ID ; vrai si l'iPhone reconnaît la personne. */
export async function ouvrirVerrou(): Promise<boolean> {
  const id = lireTexte(CLES.verrouBudget);
  if (!id) return true;
  try {
    const r = await navigator.credentials.get({
      publicKey: { challenge: defi(), rpId: location.hostname, allowCredentials: [{ type: "public-key", id: enOctets(id) }], userVerification: "required", timeout: 60_000 },
    });
    if (!r) return false;
    ouvertDepuis = Date.now();
    return true;
  } catch {
    return false;
  }
}

/** Retire le verrou de ce téléphone (après l'avoir ouvert). */
export function retirerVerrou(): void {
  effacer(CLES.verrouBudget);
  ouvertDepuis = 0;
}
