// Cosplay-friendly events in Portugal, researched from organisers' sites and
// event press. Shipped with the app; on start-up the app copies them into the
// Event table and refreshes them when this list changes (an admin's own edits
// are never overwritten: changes to an edited event go to the review queue).
// Dates are calendar days (YYYY-MM-DD). Only add future editions with a source.

import type { AnnounceStatus, EventType } from "./types";

export type BuiltinEvent = {
  key: string;
  name: string;
  start: string;
  end?: string;
  city: string;
  /** Venue as the organiser names it; the maps button searches for it */
  venue?: string;
  address?: string;
  /** Exact map link when a venue search would be ambiguous */
  mapUrl?: string;
  url?: string;
  eventType: EventType;
  announceStatus: AnnounceStatus;
  /** Where the date comes from */
  sourceUrl?: string;
  notes?: string;
  /** Name of the organiser in BUILTIN_ORGANISERS */
  organiser?: string;
};

export const BUILTIN_EVENTS: readonly BuiltinEvent[] = [
  {
    key: "iberanime-santarem-2025",
    name: "IberAnime Santarém",
    start: "2025-05-17",
    end: "2025-05-18",
    city: "Santarém",
    venue: "CNEMA",
    url: "https://iberanime.com/",
    eventType: "convention",
    announceStatus: "confirmed",
    organiser: "IberAnime",
  },
  {
    key: "lgw-2025",
    name: "Lisboa Games Week 2025",
    start: "2025-11-20",
    end: "2025-11-23",
    city: "Lisboa",
    venue: "FIL – Parque das Nações",
    url: "https://lisboagamesweek.pt/",
    eventType: "gaming",
    announceStatus: "confirmed",
    organiser: "Lisboa Games Week",
  },
  {
    key: "xl-games-portimao-2026",
    name: "XL Games Portimão",
    start: "2026-02-27",
    end: "2026-03-01",
    city: "Portimão",
    venue: "Portimão Arena",
    url: "https://xlgames.pt/",
    eventType: "gaming",
    announceStatus: "confirmed",
    organiser: "XL Games",
  },
  {
    key: "comic-con-portugal-2026",
    name: "Comic Con Portugal",
    start: "2026-04-23",
    end: "2026-04-26",
    city: "Santa Maria da Feira",
    venue: "Europarque",
    url: "https://evento.comic-con-portugal.com/",
    eventType: "convention",
    announceStatus: "confirmed",
    organiser: "Comic Con Portugal",
  },
  {
    key: "mercado-pingado-4",
    name: "Mercado Pingado (4.ª edição)",
    start: "2026-04-26",
    city: "Lisboa",
    venue: "Biblioteca Palácio Galveias",
    url: "https://www.instagram.com/mercado_pingado/",
    eventType: "market",
    // Date from the organiser's page; the year isn't stated there, hence "announced".
    announceStatus: "announced",
    organiser: "Mercado Pingado",
  },
  {
    key: "iberanime-santarem-2026",
    name: "IberAnime Santarém",
    start: "2026-05-16",
    end: "2026-05-17",
    city: "Santarém",
    venue: "CNEMA",
    url: "https://iberanime.com/",
    eventType: "convention",
    announceStatus: "confirmed",
    organiser: "IberAnime",
  },
  {
    key: "iberanime-porto-2026",
    name: "IberAnime Porto",
    start: "2026-10-10",
    end: "2026-10-11",
    city: "Matosinhos",
    venue: "Exponor",
    url: "https://iberanime.com/",
    eventType: "convention",
    announceStatus: "confirmed",
    organiser: "IberAnime",
  },
  {
    key: "quimera-art-market-2026",
    name: "Quimera Art Market",
    start: "2026-10-29",
    end: "2026-10-31",
    city: "Porto",
    // Usual venue per Agenda Porto (CCBombarda, Rua de Miguel Bombarda 285).
    venue: "CCBombarda",
    address: "Rua de Miguel Bombarda, 285",
    eventType: "market",
    announceStatus: "announced",
    sourceUrl: "https://www.agenda-porto.pt/evento/quimera-13/",
    organiser: "Quimera Art Market",
  },
  {
    key: "avant-pop-2026-10",
    name: "Avant-Pop",
    start: "2026-10-31",
    city: "Porto",
    eventType: "other",
    announceStatus: "announced",
    organiser: "Avant-Pop",
  },
  {
    key: "aniaki-2026-11",
    name: "Aniaki",
    start: "2026-11-07",
    city: "Lisboa",
    // Aniaki is always held here (organiser's Instagram).
    venue: "ESPAV – Escola Secundária Padre António Vieira",
    eventType: "convention",
    announceStatus: "announced",
    organiser: "Aniaki",
  },
  {
    key: "lgw-2026",
    name: "Lisboa Games Week 2026",
    start: "2026-11-19",
    end: "2026-11-22",
    city: "Lisboa",
    venue: "FIL – Parque das Nações",
    url: "https://lisboagamesweek.pt/",
    eventType: "gaming",
    announceStatus: "tickets",
    organiser: "Lisboa Games Week",
  },
  {
    key: "xl-games-aveiro-2026",
    name: "XL Games Aveiro",
    start: "2026-11-20",
    end: "2026-11-22",
    city: "Aveiro",
    venue: "Parque de Exposições de Aveiro",
    url: "https://xlgames.pt/",
    eventType: "gaming",
    announceStatus: "confirmed",
    organiser: "XL Games",
  },
  {
    key: "mercado-pingado-5",
    name: "Mercado Pingado (5.ª edição)",
    start: "2026-11-22",
    city: "Lisboa",
    venue: "Biblioteca Palácio Galveias",
    url: "https://mercadopingado.carrd.co/",
    eventType: "market",
    announceStatus: "confirmed",
    organiser: "Mercado Pingado",
  },
  {
    key: "xl-games-cascais-2026",
    name: "XL Games Cascais",
    start: "2026-12-04",
    end: "2026-12-06",
    city: "Cascais",
    venue: "Centro de Congressos do Estoril",
    url: "https://xlgames.pt/",
    eventType: "gaming",
    announceStatus: "confirmed",
    organiser: "XL Games",
  },
  {
    key: "iberanime-santarem-2027",
    name: "IberAnime Santarém 2027",
    start: "2027-05-15",
    end: "2027-05-16",
    city: "Santarém",
    venue: "CNEMA",
    url: "https://iberanime.com/",
    eventType: "convention",
    announceStatus: "tickets",
    sourceUrl: "https://www.otakupt.com/anime/iberanime-recorde-porto-convidado-2027/",
    notes: "Coda (JoJo's Bizarre Adventure)",
    organiser: "IberAnime",
  },
];

