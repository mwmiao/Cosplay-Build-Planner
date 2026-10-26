/** Lowercase, accent-free, letters and digits only: "IberAnime Porto 2026" → "iberanimeporto2026". */
export function normaliseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
