import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/**
 * Writes scroll progress for an element into the CSS variable --p:
 * 0 when its top edge sits at `start` (fraction of viewport height from the
 * top) and 1 when it reaches `end`. CSS calc() turns --p into transforms, so
 * scrolling never re-renders React.
 */
export function useScrollProgress<T extends HTMLElement>(start = 1, end = 0.25) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion()) {
      el.style.setProperty("--p", "1");
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight || 1;
      const top = el.getBoundingClientRect().top;
      const p = Math.min(1, Math.max(0, (start * vh - top) / ((start - end) * vh)));
      el.style.setProperty("--p", p.toFixed(4));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [start, end]);
  return ref;
}

/**
 * Moves an element down by `factor` × page scroll while the page is near the
 * top, so it sinks slower than the content (clouds drifting downward).
 */
export function useParallax<T extends HTMLElement>(factor: number, max = 900) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || factor === 0) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = Math.min(window.scrollY, max) * factor;
      el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [factor, max]);
  return ref;
}

/** Fades and lifts its children in the first time they scroll into view. */
export function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  // Without IntersectionObserver (old browsers, tests) or with reduced motion, just show it.
  const [visible, setVisible] = useState(
    () => typeof IntersectionObserver === "undefined" || reducedMotion()
  );
  useEffect(() => {
    if (visible || !ref.current) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [visible]);
  const style: CSSProperties | undefined = delay ? { transitionDelay: `${delay}ms` } : undefined;
  return (
    <Tag ref={ref} style={style} className={`reveal ${visible ? "is-visible" : ""} ${className}`}>
      {children}
    </Tag>
  );
}
