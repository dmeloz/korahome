import { describe, expect, it } from "vitest";
import { preparerEvenement, type Evenement } from "./agenda";
import { contexteTest } from "./contexteTest";
import {
  empreinte,
  fusionnerIcs,
  icsEvenement,
  lireCalendriers,
  lireIcs,
  lireMultistatus,
  lireRessources,
  masquerAppleId,
  planSynchro,
  prefixeImport,
  versZurich,
  type EntreeSynchro,
  type Lien,
  type Ressource,
} from "./icloud";
import type { Foyer } from "./types";

const MAINTENANT = "2026-10-18T20:00:00.000Z";
const AUJOURDHUI = "2026-10-18";
const KORA = "https://p63-caldav.icloud.com/123/calendars/kora/";
const foyer: Foyer = {
  id: "f",
  nom: "Cassa",
  creeLe: "2026-10-01T08:00:00.000Z",
  membres: [
    { id: "melo", prenom: "Melo", couleur: "#d3a14a" },
    { id: "sarah", prenom: "Sarah", couleur: "#7fa38a" },
  ],
};

const ev = (titre: string, jour: string, extra: Partial<Evenement> = {}): Evenement => ({
  ...preparerEvenement({ titre, jour }, "melo", contexteTest("2026-10-10T08:00:00.000Z")),
  id: `e-${titre}`,
  ...extra,
});

describe("le format iCalendar", () => {
  it("écrit un rendez-vous à l'heure de Zurich, et le relit tel quel", () => {
    const e = ev("Dentiste, contrôle", "2026-10-22", { heure: "14:30", heureFin: "15:15", lieu: "Renens", note: "Apporter\nla carte" });
    const ics = icsEvenement(e, "Sarah", MAINTENANT);
    expect(ics).toContain("UID:e-Dentiste, contrôle@korahome");
    expect(ics).toContain("SUMMARY:Sarah · Dentiste\\, contrôle");
    expect(ics).toContain("DTSTART;TZID=Europe/Zurich:20261022T143000");
    expect(ics).toContain("BEGIN:VTIMEZONE");
    const [lu] = lireIcs(ics);
    expect(lu).toMatchObject({ titre: "Sarah · Dentiste, contrôle", jour: "2026-10-22", heure: "14:30", heureFin: "15:15", lieu: "Renens", note: "Apporter\nla carte", repetition: "aucune" });
  });

  it("des vacances sur plusieurs jours entiers", () => {
    const ics = icsEvenement(ev("Vacances", "2026-12-20", { fin: "2026-12-27" }), null, MAINTENANT);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261220");
    expect(ics).toContain("DTEND;VALUE=DATE:20261228");
    expect(lireIcs(ics)[0]).toMatchObject({ jour: "2026-12-20", fin: "2026-12-27", heure: null });
  });

  it("une série : tous les quinze jours le lundi et le mercredi, jusqu'à une date, sauf un jour", () => {
    const e = ev("Travail", "2026-10-05", { heure: "08:00", heureFin: "17:00", repetition: "semaine", intervalle: 2, joursSemaine: [1, 3], jusquau: "2026-12-31", sauf: ["2026-10-19"] });
    const ics = icsEvenement(e, null, MAINTENANT);
    expect(ics).toContain("RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261231T235959Z");
    expect(lireIcs(ics)[0]).toMatchObject({ repetition: "semaine", intervalle: 2, joursSemaine: [1, 3], jusquau: "2026-12-31", sauf: ["2026-10-19"] });
  });

  it("replie les longues lignes et les relit", () => {
    const titre = "Très long titre ".repeat(10).trim();
    const ics = icsEvenement(ev(titre, "2026-10-22"), null, MAINTENANT);
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(lireIcs(ics)[0].titre).toBe(titre);
  });

  it("ramène l'heure UTC et les autres fuseaux à Zurich", () => {
    expect(versZurich("2026-10-22", "12:30", "UTC")).toEqual({ jour: "2026-10-22", heure: "14:30" });
    expect(versZurich("2026-12-22", "23:30", "UTC")).toEqual({ jour: "2026-12-23", heure: "00:30" });
    expect(versZurich("2026-10-22", "08:00", "America/New_York")).toEqual({ jour: "2026-10-22", heure: "14:00" });
    expect(versZurich("2026-10-22", "08:00", "Pas un fuseau")).toEqual({ jour: "2026-10-22", heure: "08:00" });
  });

  it("lit un événement d'iPhone : UTC, durée, anniversaire, exceptions et annulés laissés de côté", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:ABC-1",
      "DTSTART:20261022T123000Z",
      "DURATION:PT45M",
      "SUMMARY:Coiffeur",
      "LAST-MODIFIED:20261017T101500Z",
      "BEGIN:VALARM",
      "TRIGGER:-PT15M",
      "DESCRIPTION:Rappel",
      "END:VALARM",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:ABC-1",
      "RECURRENCE-ID:20261029T123000Z",
      "DTSTART:20261029T130000Z",
      "SUMMARY:Déplacé",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:ABC-2",
      "STATUS:CANCELLED",
      "DTSTART;VALUE=DATE:20261023",
      "SUMMARY:Annulé",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:ABC-3",
      "DTSTART;VALUE=DATE:19900512",
      "DTEND;VALUE=DATE:19900513",
      "RRULE:FREQ=YEARLY",
      "SUMMARY:Anniversaire de Léa",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const lus = lireIcs(ics);
    expect(lus.map((l) => l.uid)).toEqual(["ABC-1", "ABC-3"]);
    expect(lus[0]).toMatchObject({ jour: "2026-10-22", heure: "14:30", heureFin: "15:15", note: null, modifie: "2026-10-17T10:15:00.000Z" });
    expect(lus[1]).toMatchObject({ jour: "1990-05-12", fin: null, heure: null, repetition: "annee" });
  });
});

