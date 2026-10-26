/** Lowercase, accent-free, letters and digits only: "IberAnime Porto 2026" → "iberanimeporto2026". */
export function normaliseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Letter-pair (Dice) similarity of two names, 0–1, ignoring case, accents, years and punctuation. */
export function nameSimilarity(a: string, b: string): number {
  const x = normaliseName(a).replace(/\d+/g, "");
  const y = normaliseName(b).replace(/\d+/g, "");
  if (!x || !y) return 0;
  if (x === y || x.includes(y) || y.includes(x)) return 1;
  const pairs = (s: string) => {
    const out = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) out.set(s.slice(i, i + 2), (out.get(s.slice(i, i + 2)) ?? 0) + 1);
    return out;
  };
  const px = pairs(x);
  const py = pairs(y);
  let common = 0;
  for (const [k, n] of px) common += Math.min(n, py.get(k) ?? 0);
  return (2 * common) / (x.length - 1 + (y.length - 1));
}

const ABBREVIATIONS: [RegExp, string][] = [
  [/^(R|Rua)\.?\s+/i, "Rua "],
  [/^(Av|Avd|Avda)\.?\s+/i, "Avenida "],
  [/^(Pç|Pc|Pça|Praca)\.?\s+/i, "Praça "],
  [/^(Lg|Lgo)\.?\s+/i, "Largo "],
  [/^(Tv|Trav)\.?\s+/i, "Travessa "],
  [/^(Estr)\.?\s+/i, "Estrada "],
  [/^(Al)\.?\s+/i, "Alameda "],
];

/**
 * Tidies a Portuguese address: expands common abbreviations ("R." → "Rua",
 * "Av." → "Avenida"…), formats postal codes as 0000-000 and collapses spaces.
 * Never invents information.
 */
export function normaliseAddress(address: string): string {
  let s = address.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim();
  for (const [re, full] of ABBREVIATIONS) s = s.replace(re, full);
  s = s.replace(/\b(\d{4})\s*[-–]?\s*(\d{3})\b/g, "$1-$2");
  return s.replace(/[,\s]+$/, "");
}

/** Collapses spaces and trims trailing punctuation in venue names. */
export function normaliseVenue(venue: string): string {
  return venue.replace(/\s+/g, " ").trim().replace(/[,.;:\s]+$/, "");
}

/** Canonical spelling of common Portuguese city names (others are kept as typed, first letter capitalised). */
const CITIES = [
  "Lisboa", "Porto", "Braga", "Coimbra", "Aveiro", "Faro", "Santarém", "Matosinhos", "Vila Nova de Gaia", "Gaia",
  "Almada", "Cascais", "Sintra", "Oeiras", "Amadora", "Odivelas", "Loures", "Setúbal", "Barreiro", "Seixal",
  "Leiria", "Viseu", "Évora", "Guimarães", "Funchal", "Ponta Delgada", "Portimão", "Santa Maria da Feira", "Maia",
  "Espinho", "Póvoa de Varzim", "Vila do Conde", "Viana do Castelo", "Bragança", "Castelo Branco", "Guarda",
  "Covilhã", "Beja", "Albufeira", "Lagos", "Tomar", "Torres Vedras", "Caldas da Rainha", "Figueira da Foz",
  "Ovar", "Valongo", "Gondomar", "Paredes", "Penafiel", "Alpiarça", "Cantanhede", "Estoril",
];
const CITY_ALIASES: Record<string, string> = { lisbon: "Lisboa", oporto: "Porto", setubal: "Setúbal", evora: "Évora" };

export function knownCities(): readonly string[] {
  return CITIES;
}

export function normaliseCity(city: string): string {
  const key = normaliseName(city);
  const alias = CITY_ALIASES[key];
  if (alias) return alias;
  const found = CITIES.find((c) => normaliseName(c) === key);
  if (found) return found;
  const s = city.replace(/\s+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
