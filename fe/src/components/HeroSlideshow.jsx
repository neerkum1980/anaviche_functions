import { useEffect, useState } from "react";
import { useLang } from "../i18n.jsx";

const INTERVAL_MS = 6000;

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

// Full-width hero with crossfading photos; children are laid over the images.
export default function HeroSlideshow({ slides, children }) {
  const { lang } = useLang();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || slides.length < 2 || prefersReducedMotion()) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [paused, slides.length]);

  return (
    <div className="hero-slideshow" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {slides.map((img, i) => (
        <img
          key={img.src}
          src={img.src}
          alt={i === index ? img.alt[lang] : ""}
          aria-hidden={i !== index}
          className={`hero-slide${i === index ? " active" : ""}`}
          loading={i === 0 ? "eager" : "lazy"}
          fetchpriority={i === 0 ? "high" : undefined}
        />
      ))}
      <div className="hero-shade" />
      <div className="hero-content">{children}</div>
      <p className="hero-caption">{slides[index].alt[lang]}</p>
      <div className="hero-dots">
        {slides.map((img, i) => (
          <button
            key={img.src}
            type="button"
            className={i === index ? "active" : ""}
            aria-label={img.alt[lang]}
            aria-current={i === index}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}
