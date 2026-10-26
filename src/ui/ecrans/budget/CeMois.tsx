import { useState } from "react";
import {
  avanceeProjet,
  motDuMois,
  rythmeCourses,
  bilanDuMois,
  confirmerMois,
  decrireEcheanceFacture,
  depenses,
  etatDesPots,
  facturesAPayer,
  formaterMontant,
  nommerMois,
  parMois,
  payerFacture,
  POTS_SUIVIS,
  sansDate,
  type Facture,
  type PlanBudget,
  type Pot,
} from "../../../domaine/budget";
import { useAnnoncer } from "../../annulation";
import { contexteReel } from "../../contexte";
import { vibrer } from "../../haptique";
import { Icone } from "../../Icone";
import type { PropsPage } from "../../modules";
import { Feuille, PointEtat } from "../../pieces";
import { apercuAutre, depensesParJour, etatAMoi, type AMoi } from "../../../domaine/aMoi";
import { moisACloturer } from "../../../domaine/budgetConseil";
import { PaiementsAClasser } from "./Paiements";
import { JaugeRythme, MotDeJarvis, phraseRythme } from "./Visuels";
import { ChampMontant, leJour, majuscule, montant, nomDuPot, prenomDe } from "./communs";
import { Montant } from "../../moteur/Chiffre";

// ----- Ce mois -----

export type PropsCeMois = PropsPage & { plan: PlanBudget; voirCharges: () => void; voirPot: (pot: Pot) => void; voirDepenses: () => void; ouvrirPlus: () => void };

/**
 * Ce mois (Kora 0.0.76, version 4 de la maquette) : ce qui demande un geste (la clôture, les
 * paiements à classer), puis « À toi » dans son anneau, et en bas tes dépenses, la prochaine
 * facture, le commun et l'autre. Sans salaire connu pour ce téléphone, la page du foyer d'avant.
 */
export function CeMois(p: PropsCeMois) {
  const etat = p.membreId ? etatAMoi(p.plan, p.budget, p.membreId, p.aujourdhui) : null;
  return etat ? <CeMoisAMoi {...p} etat={etat} /> : <CeMoisCommun {...p} />;
}

