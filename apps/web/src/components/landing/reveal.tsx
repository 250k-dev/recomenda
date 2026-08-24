"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Fades + lifts its children into view on first scroll intersection.
 * The hidden initial state lives in CSS under `.js [data-reveal]`, so visitors
 * (or crawlers) without JavaScript always see fully rendered content.
 *
 * Initial state is always `false` on server and client — `IntersectionObserver`
 * does not exist during SSR, and treating that as "visible" hydrates a mismatch.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal
      className={visible ? `is-visible ${className ?? ""}`.trim() : className}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
