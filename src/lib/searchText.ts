/**
 * Text for matching searches: lower case with accents removed, so "página",
 * "PÁGINA" and "pagina" all match each other (SQLite's own LIKE only ignores
 * case for plain A–Z).
 */
export function searchKey(text: string | null | undefined): string {
  return (text ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
