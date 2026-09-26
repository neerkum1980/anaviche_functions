import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { AuthBar } from "../auth.jsx";
import { common, useLang, useText } from "../i18n.jsx";

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
      <NavLink to="/manage">{t.nav.manage}</NavLink>
      <NavLink to="/accounting">{t.nav.accounting}</NavLink>
      <div className="lang-switch">
        <button type="button" onClick={() => setLang(lang === "de" ? "en" : "de")}>{t.switchTo}</button>
      </div>
    </nav>
  );
}

export default function Layout() {
  return (
    <>
      <Outlet />
      <footer>&copy; {new Date().getFullYear()} ANAVICHE AG. All rights reserved.</footer>
    </>
  );
}


// Blue title band used by the app pages, with the sign-in controls.
export function PageHeader({ title, subtitle }) {
  const t = useText(common);
  return (
    <>
      <header className="page-header">
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <AuthBar labels={t.auth} />
      </header>
      <Nav />
    </>
  );
}

// Card that fades in when it scrolls into view.
export function Panel({ id, children }) {
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
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id={id} ref={ref} className={`panel${visible ? " is-visible" : ""}`}>
      {children}
    </section>
  );
}
