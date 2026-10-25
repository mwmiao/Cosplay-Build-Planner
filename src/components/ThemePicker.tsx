"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";

type Theme = "system" | "light" | "dark";
const OPTIONS: Theme[] = ["system", "light", "dark"];

function apply(theme: Theme) {
  const dark =
    theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemePicker() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Follow live OS changes while on "System".
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  function choose(next: Theme) {
    setTheme(next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* storage unavailable */
    }
    apply(next);
  }

  return (
    <fieldset>
      <legend className="label">{t.settings.appearance}</legend>
      <div className="inline-flex rounded-xl border border-zinc-300 p-1 dark:border-zinc-700">
        {OPTIONS.map((o) => (
          <label
            key={o}
            className={`flex min-h-10 cursor-pointer items-center rounded-lg px-4 text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 ${
              theme === o ? "bg-brand-600 text-white" : "text-zinc-700 dark:text-zinc-300"
            }`}
          >
            <input
              type="radio"
              name="theme"
              value={o}
              checked={theme === o}
              onChange={() => choose(o)}
              className="sr-only"
            />
            {t.settings.theme[o]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
