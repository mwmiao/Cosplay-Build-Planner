"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { ChevronLeftIcon, XIcon } from "./Icons";

export type LightboxImage = { id: string; src: string; thumb?: string; caption?: string | null; alt: string };

const Ctx = createContext<((index: number) => void) | null>(null);

/**
 * Opens images full-screen inside the app (instead of a new browser tab).
 * Wrap a gallery in <LightboxGroup images>, and make each thumbnail a
 * <LightboxThumb index>. Keyboard: ← → to browse, Esc to close; swipe on phones.
 */
export function LightboxGroup({ images, children }: { images: LightboxImage[]; children: React.ReactNode }) {
  const [index, setIndex] = useState<number | null>(null);
  return (
    <Ctx.Provider value={setIndex}>
      {children}
      {index !== null && images[index] ? (
        <Viewer images={images} index={index} onIndex={setIndex} onClose={() => setIndex(null)} />
      ) : null}
    </Ctx.Provider>
  );
}

export function LightboxThumb({
  index,
  label,
  className,
  children,
}: {
  index: number;
  /** Accessible name, e.g. "View image: caption" */
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const open = useContext(Ctx);
  return (
    <button
      type="button"
      onClick={() => open?.(index)}
      aria-label={label}
      aria-haspopup="dialog"
      className={`block w-full cursor-zoom-in overflow-hidden rounded-xl text-left ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

function Viewer({
  images,
  index,
  onIndex,
  onClose,
}: {
  images: LightboxImage[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const L = t.lightbox;
  const img = images[index]!;
  const many = images.length > 1;
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);

  const go = useCallback(
    (step: number) => onIndex((index + step + images.length) % images.length),
    [index, images.length, onIndex],
  );

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && many) go(1);
      else if (e.key === "ArrowLeft" && many) go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, many, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={img.caption || img.alt}
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95 text-white backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (!many || start === null || end === undefined || Math.abs(end - start) < 50) return;
        go(end < start ? 1 : -1);
      }}
      data-testid="lightbox"
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="text-sm tabular-nums text-zinc-300" aria-live="polite">
          {many ? L.counter(index + 1, images.length) : ""}
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          aria-label={L.close}
        >
          <XIcon className="h-6 w-6" />
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-2 py-3 sm:px-16"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <img
          key={img.id}
          src={img.src}
          alt={img.alt}
          className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          style={img.thumb ? { backgroundImage: `url(${img.thumb})`, backgroundSize: "cover" } : undefined}
        />
        {many ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 sm:flex"
              aria-label={L.previous}
            >
              <ChevronLeftIcon className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 sm:flex"
              aria-label={L.next}
            >
              <ChevronLeftIcon className="h-6 w-6 rotate-180" />
            </button>
          </>
        ) : null}
      </div>

      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center">
        {img.caption ? <p className="mx-auto max-w-2xl whitespace-pre-wrap break-words text-sm">{img.caption}</p> : null}
        {many ? (
          <div className="mt-3 flex justify-center gap-3 sm:hidden">
            <button type="button" onClick={() => go(-1)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10" aria-label={L.previous}>
              <ChevronLeftIcon className="h-6 w-6" />
            </button>
            <button type="button" onClick={() => go(1)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10" aria-label={L.next}>
              <ChevronLeftIcon className="h-6 w-6 rotate-180" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
