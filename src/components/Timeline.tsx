// Progress-photo timeline, oldest first, grouped by day. Used on the owner's
// project page (with edit controls per photo) and on public project pages,
// including the publish preview (client), so it has no hooks of its own.
import type { Dict } from "@/i18n";
import type { Formatters } from "@/lib/format";
import { LightboxGroup, LightboxThumb } from "./Lightbox";

export type TimelineItem = {
  id: string;
  thumbUrl: string;
  fullUrl: string;
  caption: string | null;
  stage: string | null;
  /** ISO date of the day the photo shows */
  date: string;
};

export function Timeline({
  items,
  t,
  f,
  actions,
}: {
  items: TimelineItem[];
  t: Dict;
  f: Formatters;
  /** Extra controls under each photo (owner's page) */
  actions?: (item: TimelineItem) => React.ReactNode;
}) {
  const days: { day: string; items: (TimelineItem & { index: number })[] }[] = [];
  items.forEach((item, index) => {
    const day = item.date.slice(0, 10);
    const last = days[days.length - 1];
    if (last?.day === day) last.items.push({ ...item, index });
    else days.push({ day, items: [{ ...item, index }] });
  });
  const lightbox = items.map((i) => ({
    id: i.id,
    src: i.fullUrl,
    thumb: i.thumbUrl,
    caption: [i.stage, i.caption].filter(Boolean).join(" · ") || null,
    alt: i.caption ?? i.stage ?? t.refs.progressAlt,
  }));
  return (
    <LightboxGroup images={lightbox}>
      <ol className="relative space-y-6 border-l-2 border-brand-200 pl-5 dark:border-brand-900" data-testid="timeline">
        {days.map((d) => (
          <li key={d.day} className="relative">
            <span
              aria-hidden="true"
              className="absolute -left-[29px] top-1 h-4 w-4 rounded-full border-2 border-white bg-brand-500 dark:border-zinc-950"
            />
            <h3 className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
              <time dateTime={d.day}>{f.date(new Date(`${d.day}T00:00:00.000Z`))}</time>
            </h3>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {d.items.map((item) => (
                <li key={item.id} className="card flex flex-col gap-1.5 p-2" data-testid="timeline-item">
                  <LightboxThumb index={item.index} label={t.lightbox.open(item.caption ?? item.stage ?? t.refs.progressAlt)}>
                    <img src={item.thumbUrl} alt={item.caption ?? item.stage ?? ""} loading="lazy" className="aspect-square w-full object-cover" />
                  </LightboxThumb>
                  {item.stage ? (
                    <span className="self-start rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                      {item.stage}
                    </span>
                  ) : null}
                  {item.caption ? <p className="break-words px-0.5 text-sm">{item.caption}</p> : null}
                  {actions ? actions(item) : null}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </LightboxGroup>
  );
}
