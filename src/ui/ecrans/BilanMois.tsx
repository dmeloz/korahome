import { useState } from "react";
import { jourEnClair } from "../../domaine/agenda";
import { duMois, phrasePot, texteBilan, type BilanDuMoisFoyer } from "../../domaine/bilanMois";
import { formaterMontant } from "../../domaine/budget";
import { Feuille } from "../Feuille";
import { Icone } from "../Icone";
import { partagerTexte } from "../partage";
import { Jauge } from "../pieces/Cartes";

// Le bilan du mois en une page (0.1.23) : un seul grand chiffre, les pots face à leur budget, puis
// une phrase par chapitre (le jour le plus cher, le magasin, la table, les tâches) et un bouton
// pour l'envoyer à l'autre. Règles dans domaine/bilanMois.ts.

export function BilanMois({ bilan, ouverte, fermer }: { bilan: BilanDuMoisFoyer; ouverte: boolean; fermer: () => void }) {
  const titre = `Notre mois ${duMois(bilan.nom)}`;
  const [copie, setCopie] = useState(false);
  const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;
  return (
    <Feuille ouverte={ouverte} onFermer={fermer} titre={titre}>
      <p className="discret">Du {jourEnClair(bilan.debut)} au {jourEnClair(bilan.fin)}{bilan.enCours ? ", jusqu'ici" : ""}.</p>

      {bilan.nombreDepenses > 0 && (
        <section className="carte">
          <p className="surtitre">Au quotidien</p>
          <p className="grand-chiffre">{formaterMontant(Math.round(bilan.quotidien), false)}<small>CHF</small></p>
          <p className="discret">En {pluriel(bilan.nombreDepenses, "dépense")}, sans les factures.</p>
          {bilan.pots.filter((p) => p.depense > 0 || p.budget > 0).map((p) => (
            <div key={p.nom} className="bilan-pot">
              <p>{phrasePot(p)}</p>
              {p.budget > 0 && <Jauge part={p.depense / p.budget} />}
            </div>
          ))}
        </section>
      )}

      <ul className="carte groupe">
        {bilan.jourLePlusCher && <li className="ligne"><span className="ligne-texte">Le jour le plus cher<span className="tache-details"> · {jourEnClair(bilan.jourLePlusCher.jour)}</span></span><span className="budget-montant">{formaterMontant(bilan.jourLePlusCher.total)}</span></li>}
        {bilan.magasin && <li className="ligne"><span className="ligne-texte">{bilan.magasin.nom}<span className="tache-details"> · {pluriel(bilan.magasin.fois, "passage")}</span></span><span className="budget-montant">{formaterMontant(bilan.magasin.total)}</span></li>}
        {bilan.epargne !== null && bilan.epargne > 0 && <li className="ligne"><span className="ligne-texte">Mis de côté</span><span className="budget-montant">{formaterMontant(bilan.epargne)}</span></li>}
        {bilan.repas.notes > 0 && <li className="ligne"><span className="ligne-texte">À table<span className="tache-details"> · {bilan.repas.lePlusMange ? `${bilan.repas.lePlusMange.titre}, ${bilan.repas.lePlusMange.fois} fois` : "jamais deux fois le même plat"}</span></span><span className="budget-montant">{pluriel(bilan.repas.notes, "soir")}</span></li>}
        {bilan.tachesFaites > 0 && <li className="ligne"><span className="ligne-texte">À deux</span><span className="budget-montant">{pluriel(bilan.tachesFaites, "tâche")}</span></li>}
      </ul>

      <button type="button" className="bouton-doux bilan-envoyer" onClick={() => void partagerTexte(titre, texteBilan(bilan, jourEnClair)).then((r) => setCopie(r === "copie"))}>
        <Icone nom="partage" taille={16} />
        {copie ? "Bilan copié : colle-le dans un message" : "Envoyer ce bilan"}
      </button>
    </Feuille>
  );
}
