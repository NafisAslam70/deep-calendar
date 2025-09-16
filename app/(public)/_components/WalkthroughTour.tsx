"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Step = {
  /** CSS selector for the element to highlight; leave empty/null to center the card */
  selector?: string;
  title: string;
  body: string;
};

export default function WalkthroughTour({
  open,
  onClose,
  steps,
  /** Optional offset from top of viewport to account for sticky headers */
  viewportOffset = 80,
}: {
  open: boolean;
  onClose: () => void;
  steps: Step[];
  viewportOffset?: number;
}) {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step = steps[idx];

  /** find the DOMRect for current step (if any) */
  const findRect = () => {
    const sel = step?.selector;
    if (!open || !sel) {
      setRect(null);
      return;
    }
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    setRect(el.getBoundingClientRect());
  };

  /** ensure the target is scrolled into view with header offset */
  const scrollTargetIntoView = () => {
    if (!open) return;
    const sel = step?.selector;
    if (!sel) return;
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const topVisible = r.top >= viewportOffset;
    const bottomVisible = r.bottom <= window.innerHeight - 16;

    if (!(topVisible && bottomVisible)) {
      const targetY = Math.max(0, r.top + window.scrollY - viewportOffset - 8);
      window.scrollTo({ top: targetY, behavior: "smooth" });
      // Recalculate after the smooth scroll likely finishes
      window.setTimeout(findRect, 350);
    } else {
      setRect(r);
    }
  };

  const next = () => setIdx((i) => Math.min(i + 1, steps.length - 1));
  const prev = () => setIdx((i) => Math.max(i - 1, 0));
  const finish = () => {
    onClose();
    setIdx(0);
    setRect(null);
  };

  /** remeasure on layout changes */
  useEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    findRect();
    const onLayout = () => findRect();
    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, true);
    return () => {
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idx, step?.selector]);

  /** lock background scroll while tour is open */
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  /** auto-scroll when the tour opens or the step changes */
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      scrollTargetIntoView();
    }, 50);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idx, step?.selector, viewportOffset]);

  /** Keyboard navigation (← → Esc) — declared BEFORE any early return */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idx]);

  // ---- render below (safe to early-return now; hooks above always run in same order)
  if (!open) return null;

  // Position the tooltip card: prefer below the target, otherwise center
  let cardStyle: React.CSSProperties = { maxWidth: 420 };
  let highlightStyle: React.CSSProperties | undefined;

  if (rect) {
    const margin = 10;
    const top = (() => {
      const below = rect.bottom + margin;
      const minTop = viewportOffset + 8;
      const maxTop = window.innerHeight - 220;
      return Math.min(Math.max(below, minTop), maxTop);
    })();
    const left = Math.min(
      Math.max(rect.left, 16),
      window.innerWidth - 420 - 16
    );
    cardStyle = {
      ...cardStyle,
      position: "fixed",
      top,
      left,
    };
    highlightStyle = {
      position: "fixed",
      top: rect.top - 6,
      left: rect.left - 6,
      width: rect.width + 12,
      height: rect.height + 12,
      border: "2px solid #000",
      borderRadius: 12,
      boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)",
      pointerEvents: "none",
      zIndex: 9999,
    };
  }

  return (
    <div
      aria-modal
      role="dialog"
      className="fixed inset-0 z-[9998] flex items-center justify-center"
    >
      {/* Dimmer (click to skip) */}
      {!rect && (
        <div
          className="absolute inset-0 bg-black/40"
          onClick={finish}
          aria-hidden
        />
      )}

      {/* Highlight box with large drop-shadow (when selector exists) */}
      {rect && <div style={highlightStyle} />}

      {/* Card */}
      <div
        className="rounded-2xl bg-white p-4 shadow-xl ring-1 ring-black/10"
        style={
          rect
            ? cardStyle
            : {
                ...cardStyle,
                position: "relative",
                zIndex: 9999,
              }
        }
      >
        <div className="text-sm text-gray-500">
          Step {idx + 1} of {steps.length}
        </div>
        <div className="mt-1 text-lg font-semibold">{step.title}</div>
        <div className="mt-1 text-sm text-gray-700">{step.body}</div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            className="rounded-lg border px-3 py-1.5 text-sm"
            onClick={finish}
          >
            Skip
          </button>
          <div className="flex gap-2">
            <button
              className="rounded-lg border px-3 py-1.5 text-sm"
              onClick={prev}
              disabled={idx === 0}
            >
              Back
            </button>
            {idx < steps.length - 1 ? (
              <button
                className="rounded-lg bg-black px-3 py-1.5 text-sm text-white"
                onClick={next}
              >
                Next
              </button>
            ) : (
              <button
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white"
                onClick={finish}
              >
                Finish
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
