import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { AuthBar } from "../auth.jsx";
import { ADMIN_ENABLED } from "../config.js";
import { common, useLang, useText } from "../i18n.jsx";
import { images } from "../images.js";

export function Nav() {
  const { lang, setLang } = useLang();
  const t = common[lang];
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={scrolled ? "scrolled" : ""}>
      <NavLink to="/" end>{t.nav.home}</NavLink>
      <NavLink to="/about">{t.nav.about}</NavLink>
      <NavLink to="/properties">{t.nav.properties}</NavLink>
      <NavLink to="/analytics">{t.nav.analytics}</NavLink>
      {/* Full page load, so Cloudflare Access (which protects this page in prod) sees the request. */}
      <NavLink to="/manage" reloadDocument>{t.nav.manage}</NavLink>
      <NavLink to="/accounting">{t.nav.accounting}</NavLink>
      {ADMIN_ENABLED && <NavLink to="/admin">{t.nav.admin}</NavLink>}
      <div className="lang-switch">
        <button type="button" onClick={() => setLang(lang === "de" ? "en" : "de")}>{t.switchTo}</button>
      </div>
    </nav>
  );
}

function PhotoCredits() {
  const { lang } = useLang();
  return (
    <details className="credits">
      <summary>{lang === "de" ? "Bildnachweise" : "Photo credits"}</summary>
      <ul>
        {Object.values(images).map((img) => (
          <li key={img.src}>
            <a href={img.page} target="_blank" rel="noopener noreferrer">{img.alt[lang]}</a>
            {" – "}{img.author}, <a href={img.licenseUrl} target="_blank" rel="noopener noreferrer">{img.license}</a>
            {lang === "de" ? ", via Wikimedia Commons (verkleinert)" : ", via Wikimedia Commons (resized)"}
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function Layout() {
  return (
    <>
      <Outlet />
      <footer>
        <p>&copy; {new Date().getFullYear()} ANAVICHE AG. All rights reserved.</p>
        <PhotoCredits />
      </footer>
    </>
  );
}

// Blue title band used by the app pages, with the sign-in controls.
export function PageHeader({ title, subtitle }) {
  const t = useText(common);
  return (
    <>
      <header className="page-header" style={{ "--bg": `url(${images.zurich.src})` }}>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <AuthBar labels={t.auth} />
      </header>
      <Nav />
    </>
  );
}

// True once the element has scrolled into view (and stays true).
export function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, visible];
}

// Fades and slides its content in when it scrolls into view; delay staggers siblings.
export function Reveal({ as: Tag = "div", className = "", delay = 0, children, ...props }) {
  const [ref, visible] = useInView();
  return (
    <Tag
      ref={ref}
      className={`reveal${visible ? " is-visible" : ""} ${className}`.trim()}
      style={{ transitionDelay: `${delay}ms` }}
      {...props}
    >
      {children}
    </Tag>
  );
}

// Card that fades in when it scrolls into view.
export function Panel({ id, children }) {
  return (
    <Reveal as="section" id={id} className="panel">
      {children}
    </Reveal>
  );
}