/** Ce qui demande un geste d'abord (la clôture, les paiements à classer, les factures), puis les pots. */
function CeMoisCommun(p: PropsCeMois) {
  const { plan, depot, aujourdhui } = p;
  const annoncer = useAnnoncer();
  const pots = etatDesPots(plan, p.budget, aujourdhui);
  const aPayer = facturesAPayer(plan, p.budget, aujourdhui, 45);
  const datesManquantes = sansDate(plan);
  const dernieres = depenses(p.budget).filter((d) => d.jour <= aujourdhui).slice(0, 4);
  const avancee = avanceeProjet(plan, p.budget, aujourdhui);
  const rythme = rythmeCourses(plan, p.budget, aujourdhui);
  const mot = motDuMois(plan, p.budget, aujourdhui);

  async function payer(f: Facture) {
    const d = payerFacture(f, aujourdhui, p.membreId, contexteReel);
    await depot.enregistrerBudget(d);
    vibrer();
    annoncer(`${f.poste.libelle} payée.`, () => depot.supprimerBudget(d.id));
  }

  const detail: Record<Pot, string> = {
    commun: "",
    courses: rythme ? phraseRythme(rythme) : `${montant(pots.courses.depenseDuMois)} dépensés ce mois`,
    plaisir: `${montant(pots.plaisir.depenseDuMois)} dépensés sur ${montant(pots.plaisir.budgetDuMois)}`,
    factures: aPayer[0] ? `Prochaine : ${aPayer[0].poste.libelle}, ${decrireEcheanceFacture(aPayer[0].echeance, aujourdhui)}` : "Rien à payer ces prochaines semaines",
    epargne: avancee ? `${Math.round(avancee.part * 100)} % de « ${avancee.projet.nom} »` : `${montant(pots.epargne.budgetDuMois)} prévus ce mois`,
    perso: "",
  };

  return (
    <>
      <Cloture {...p} plan={plan} mot={mot} />
      {mot && !moisACloturer(plan, p.budget, aujourdhui) && <MotDeJarvis texte={mot} />}
      <PaiementsAClasser {...p} plan={plan} />

      <div className="budget-pots">
        {POTS_SUIVIS.map((pot) => {
          const e = pots[pot];
          const jauge = pot === "courses" && rythme ? rythme : null;
          return (
            <button type="button" key={pot} className={`carte budget-pot${e.solde < 0 ? " negatif" : ""}`} onClick={() => p.voirPot(pot)}>
              <span className="surtitre">{nomDuPot(plan, pot)}</span>
              <span className="budget-solde"><Montant valeur={e.solde} /></span>
              {jauge && <JaugeRythme rythme={jauge} />}
              <span className="discret">{detail[pot]}</span>
            </button>
          );
        })}
      </div>

      <h2 className="rayon">Factures à payer</h2>
      {aPayer.length ? (
        <ul className="carte groupe">
          {aPayer.map((f) => {
            const retard = f.echeance < aujourdhui;
            return (
              <li key={`${f.poste.id}-${f.echeance}`}>
                <div className="ligne">
                  <button className="case" onClick={() => void payer(f)} aria-label={`${f.poste.libelle} payée`} />
                  <span className="ligne-texte">
                    {f.poste.libelle}
                    <span className={`tache-details${retard ? " retard" : ""}`}>
                      {" "}
                      · {decrireEcheanceFacture(f.echeance, aujourdhui)}
                    </span>
                  </span>
                  <span className="budget-montant">{montant(f.montant)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="discret budget-note">Aucune facture à payer à la main ces prochaines semaines.</p>
      )}
      {aPayer.length > 0 && <p className="discret budget-note">Payée par Apple Pay ou trouvée dans un relevé, une facture se coche seule.</p>}
      {datesManquantes.length > 0 && (
        <button type="button" className="carte budget-rappel" onClick={p.voirCharges}>
          <PointEtat etat="jour" />
          <span>
            {datesManquantes.length === 1 ? "Une facture de l'année n'a pas de mois" : `${datesManquantes.length} factures de l'année n'ont pas de mois`} :{" "}
            {datesManquantes.map((x) => x.libelle).join(", ")}. Donne le mois pour que Kora prévienne avant.
          </span>
        </button>
      )}

      <h2 className="rayon">Dernières dépenses</h2>
      {dernieres.length ? (
        <ul className="carte groupe">
          {dernieres.map((d) => (
            <li key={d.id}>
              <button type="button" className="ligne" onClick={p.voirDepenses}>
                <span className="ligne-texte">
                  {d.libelle}
                  <span className="tache-details">
                    {" "}
                    · {nomDuPot(plan, d.pot)} · {leJour(d.jour)}
                  </span>
                </span>
                <span className="budget-montant">{montant(d.montant)}</span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="ligne budget-tout-voir" onClick={p.voirDepenses}>
              <span className="ligne-texte">Toutes les dépenses</span>
              <Icone nom="suivant" taille={16} />
            </button>
          </li>
        </ul>
      ) : (
        <p className="discret budget-note">Rien de noté pour l'instant. Photographie un ticket avec ta fée, ou dis-lui « Migros 84.30 ».</p>
      )}
    </>
  );
}

/**
 * La clôture du mois : le mois qui vient de finir en bref, pot par pot, puis les versements du
 * nouveau mois, notés d'un seul geste. Ce qui reste dans chaque pot passe au mois suivant.
 */
function Cloture(p: PropsPage & { plan: PlanBudget; mot: string | null }) {
  const { plan, depot, aujourdhui } = p;
  const annoncer = useAnnoncer();
  const [epargne, setEpargne] = useState<number | null>(null);
  const cloture = moisACloturer(plan, p.budget, aujourdhui);
  if (!cloture) return null;
  const bilan = bilanDuMois(plan);
  const { nouveau, precedent } = cloture;

  async function confirmer() {
    const doc = confirmerMois(nouveau, { ...bilan.versements, epargne: epargne ?? bilan.versements.epargne }, p.membreId, contexteReel);
    await depot.enregistrerBudget(doc);
    vibrer();
    annoncer(precedent ? `${majuscule(nommerMois(precedent.mois))} clôturé, ${nommerMois(nouveau)} ouvert.` : `Versements de ${nommerMois(nouveau)} notés.`, () => depot.supprimerBudget(doc.id));
  }

  return (
    <section className="carte budget-cloture">
      {precedent && (
        <>
          <p className="surtitre">{majuscule(nommerMois(precedent.mois, aujourdhui))} en bref</p>
          <ul className="groupe">
            {POTS_SUIVIS.map((pot) => {
              const x = precedent.pots[pot];
              return (
                <li key={pot} className="ligne">
                  <span className={`budget-pastille pot-${pot}`} aria-hidden />
                  <span className="ligne-texte">
                    {nomDuPot(plan, pot)}
                    <span className="tache-details">
                      {" "}
                      · {pot === "epargne" ? `${montant(x.verse)} mis de côté` : `${montant(x.depense)} sortis${x.verse ? ` sur ${montant(x.verse)}` : ""}`}
                    </span>
                  </span>
                  <span className={`budget-montant${x.solde < 0 ? " negatif" : ""}`}>{montant(x.solde)}</span>
                </li>
              );
            })}
          </ul>
          {p.mot && <MotDeJarvis texte={p.mot} />}
          <p className="discret">À droite, ce qui passe à {nommerMois(nouveau)}.</p>
        </>
      )}
      <p className="surtitre">{majuscule(nommerMois(nouveau, aujourdhui))} : les versements</p>
      <ul className="groupe">
        {POTS_SUIVIS.map((pot) => (
          <li key={pot} className="ligne">
            <span className="ligne-texte">{nomDuPot(plan, pot)}</span>
            {pot === "epargne" ? (
              <ChampMontant valeur={epargne ?? bilan.versements.epargne} changer={setEpargne} libelle="Versé à l'épargne" />
            ) : (
              <span className="budget-montant">{montant(bilan.versements[pot])}</span>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="bouton-principal" onClick={() => void confirmer()}>
        {precedent ? `Clôturer ${nommerMois(precedent.mois)}` : "C'est versé"}
      </button>
      <p className="discret">Change l'épargne si vous avez versé un autre montant.</p>
    </section>
  );
}

// ----- À toi ce mois -----

function CeMoisAMoi(p: PropsCeMois & { etat: AMoi }) {
  const { plan, etat, aujourdhui } = p;
  const [feuille, setFeuille] = useState<"calcul" | "factures" | "autre" | null>(null);
  const aPayer = facturesAPayer(plan, p.budget, aujourdhui, 45);
  const prochaine = aPayer[0];
  const jours = depensesParJour(p.budget, etat.membreId, aujourdhui, 12);
  const duJour = jours[jours.length - 1];
  const plusHaut = Math.max(1, ...jours.map((j) => j.total));
  const autre = plan.personnes.find((x) => x.membreId !== etat.membreId)?.membreId ?? null;
  const pots = etatDesPots(plan, p.budget, aujourdhui);

  return (
    <>
      <Cloture {...p} plan={plan} mot={motDuMois(plan, p.budget, aujourdhui)} />
      <PaiementsAClasser {...p} plan={plan} />

      <div className="budget-amoi">
        <AnneauAMoi etat={etat} ouvrir={() => setFeuille("calcul")} />
        <p className="budget-par-jour">
          {etat.suivi ? (
            etat.reste > 0 ? (
              <>
                <Montant valeur={Math.floor(etat.parJour)} /> par jour d'ici ta paie
              </>
            ) : (
              "Plus rien pour toi d'ici ta paie"
            )
          ) : (
            `Jour ${etat.jour} sur ${etat.jours} du mois`
          )}
        </p>
        {etat.phrase && <p className="budget-phrase">{etat.phrase}</p>}
      </div>

      <div className="budget-bas">
        <button type="button" className="budget-rangee" onClick={p.voirDepenses}>
          <span className="budget-rangee-texte">
            Tes dépenses
            <span className="discret">{duJour.nombre ? `${formaterMontant(duJour.total, false)} aujourd'hui · ${duJour.nombre} ${duJour.nombre > 1 ? "achats" : "achat"}` : "Rien aujourd'hui"}</span>
          </span>
          <svg className="budget-barres" width="104" height="24" viewBox="0 0 104 24" aria-hidden>
            {jours.map((j, i) => {
              const h = Math.max(2, Math.round((j.total / plusHaut) * 24));
              return <rect key={j.jour} x={i * 9} y={24 - h} width="5" height={h} rx="1.5" className={i === jours.length - 1 ? "aujourdhui" : ""} />;
            })}
          </svg>
        </button>
        <button type="button" className="budget-rangee" onClick={() => setFeuille("factures")}>
          <span className="budget-rangee-texte">
            {prochaine ? prochaine.poste.libelle : "Factures"}
            <span className={`discret${prochaine && prochaine.echeance < aujourdhui ? " retard" : ""}`}>
              {prochaine
                ? `${majuscule(decrireEcheanceFacture(prochaine.echeance, aujourdhui))}${aPayer.length > 1 ? ` · ${aPayer.length - 1} ${aPayer.length > 2 ? "autres" : "autre"}` : ""}`
                : "Rien à payer à la main ces prochaines semaines"}
            </span>
          </span>
          {prochaine && <span className="budget-montant">{montant(prochaine.montant)}</span>}
        </button>
        <div className="budget-tuiles">
          <button type="button" className="budget-rangee" onClick={p.ouvrirPlus}>
            <span className="budget-rangee-texte">
              En commun
              <span className="discret">Courses {formaterMontant(Math.round(pots.courses.solde), false)}</span>
            </span>
            <Icone nom="suivant" taille={16} />
          </button>
          {autre && (
            <button type="button" className="budget-rangee" onClick={() => setFeuille("autre")}>
              <span className="budget-rangee-texte">
                {prenomDe(p.foyer, autre) || "L'autre"}
                <span className="discret">Sa part {formaterMontant(Math.round(plan.personnes.find((x) => x.membreId === autre)?.versement ?? 0), false)}</span>
              </span>
              <Icone nom="suivant" taille={16} />
            </button>
          )}
        </div>
      </div>

      <FeuilleCalcul {...p} ouverte={feuille === "calcul"} fermer={() => setFeuille(null)} autre={autre} />
      <FeuilleFactures {...p} ouverte={feuille === "factures"} fermer={() => setFeuille(null)} />
      <FeuilleAutre {...p} membre={autre} ouverte={feuille === "autre"} fermer={() => setFeuille(null)} />
    </>
  );
}

/**
 * L'anneau de « À toi ». Quand Kora voit tes dépenses : ce qui reste sur ce qui était prévu, et
 * un trait là où tu devrais en être. Sinon, il ne fait pas semblant : il montre la part du mois
 * qui reste, en gris, et ce qui était prévu.
 */
function AnneauAMoi({ etat, ouvrir }: { etat: AMoi; ouvrir: () => void }) {
  const rempli = etat.suivi ? etat.partReste : 1 - etat.partTemps;
  const angleTrait = (1 - etat.partTemps) * 360;
  const libelle = etat.suivi
    ? `Il te reste ${montant(etat.reste)} sur ${montant(etat.prevu)} ce mois. Voir le calcul.`
    : `Prévu pour toi ce mois : ${montant(etat.prevu)}. Voir le calcul.`;
  return (
    <button type="button" className={`budget-anneau${etat.suivi ? "" : " en-attente"}${etat.reste < 0 ? " negatif" : ""}`} onClick={ouvrir} aria-label={libelle}>
      <svg viewBox="0 0 212 212" aria-hidden>
        <circle className="fond" cx="106" cy="106" r="96" />
        {rempli > 0 && <circle className="plein" cx="106" cy="106" r="96" pathLength={1} strokeDasharray={`${rempli} 1`} transform="rotate(-90 106 106)" />}
        {etat.suivi && <line className="trait" x1="106" y1="4" x2="106" y2="20" transform={`rotate(${angleTrait} 106 106)`} />}
      </svg>
      <span className="budget-anneau-centre">
        <span className="surtitre">{etat.suivi ? "À toi" : "Prévu pour toi"}</span>
        <span className="budget-anneau-chiffre">
          <Montant valeur={Math.round(etat.suivi ? etat.reste : etat.prevu)} sansDevise />
        </span>
        <span className="discret">{etat.suivi ? `sur ${montant(Math.round(etat.prevu))}` : "CHF ce mois"}</span>
      </span>
    </button>
  );
}

function FeuilleCalcul(p: PropsCeMois & { etat: AMoi; ouverte: boolean; fermer: () => void; autre: string | null }) {
  const { plan, etat } = p;
  const personne = plan.personnes.find((x) => x.membreId === etat.membreId);
  const charges = plan.postes.filter((x) => x.qui === etat.membreId).sort((a, b) => parMois(b) - parMois(a));
  const ligne = (texte: string, valeur: number, fort = false, signe = "") => (
    <li className={`ligne${fort ? " fort" : ""}`}>
      <span className="ligne-texte">{texte}</span>
      <span className="budget-montant">
        {signe}
        {montant(valeur)}
      </span>
    </li>
  );
  return (
    <Feuille ouverte={p.ouverte} onFermer={p.fermer} titre="D'où vient ton « À toi »">
      <p className="discret">
        {majuscule(nommerMois(etat.mois, p.aujourdhui))}, du {leJour(debutDuMois(etat))} au {leJour(etat.fin)}
      </p>
      <ul className="groupe budget-calcul">
        {ligne("Salaire", personne?.revenu ?? 0)}
        {ligne("Ta part au commun", personne?.versement ?? 0, false, "− ")}
        {charges.map((c) => (
          <li key={c.id} className="ligne">
            <span className="ligne-texte">
              {c.libelle}
              {c.frequence === "an" && <span className="tache-details"> · lissée sur l'année</span>}
            </span>
            <span className="budget-montant">− {montant(parMois(c))}</span>
          </li>
        ))}
        {ligne("À toi ce mois", etat.prevu, true)}
        {etat.suivi && ligne("Déjà dépensé pour toi", etat.depense, false, "− ")}
        {etat.suivi && ligne("Il te reste", etat.reste, true)}
      </ul>
      {etat.ecartMoisPrecedent !== null && Math.abs(etat.ecartMoisPrecedent) >= 1 && (
        <p className="discret">
          {etat.ecartMoisPrecedent > 0 ? `${montant(etat.ecartMoisPrecedent)} de plus` : `${montant(-etat.ecartMoisPrecedent)} de moins`} que le mois d'avant au même jour.
        </p>
      )}
      <p className="discret">
        {etat.suivi
          ? "Kora compte les dépenses « À moi » : la carte réglée ainsi dans Comptes, et ce que tu écris à ta fée avec « pour moi »."
          : "Kora ne voit pas encore tes dépenses à toi : règle ta carte sur « À moi » dans Comptes (Apple Pay), ou écris-les à ta fée avec « pour moi »."}{" "}
        Les chiffres se changent dans Charges.{p.autre ? ` Rien de tout ça ne se voit sur l'iPhone de ${prenomDe(p.foyer, p.autre) || "l'autre"}.` : ""}
      </p>
    </Feuille>
  );
}

const debutDuMois = (etat: AMoi) => {
  const fin = new Date(`${etat.fin}T12:00:00Z`);
  fin.setUTCDate(fin.getUTCDate() - etat.jours + 1);
  return fin.toISOString().slice(0, 10);
};

function FeuilleFactures(p: PropsCeMois & { ouverte: boolean; fermer: () => void }) {
  const { plan, depot, aujourdhui } = p;
  const annoncer = useAnnoncer();
  const aPayer = facturesAPayer(plan, p.budget, aujourdhui, 45);
  const datesManquantes = sansDate(plan);
  async function payer(f: Facture) {
    const d = payerFacture(f, aujourdhui, p.membreId, contexteReel);
    await depot.enregistrerBudget(d);
    vibrer();
    annoncer(`${f.poste.libelle} payée.`, () => depot.supprimerBudget(d.id));
  }
  return (
    <Feuille ouverte={p.ouverte} onFermer={p.fermer} titre="Factures à payer">
      {aPayer.length ? (
        <ul className="groupe">
          {aPayer.map((f) => (
            <li key={`${f.poste.id}-${f.echeance}`}>
              <div className="ligne">
                <button className="case" onClick={() => void payer(f)} aria-label={`${f.poste.libelle} payée`} />
                <span className="ligne-texte">
                  {f.poste.libelle}
                  <span className={`tache-details${f.echeance < aujourdhui ? " retard" : ""}`}>
                    {" "}
                    · {decrireEcheanceFacture(f.echeance, aujourdhui)}, {nomDuPot(plan, f.poste.pot ?? "factures").toLowerCase()}
                  </span>
                </span>
                <span className="budget-montant">{montant(f.montant)}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="discret">Aucune facture à payer à la main ces prochaines semaines.</p>
      )}
      <p className="discret">Payée par Apple Pay ou trouvée dans un relevé, une facture se coche seule.</p>
      {datesManquantes.length > 0 && (
        <button
          type="button"
          className="carte budget-rappel"
          onClick={() => {
            p.fermer();
            p.voirCharges();
          }}
        >
          <PointEtat etat="jour" />
          <span>
            {datesManquantes.length === 1 ? "Une facture de l'année n'a pas de mois" : `${datesManquantes.length} factures de l'année n'ont pas de mois`} :{" "}
            {datesManquantes.map((x) => x.libelle).join(", ")}. Donne le mois pour que Kora prévienne avant.
          </span>
        </button>
      )}
    </Feuille>
  );
}

function FeuilleAutre(p: PropsCeMois & { membre: string | null; ouverte: boolean; fermer: () => void }) {
  const apercu = p.membre ? apercuAutre(p.plan, p.budget, p.membre, p.aujourdhui) : null;
  const prenom = (p.membre && prenomDe(p.foyer, p.membre)) || "L'autre";
  return (
    <Feuille ouverte={p.ouverte && !!apercu} onFermer={p.fermer} titre={prenom}>
      {apercu && (
        <>
          <ul className="groupe budget-calcul">
            <li className="ligne">
              <span className="ligne-texte">Sa part au commun, chaque mois</span>
              <span className="budget-montant">{montant(apercu.versement)}</span>
            </li>
            <li className="ligne">
              <span className="ligne-texte">
                Payé pour le foyer ce mois
                {apercu.nombre > 0 && <span className="tache-details"> · {apercu.nombre} {apercu.nombre > 1 ? "dépenses" : "dépense"}</span>}
              </span>
              <span className="budget-montant">{montant(apercu.depensesCommunes)}</span>
            </li>
          </ul>
          <p className="discret">Son salaire, ses charges et ses dépenses à soi restent sur son iPhone.</p>
        </>
      )}
    </Feuille>
  );
}

/** « Plus » : les pots du commun d'abord (une ligne et une jauge chacun), puis Analyse, Conseiller et Comptes. */
export function FeuillePlus(
  p: PropsPage & { plan: PlanBudget; ouverte: boolean; fermer: () => void; voirPot: (pot: Pot) => void; aller: (vers: "analyse" | "conseiller" | "comptes") => void },
) {
  const { plan, aujourdhui } = p;
  const pots = etatDesPots(plan, p.budget, aujourdhui);
  const rythme = rythmeCourses(plan, p.budget, aujourdhui);
  const avancee = avanceeProjet(plan, p.budget, aujourdhui);
  const aPayer = facturesAPayer(plan, p.budget, aujourdhui, 45);
  const detail: Partial<Record<Pot, string>> = {
    courses: rythme ? phraseRythme(rythme) : `${montant(pots.courses.depenseDuMois)} dépensés ce mois`,
    plaisir: `${montant(pots.plaisir.depenseDuMois)} dépensés sur ${montant(pots.plaisir.budgetDuMois)}`,
    factures: aPayer[0] ? `Prochaine : ${aPayer[0].poste.libelle}, ${decrireEcheanceFacture(aPayer[0].echeance, aujourdhui)}` : "Rien à payer ces prochaines semaines",
    epargne: avancee ? `${Math.round(avancee.part * 100)} % de « ${avancee.projet.nom} »` : `${montant(pots.epargne.budgetDuMois)} prévus ce mois`,
  };
  return (
    <Feuille ouverte={p.ouverte} onFermer={p.fermer} titre="Plus">
      <p className="surtitre">En commun</p>
      <ul className="groupe budget-pots-liste">
        {POTS_SUIVIS.map((pot) => {
          const e = pots[pot];
          return (
            <li key={pot}>
              <button type="button" className={`budget-pot-ligne${e.solde < 0 ? " negatif" : ""}`} onClick={() => p.voirPot(pot)}>
                <span className="budget-pot-haut">
                  <span>{nomDuPot(plan, pot)}</span>
                  <span className="budget-montant">
                    <Montant valeur={e.solde} />
                  </span>
                </span>
                {pot === "courses" && rythme && <JaugeRythme rythme={rythme} />}
                <span className="discret">{detail[pot]}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="budget-plus-liens">
        <button type="button" className="bouton-doux" onClick={() => p.aller("analyse")}>
          Analyse
        </button>
        <button type="button" className="bouton-doux" onClick={() => p.aller("conseiller")}>
          Conseiller
        </button>
        <button type="button" className="bouton-doux" onClick={() => p.aller("comptes")}>
          Comptes
        </button>
      </div>
    </Feuille>
  );
}
