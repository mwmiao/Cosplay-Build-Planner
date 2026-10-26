"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { ArrowUpIcon, GripIcon } from "./Icons";

export type SortableItem = { id: string; label: string; content: React.ReactNode };

/**
 * Manual ordering. Drag an item by its handle (mouse, pen or touch: pointer
 * events, so it works on phones), or use the arrow buttons (keyboard and
 * screen readers). Every change is saved right away through `onSave`.
 */
export function Sortable({
  items,
  layout = "list",
  onSave,
}: {
  items: SortableItem[];
  layout?: "list" | "grid";
  onSave: (ids: string[]) => Promise<{ ok: boolean }>;
}) {
  const { t } = useI18n();
  const S = t.sortable;
  const [order, setOrder] = useState(() => items.map((i) => i.id));
  const [dragging, setDragging] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // Controls stay disabled until hydrated, so an early tap isn't silently lost.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const byId = new Map(items.map((i) => [i.id, i]));

  // New items from the server (e.g. after an upload) join the end.
  useEffect(() => {
    setOrder((prev) => {
      const ids = items.map((i) => i.id);
      const kept = prev.filter((id) => ids.includes(id));
      return [...kept, ...ids.filter((id) => !kept.includes(id))];
    });
  }, [items]);

  const save = (next: string[]) => {
    clearTimeout(timer.current);
    setStatus("saving");
    timer.current = setTimeout(() => {
      startTransition(async () => {
        try {
          const res = await onSave(next);
          setStatus(res.ok ? "saved" : "error");
        } catch {
          setStatus("error");
        }
      });
    }, 350);
  };

  const move = (id: string, to: number) => {
    setOrder((prev) => {
      const from = prev.indexOf(id);
      if (from < 0 || to < 0 || to >= prev.length || from === to) return prev;
      const next = [...prev];
      next.splice(from, 1);
      next.splice(to, 0, id);
      return next;
    });
  };

  // Save once a drag ends (not on every intermediate move).
  const dragStartOrder = useRef<string[] | null>(null);
  const orderRef = useRef(order);
  orderRef.current = order;
  const endDrag = () => {
    if (!dragging) return;
    setDragging(null);
    const current = orderRef.current;
    if (dragStartOrder.current && dragStartOrder.current.join() !== current.join()) save(current);
    dragStartOrder.current = null;
  };

  const listClass =
    layout === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" : "space-y-2";

  return (
    <div>
      <p className="hint mb-2 flex items-center justify-between gap-2" aria-live="polite">
        <span>{S.hint}</span>
        <span className={status === "error" ? "font-medium text-red-600 dark:text-red-400" : ""}>
          {status === "saving" ? S.saving : status === "saved" ? S.saved : status === "error" ? S.error : ""}
        </span>
      </p>
      <ol className={listClass} data-testid="sortable">
        {order.map((id, index) => {
          const item = byId.get(id);
          if (!item) return null;
          return (
            <li
              key={id}
              data-sort-id={id}
              className={`card flex items-center gap-2 p-2 transition-shadow ${
                dragging === id ? "relative z-10 ring-2 ring-brand-500 shadow-lg" : ""
              } ${layout === "grid" ? "flex-col items-stretch" : ""}`}
            >
              <div className={layout === "grid" ? "flex items-center justify-between gap-1" : "contents"}>
                <button
                  type="button"
                  disabled={!ready}
                  aria-label={S.drag(item.label)}
                  className="flex h-11 w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 active:cursor-grabbing dark:hover:bg-zinc-800"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    dragStartOrder.current = order;
                    setDragging(id);
                  }}
                  onPointerMove={(e) => {
                    if (dragging !== id) return;
                    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-sort-id]");
                    const target = el?.dataset.sortId;
                    if (target && target !== id) move(id, order.indexOf(target));
                  }}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  <GripIcon className="h-5 w-5" />
                </button>
                {layout === "grid" ? <Arrows ready={ready} index={index} count={order.length} label={item.label} onMove={(to) => {
                  const next = [...order];
                  next.splice(index, 1);
                  next.splice(to, 0, id);
                  setOrder(next);
                  save(next);
                }} /> : null}
              </div>
              <div className="min-w-0 flex-1">{item.content}</div>
              {layout === "list" ? (
                <Arrows
                  ready={ready}
                  index={index}
                  count={order.length}
                  label={item.label}
                  onMove={(to) => {
                    const next = [...order];
                    next.splice(index, 1);
                    next.splice(to, 0, id);
                    setOrder(next);
                    save(next);
                  }}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Arrows({
  ready,
  index,
  count,
  label,
  onMove,
}: {
  ready: boolean;
  index: number;
  count: number;
  label: string;
  onMove: (to: number) => void;
}) {
  const { t } = useI18n();
  const S = t.sortable;
  const btn =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-800";
  return (
    <div className="flex shrink-0">
      <button type="button" className={btn} disabled={!ready || index === 0} onClick={() => onMove(index - 1)} aria-label={S.up(label)}>
        <ArrowUpIcon className="h-5 w-5" />
      </button>
      <button type="button" className={btn} disabled={!ready || index === count - 1} onClick={() => onMove(index + 1)} aria-label={S.down(label)}>
        <ArrowUpIcon className="h-5 w-5 rotate-180" />
      </button>
    </div>
  );
}