export type BuiltinOrganiser = {
  name: string;
  /** Only usernames confirmed from the organiser's own pages */
  instagram?: string;
  website?: string;
  city?: string;
  usualVenue?: string;
  usualAddress?: string;
  eventType: EventType;
};

/** Added once when the Organiser table is first set up; afterwards the admin manages them. */
export const BUILTIN_ORGANISERS: readonly BuiltinOrganiser[] = [
  { name: "IberAnime", website: "https://iberanime.com/", eventType: "convention" },
  { name: "Comic Con Portugal", website: "https://evento.comic-con-portugal.com/", eventType: "convention" },
  { name: "Lisboa Games Week", website: "https://lisboagamesweek.pt/", city: "Lisboa", usualVenue: "FIL – Parque das Nações", eventType: "gaming" },
  { name: "XL Games", website: "https://xlgames.pt/", eventType: "gaming" },
  {
    name: "Quimera Art Market",
    city: "Porto",
    usualVenue: "CCBombarda",
    usualAddress: "Rua de Miguel Bombarda, 285",
    eventType: "market",
  },
  {
    name: "Mercado Pingado",
    instagram: "mercado_pingado",
    website: "https://mercadopingado.carrd.co/",
    city: "Lisboa",
    usualVenue: "Biblioteca Palácio Galveias",
    eventType: "market",
  },
  { name: "Aniaki", city: "Lisboa", usualVenue: "ESPAV – Escola Secundária Padre António Vieira", eventType: "convention" },
  { name: "Avant-Pop", city: "Porto", eventType: "other" },
];
