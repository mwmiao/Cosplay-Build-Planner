// Cosplay-friendly events in Portugal, researched from organisers' sites and
// event press (October 2026). Shipped with the app and updated in releases;
// admins add more (or newer dates) in the app, stored in the Event table.
// Dates are calendar days (YYYY-MM-DD). `note` flags anything not confirmed.

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
  note?: "dateUnconfirmed";
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
  },
  {
    key: "lgw-2025",
    name: "Lisboa Games Week 2025",
    start: "2025-11-20",
    end: "2025-11-23",
    city: "Lisboa",
    venue: "FIL – Parque das Nações",
    url: "https://lisboagamesweek.pt/",
  },
  {
    key: "xl-games-portimao-2026",
    name: "XL Games Portimão",
    start: "2026-02-27",
    end: "2026-03-01",
    city: "Portimão",
    venue: "Portimão Arena",
    url: "https://xlgames.pt/",
  },
  {
    key: "comic-con-portugal-2026",
    name: "Comic Con Portugal",
    start: "2026-04-23",
    end: "2026-04-26",
    city: "Santa Maria da Feira",
    venue: "Europarque",
    url: "https://evento.comic-con-portugal.com/",
  },
  {
    key: "mercado-pingado-4",
    name: "Mercado Pingado (4.ª edição)",
    start: "2026-04-26",
    city: "Lisboa",
    venue: "Biblioteca Palácio Galveias",
    url: "https://www.instagram.com/mercado_pingado/",
    note: "dateUnconfirmed",
  },
  {
    key: "iberanime-santarem-2026",
    name: "IberAnime Santarém",
    start: "2026-05-16",
    end: "2026-05-17",
    city: "Santarém",
    venue: "CNEMA",
    url: "https://iberanime.com/",
  },
  {
    key: "iberanime-porto-2026",
    name: "IberAnime Porto",
    start: "2026-10-10",
    end: "2026-10-11",
    city: "Matosinhos",
    venue: "Exponor",
    url: "https://iberanime.com/",
  },
  {
    key: "quimera-art-market-2026",
    name: "Quimera Art Market",
    start: "2026-10-29",
    end: "2026-10-31",
    city: "Porto",
  },
  {
    key: "avant-pop-2026-10",
    name: "Avant-Pop",
    start: "2026-10-31",
    city: "Porto",
  },
  {
    key: "aniaki-2026-11",
    name: "Aniaki",
    start: "2026-11-07",
    city: "Lisboa",
    // Aniaki is always held here (organiser's Instagram).
    venue: "ESPAV – Escola Secundária Padre António Vieira",
  },
  {
    key: "lgw-2026",
    name: "Lisboa Games Week 2026",
    start: "2026-11-19",
    end: "2026-11-22",
    city: "Lisboa",
    venue: "FIL – Parque das Nações",
    url: "https://lisboagamesweek.pt/",
  },
  {
    key: "xl-games-aveiro-2026",
    name: "XL Games Aveiro",
    start: "2026-11-20",
    end: "2026-11-22",
    city: "Aveiro",
    venue: "Parque de Exposições de Aveiro",
    url: "https://xlgames.pt/",
  },
  {
    key: "mercado-pingado-5",
    name: "Mercado Pingado (5.ª edição)",
    start: "2026-11-22",
    city: "Lisboa",
    venue: "Biblioteca Palácio Galveias",
    url: "https://mercadopingado.carrd.co/",
  },
  {
    key: "xl-games-cascais-2026",
    name: "XL Games Cascais",
    start: "2026-12-04",
    end: "2026-12-06",
    city: "Cascais",
    venue: "Centro de Congressos do Estoril",
    url: "https://xlgames.pt/",
  },
];
