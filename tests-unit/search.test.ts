import { describe, expect, it } from "vitest";
import { searchKey } from "@/lib/searchText";

describe("searchKey", () => {
  it("ignores case and accents so Portuguese searches match either way", () => {
    expect(searchKey("PÁGINA")).toBe(searchKey("página"));
    expect(searchKey("página")).toBe("pagina");
    expect(searchKey("Álvaro Conceição")).toBe("alvaro conceicao");
    expect(searchKey("Ações")).toBe("acoes");
  });
  it("handles empty and plain text", () => {
    expect(searchKey(null)).toBe("");
    expect(searchKey(undefined)).toBe("");
    expect(searchKey("Cloud Strife")).toBe("cloud strife");
  });
  it("matching is a substring test on the keys", () => {
    expect(searchKey("Armadura da Sacerdotisa Ámbar").includes(searchKey("AMBAR"))).toBe(true);
    expect(searchKey("Armadura").includes(searchKey("zelda"))).toBe(false);
  });
});
