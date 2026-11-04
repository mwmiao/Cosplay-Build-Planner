import { describe, expect, it } from "vitest";
import { en } from "@/i18n/en";
import { ptPT } from "@/i18n/pt-PT";

// Every key in English must exist in Portuguese with the same kind of value
// (text, function with the same number of arguments, list, or nested group), and vice versa.
function shape(value: unknown, path: string, out: string[]): void {
  if (typeof value === "function") out.push(`${path}: fn/${value.length}`);
  else if (Array.isArray(value)) out.push(`${path}: array`);
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) shape(v, path ? `${path}.${k}` : k, out);
  else out.push(`${path}: ${typeof value}`);
}
const list = (dict: unknown) => {
  const out: string[] = [];
  shape(dict, "", out);
  return out.sort();
};

describe("translations", () => {
  const a = list(en);
  const b = list(ptPT);
  it("English and Portuguese have the same keys", () => {
    const keys = (l: string[]) => new Set(l.map((x) => x.split(":")[0]));
    const kb = keys(b);
    const ka = keys(a);
    expect(a.filter((x) => !kb.has(x.split(":")[0]))).toEqual([]); // missing in pt-PT
    expect(b.filter((x) => !ka.has(x.split(":")[0]))).toEqual([]); // missing in en
  });
  it("values have the same kind (text vs function arguments)", () => {
    expect(b).toEqual(a);
  });
  it("no empty text", () => {
    const empty = (d: unknown, path = ""): string[] =>
      typeof d === "string" ? (d.trim() === "" && !path.endsWith(".none") ? [path] : []) : d && typeof d === "object" ? Object.entries(d).flatMap(([k, v]) => empty(v, path ? `${path}.${k}` : k)) : [];
    // Some keys are intentionally empty (e.g. "no suffix"); list them here if they appear.
    expect(empty(ptPT).sort()).toEqual(empty(en).sort());
  });
});