describe("les réponses CalDAV", () => {
  const xml = `<?xml version="1.0"?>
<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <response>
    <href>/123/calendars/home/</href>
    <propstat><prop><displayname>Maison</displayname><resourcetype><collection/><C:calendar/></resourcetype>
      <C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set></prop>
      <status>HTTP/1.1 200 OK</status></propstat>
  </response>
  <response>
    <href>/123/calendars/tasks/</href>
    <propstat><prop><displayname>Rappels</displayname><resourcetype><collection/><C:calendar/></resourcetype>
      <C:supported-calendar-component-set><C:comp name="VTODO"/></C:supported-calendar-component-set></prop>
      <status>HTTP/1.1 200 OK</status></propstat>
  </response>
  <response>
    <href>/123/calendars/</href>
    <propstat><prop><resourcetype><collection/></resourcetype></prop><status>HTTP/1.1 200 OK</status></propstat>
    <propstat><prop><displayname/></prop><status>HTTP/1.1 404 Not Found</status></propstat>
  </response>
</multistatus>`;

  it("trouve les calendriers d'événements seulement", () => {
    expect(lireCalendriers(xml, "https://p63-caldav.icloud.com:443/123/calendars/")).toEqual([{ url: "https://p63-caldav.icloud.com/123/calendars/home/", nom: "Maison" }]);
  });

  it("lit aussi les attributs entre apostrophes, comme les renvoie iCloud", () => {
    const icloud = `<?xml version='1.0' encoding='UTF-8'?><multistatus xmlns='DAV:'><response><href>/123/calendars/A1/</href><propstat><prop><displayname>Travail</displayname><resourcetype><collection/><calendar xmlns='urn:ietf:params:xml:ns:caldav'/></resourcetype><supported-calendar-component-set xmlns='urn:ietf:params:xml:ns:caldav'><comp name='VEVENT'/></supported-calendar-component-set></prop><status>HTTP/1.1 200 OK</status></propstat></response><response><href>/123/calendars/tasks/</href><propstat><prop><displayname>Rappels</displayname><resourcetype><collection/><calendar xmlns='urn:ietf:params:xml:ns:caldav'/></resourcetype><supported-calendar-component-set xmlns='urn:ietf:params:xml:ns:caldav'><comp name='VTODO'/></supported-calendar-component-set></prop><status>HTTP/1.1 200 OK</status></propstat></response></multistatus>`;
    expect(lireCalendriers(icloud, "https://p63-caldav.icloud.com/123/calendars/")).toEqual([{ url: "https://p63-caldav.icloud.com/123/calendars/A1/", nom: "Travail" }]);
  });

  it("garde seulement les propriétés trouvées", () => {
    const r = lireMultistatus(xml).find((x) => x.href === "/123/calendars/")!;
    expect(r.props.displayname).toBeUndefined();
  });

  it("lit les événements avec leur version", () => {
    const rapport = `<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/123/calendars/home/a.ics</d:href><d:propstat><d:prop><d:getetag>&quot;e1&quot;</d:getetag><cal:calendar-data><![CDATA[BEGIN:VCALENDAR
BEGIN:VEVENT
UID:a
DTSTART;VALUE=DATE:20261030
SUMMARY:Apéro &amp; jeux
END:VEVENT
END:VCALENDAR]]></cal:calendar-data></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`;
    const [r] = lireRessources(rapport, "https://p63-caldav.icloud.com/");
    expect(r).toMatchObject({ href: "https://p63-caldav.icloud.com/123/calendars/home/a.ics", etag: '"e1"' });
    expect(lireIcs(r.ics)[0].titre).toBe("Apéro &amp; jeux");
  });
});

describe("la synchro, compte par compte", () => {
  const base = (x: Partial<EntreeSynchro>): EntreeSynchro => ({
    membre: "melo",
    foyer,
    evenements: [],
    liens: [],
    calendrierKora: KORA,
    kora: [],
    autres: [],
    maintenant: MAINTENANT,
    aujourdhui: AUJOURDHUI,
    ...x,
  });
  /** Ce que Kora aurait écrit, et le lien correspondant, comme après une synchro réussie. */
  const deja = (e: Evenement, prefixe: string | null = null, etag = '"1"'): { lien: Lien; ressource: Ressource } => {
    const ics = icsEvenement(e, prefixe, "2026-10-17T08:00:00.000Z");
    const href = `${KORA}${e.id}.ics`;
    return { lien: { evenementId: e.id, href, etag, empreinte: empreinte(ics.replace(/\r\nDTSTAMP:[^\r]*/, "")) }, ressource: { href, etag, ics } };
  };

  it("écrit dans « Kora » ce qui n'y est pas encore, avec le prénom pour l'autre personne", () => {
    const commun = ev("Apéro", "2026-10-24");
    const sarah = ev("Gynéco", "2026-10-25", { pour: "sarah" });
    const plan = planSynchro(base({ evenements: [commun, sarah] }));
    expect(plan.envoyer.map((x) => x.href)).toEqual([`${KORA}e-Ap_ro.ics`, `${KORA}e-Gyn_co.ics`]);
    expect(plan.envoyer[1].ics).toContain("SUMMARY:Sarah · Gynéco");
    expect(plan.ecrire).toEqual([]);
  });

  it("ne renvoie rien quand rien n'a changé", () => {
    const e = ev("Apéro", "2026-10-24");
    const { lien, ressource } = deja(e);
    const plan = planSynchro(base({ evenements: [e], liens: [lien], kora: [ressource] }));
    expect(plan).toMatchObject({ envoyer: [], effacer: [], ecrire: [], supprimer: [], liens: [lien] });
  });

  it("renvoie un événement modifié dans Kora", () => {
    const e = ev("Apéro", "2026-10-24");
    const { lien, ressource } = deja(e);
    const plan = planSynchro(base({ evenements: [{ ...e, heure: "18:00" }], liens: [lien], kora: [ressource] }));
    expect(plan.envoyer).toHaveLength(1);
    expect(plan.envoyer[0].href).toBe(lien.href);
  });

  it("reprend dans Kora ce qui a été modifié sur l'iPhone, sans toucher à pour qui", () => {
    const e = ev("Dentiste", "2026-10-22", { pour: "sarah", heure: "14:00" });
    const { lien, ressource } = deja(e, "Sarah");
    const modifie = ressource.ics.replace("T140000", "T160000").replace("END:VEVENT", "LAST-MODIFIED:20261018T190000Z\r\nEND:VEVENT");
    const plan = planSynchro(base({ evenements: [e], liens: [lien], kora: [{ ...ressource, etag: '"2"', ics: modifie }] }));
    expect(plan.ecrire).toHaveLength(1);
    expect(plan.ecrire[0]).toMatchObject({ id: e.id, titre: "Dentiste", heure: "16:00", pour: "sarah" });
    expect(plan.envoyer).toEqual([]);
    expect(plan.liens[0].etag).toBe('"2"');
  });

  it("modifié des deux côtés : le plus récent gagne", () => {
    const e = ev("Dentiste", "2026-10-22", { heure: "14:00" });
    const { lien, ressource } = deja(e);
    const iphone = { ...ressource, etag: '"2"', ics: ressource.ics.replace("T140000", "T160000").replace("END:VEVENT", "LAST-MODIFIED:20261018T100000Z\r\nEND:VEVENT") };
    const koraPlusRecent = planSynchro(base({ evenements: [{ ...e, heure: "09:00", modifieLe: "2026-10-18T12:00:00.000Z" }], liens: [lien], kora: [iphone] }));
    expect(koraPlusRecent.ecrire).toEqual([]);
    expect(koraPlusRecent.envoyer[0].ics).toContain("T090000");
    const iphonePlusRecent = planSynchro(base({ evenements: [{ ...e, heure: "09:00", modifieLe: "2026-10-18T08:00:00.000Z" }], liens: [lien], kora: [iphone] }));
    expect(iphonePlusRecent.ecrire[0].heure).toBe("16:00");
  });

  it("retire de Kora un événement effacé sur l'iPhone, et efface d'iCloud ce qui est retiré de Kora", () => {
    const efface = ev("Ciné", "2026-10-24");
    const retire = ev("Resto", "2026-10-25");
    const a = deja(efface);
    const b = deja(retire);
    const plan = planSynchro(base({ evenements: [efface], liens: [a.lien, b.lien], kora: [b.ressource] }));
    expect(plan.supprimer).toEqual([efface.id]);
    expect(plan.effacer).toEqual([b.lien.href]);
    expect(plan.liens).toEqual([]);
  });

  it("un calendrier « Kora » vidé d'un coup : Kora réécrit tout au lieu de tout effacer", () => {
    const evenements = ["A", "B", "C", "D", "E"].map((t) => ev(t, "2026-10-24"));
    const plan = planSynchro(base({ evenements, liens: evenements.map((e) => deja(e).lien), kora: [] }));
    expect(plan.supprimer).toEqual([]);
    expect(plan.envoyer).toHaveLength(5);
  });

  it("accueille dans Kora un événement ajouté au calendrier « Kora » sur l'iPhone", () => {
    const ics = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:IPHONE-1\r\nDTSTART;TZID=Europe/Zurich:20261029T190000\r\nSUMMARY:Concert\r\nEND:VEVENT\r\nEND:VCALENDAR";
    const plan = planSynchro(base({ kora: [{ href: `${KORA}IPHONE-1.ics`, etag: '"9"', ics }] }));
    expect(plan.ecrire[0]).toMatchObject({ id: `ical-${empreinte("IPHONE-1")}`, titre: "Concert", jour: "2026-10-29", heure: "19:00", pour: null, uid: "IPHONE-1", categorie: "sortie" });
    expect(plan.liens[0]).toMatchObject({ href: `${KORA}IPHONE-1.ics`, etag: '"9"' });
    expect(plan.envoyer).toEqual([]);
  });

  it("efface un reste de Kora qui n'existe plus", () => {
    const ics = icsEvenement(ev("Vieux", "2026-10-24"), null, MAINTENANT);
    const plan = planSynchro(base({ kora: [{ href: `${KORA}vieux.ics`, etag: '"1"', ics }] }));
    expect(plan.effacer).toEqual([`${KORA}vieux.ics`]);
  });

  it("lit les autres calendriers dans Kora, pour la personne du compte, et retire ce qui a disparu", () => {
    const travail = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:T-1\r\nDTSTART;TZID=Europe/Zurich:20261020T080000\r\nDTEND;TZID=Europe/Zurich:20261020T170000\r\nSUMMARY:Réunion d'équipe\r\nEND:VEVENT\r\nEND:VCALENDAR";
    const ancien = ev("Disparu", "2026-10-20", { id: `${prefixeImport("melo")}x`, source: "iCloud de Melo" });
    const plan = planSynchro(base({ evenements: [ancien], autres: [{ href: "https://x/t1.ics", etag: '"1"', ics: travail }] }));
    expect(plan.ecrire).toHaveLength(1);
    expect(plan.ecrire[0]).toMatchObject({ titre: "Réunion d'équipe", heure: "08:00", heureFin: "17:00", pour: "melo", source: "iCloud de Melo", categorie: "travail" });
    expect(plan.supprimer).toEqual([ancien.id]);
    // Ce qui vient de ce compte ne revient pas dans son propre calendrier « Kora ».
    expect(plan.envoyer).toEqual([]);
  });

  it("une lecture des autres calendriers ratée ne retire rien", () => {
    const ancien = ev("Gardé", "2026-10-20", { id: `${prefixeImport("melo")}x`, source: "iCloud de Melo" });
    expect(planSynchro(base({ evenements: [ancien], autres: null })).supprimer).toEqual([]);
  });

  describe("modifier depuis Kora un événement d'un autre calendrier iCloud", () => {
    const HREF = "https://x/cal/travail/T-1.ics";
    const ics = (heure: string, extra = "") =>
      `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Apple Inc.//iPhone OS 26//EN\r\nBEGIN:VEVENT\r\nUID:T-1\r\nDTSTART;TZID=Europe/Zurich:20261020T${heure}00\r\nDTEND;TZID=Europe/Zurich:20261020T170000\r\nSUMMARY:Réunion\r\nSEQUENCE:2\r\n${extra}BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:-PT15M\r\nEND:VALARM\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
    /** L'événement tel que Kora l'a lu au passage précédent. */
    const lu = () => planSynchro(base({ autres: [{ href: HREF, etag: '"1"', ics: ics("0800") }] })).ecrire[0];

    it("garde où il est rangé et sa version", () => {
      expect(lu().icloud).toEqual({ href: HREF, etag: '"1"', importeLe: MAINTENANT });
      expect(planSynchro(base({ evenements: [lu()], autres: [{ href: HREF, etag: '"1"', ics: ics("0800") }] })).ecrire).toEqual([]);
    });

    it("renvoie à iCloud ce que Kora a changé, en gardant l'alerte", () => {
      const change = { ...lu(), titre: "Réunion d'équipe", heure: "09:00", modifieLe: "2026-10-18T21:00:00.000Z" };
      const plan = planSynchro(base({ evenements: [change], autres: [{ href: HREF, etag: '"1"', ics: ics("0800") }] }));
      expect(plan.ecrire).toEqual([]);
      expect(plan.modifierIcloud).toHaveLength(1);
      const { href, etag, ics: envoye } = plan.modifierIcloud[0];
      expect([href, etag]).toEqual([HREF, '"1"']);
      expect(envoye).toContain("UID:T-1");
      expect(envoye).toContain("SUMMARY:Réunion d'équipe");
      expect(envoye).toContain("DTSTART;TZID=Europe/Zurich:20261020T090000");
      expect(envoye).toContain("TRIGGER:-PT15M");
      expect(envoye).toContain("SEQUENCE:3");
      expect(envoye).toContain("PRODID:-//Apple Inc.//iPhone OS 26//EN");
      expect(envoye.match(/BEGIN:VEVENT/g)).toHaveLength(1);
      expect(envoye.match(/^SUMMARY/gm)).toHaveLength(1);
    });

    it("changé aussi sur l'iPhone, plus récemment : l'iPhone gagne", () => {
      const change = { ...lu(), heure: "09:00", modifieLe: "2026-10-18T21:00:00.000Z" };
      const iphone = { href: HREF, etag: '"2"', ics: ics("1000", "LAST-MODIFIED:20261018T220000Z\r\n") };
      const plan = planSynchro(base({ evenements: [change], autres: [iphone] }));
      expect(plan.modifierIcloud).toEqual([]);
      expect(plan.ecrire[0]).toMatchObject({ heure: "10:00", icloud: { etag: '"2"' } });
    });

    it("retiré dans Kora : effacé de son calendrier iCloud", () => {
      const retire = { ...lu(), aRetirer: true };
      const plan = planSynchro(base({ aRetirer: [retire], autres: [{ href: HREF, etag: '"1"', ics: ics("0800") }] }));
      expect(plan.retirerIcloud).toEqual([HREF]);
      expect(plan.supprimer).toEqual([retire.id]);
      expect(plan.ecrire).toEqual([]);
    });
  });

  it("garde les exceptions d'une série et les fuseaux d'origine", () => {
    const original =
      "BEGIN:VCALENDAR\r\nPRODID:x\r\nBEGIN:VTIMEZONE\r\nTZID:Europe/Zurich\r\nEND:VTIMEZONE\r\nBEGIN:VEVENT\r\nUID:S\r\nDTSTART;TZID=Europe/Zurich:20261020T080000\r\nRRULE:FREQ=WEEKLY\r\nSUMMARY:Sport\r\nLOCATION:Salle\r\nX-APPLE-STRUCTURED-LOCATION;VALUE=URI:geo:1,2\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:S\r\nRECURRENCE-ID;TZID=Europe/Zurich:20261027T080000\r\nDTSTART;TZID=Europe/Zurich:20261027T090000\r\nSUMMARY:Sport\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
    const e = { ...ev("Sport", "2026-10-20", { heure: "08:30", repetition: "semaine", lieu: "Piscine" }), uid: "S" };
    const sortie = fusionnerIcs(original, e, MAINTENANT);
    expect(sortie.match(/BEGIN:VTIMEZONE/g)).toHaveLength(1);
    expect(sortie).toContain("RECURRENCE-ID;TZID=Europe/Zurich:20261027T080000");
    expect(sortie).toContain("LOCATION:Piscine");
    expect(sortie).not.toContain("X-APPLE-STRUCTURED-LOCATION");
    expect(sortie).toContain("DTSTART;TZID=Europe/Zurich:20261020T083000");
  });

  it("met dans « Kora » ce qui vient de l'iCloud de l'autre, avec son prénom", () => {
    const deSarah = ev("Yoga", "2026-10-21", { id: `${prefixeImport("sarah")}y`, pour: "sarah", source: "iCloud de Sarah" });
    const plan = planSynchro(base({ evenements: [deSarah] }));
    expect(plan.envoyer[0].ics).toContain("SUMMARY:Sarah · Yoga");
  });
});

describe("l'identifiant Apple masqué", () => {
  it("garde le début et le domaine", () => {
    expect(masquerAppleId("m.exemple@icloud.com")).toBe("m.e…@icloud.com");
    expect(masquerAppleId("ab@me.com")).toBe("a…@me.com");
  });
});
