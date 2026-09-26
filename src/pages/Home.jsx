import { Link } from "react-router-dom";
import HeroSlideshow from "../components/HeroSlideshow.jsx";
import { Nav, Panel, Reveal, useInView } from "../components/Layout.jsx";
import { useLang, useText } from "../i18n.jsx";
import { images } from "../images.js";

const texts = {
  de: {
    tagline: "Investitionen in Mehrfamilienhäuser & hochwertige möblierte Vermietungen in der Schweiz",
    cta: "Unsere Immobilien ansehen",
    ctaContact: "Kontakt aufnehmen",
    serviceTitles: ["Möbliertes Wohnen", "Bewirtschaftung", "Marktanalysen"],
    focus: {
      title: "Unser Investitionsfokus",
      intro: "Anaviche AG erwirbt und entwickelt Mehrfamilienhäuser in gut angebundenen Schweizer Lagen. Wir bieten moderne, möblierte Wohnlösungen für Berufstätige, Familien im Umzug und langfristige Mieterinnen und Mieter.",
      points: [
        "Disziplinierte Akquisitionen in stabilen Mietmärkten.",
        "Gezielte Modernisierungen für Komfort und Effizienz.",
        "Mieterorientiertes Management mit transparentem Service.",
      ],
    },
    services: {
      title: "Was wir bieten",
      intro: "Unser Portfolio verbindet hochwertige Wohnqualität mit operativer Exzellenz für stabile Erträge und hohe Auslastung.",
      points: [
        "Möblierte Zimmer und Apartments mit flexiblen Laufzeiten.",
        "Professionelles Property Management und Instandhaltung.",
        "Datenbasierte Marktanalysen für Investmententscheidungen.",
      ],
    },
    invest: {
      title: "Privater Finanzierungsrunde",
      intro: "Wir prüfen Investitionsmöglichkeiten im Rahmen privater Finanzierungsrunden für ausgewählte Objekte. Interessierte Partner können sich beteiligen und gemeinsam mit uns in nachhaltige Wohnimmobilien investieren.",
      points: [
        "Deal-spezifische Beteiligungen mit klaren Konditionen.",
        "Transparente Projektprüfung und laufendes Reporting.",
        "Langfristige Ausrichtung auf stabile Mieterträge.",
      ],
      howTitle: "So funktioniert es",
      benefitsTitle: "Ihre Vorteile",
      steps: [
        "Wir stellen eine konkrete Objektchance mit Eckdaten vor.",
        "Interessierte Partner prüfen die Unterlagen und Konditionen.",
        "Nach Zusage erfolgt die Zeichnung und der Ankauf.",
        "Wir berichten regelmäßig über Performance und Vermietung.",
      ],
      contact: "Kontakt:",
    },
    market: {
      title: "Schweizer Mietmarkt – Leerstandsquote",
      intro: "Die Leerstandsquote ist ein zentraler Indikator für die Nachfrage. Unten finden Sie eine einfache Übersicht aktueller Trends (Beispieldaten; können durch echte Marktwerte ersetzt werden).",
      decimal: ",",
    },
    news: {
      title: "Marktnews",
      intro: "Auszüge aus dem Schweizer und europäischen Immobilienmarkt (Platzhalter-Headline – kann mit aktuellen Quellen ergänzt werden).",
      points: [
        "Die Nachfrage nach Qualitätsmieten bleibt in urbanen Kantonen hoch und stützt die Auslastung.",
        "Energieeffiziente Sanierungen steigern den Wert und senken Betriebskosten.",
        "Institutionelle Investoren fokussieren weiterhin robuste Mehrfamilien-Portfolios in Europa.",
        "Die Nachfrage nach möblierten, flexiblen Mietmodellen wächst weiter.",
      ],
    },
  },
  en: {
    tagline: "Investing in Multifamily Properties & Offering Quality Furnished Rentals Across Switzerland",
    cta: "View Our Properties",
    ctaContact: "Get in touch",
    serviceTitles: ["Furnished living", "Property management", "Market insights"],
    focus: {
      title: "Our Investment Focus",
      intro: "Anaviche AG acquires and enhances multifamily properties in well-connected Swiss locations. We deliver modern, furnished living spaces designed for professionals, relocating families, and long-term tenants.",
      points: [
        "Disciplined acquisitions in resilient rental markets.",
        "Thoughtful renovations that improve comfort and efficiency.",
        "Tenant-first management with reliable, transparent service.",
      ],
    },
    services: {
      title: "What We Offer",
      intro: "Our portfolio combines quality housing with operational excellence to create stable returns and strong occupancy.",
      points: [
        "Furnished rooms and apartments with flexible leasing.",
        "Professional property management and maintenance.",
        "Data-driven market insights to guide investment decisions.",
      ],
    },
    invest: {
      title: "Private Funding Round",
      intro: "We review investment opportunities through private funding rounds for selected properties. Partners can participate alongside us to support sustainable, income-focused residential assets.",
      points: [
        "Deal-specific participation with clear terms.",
        "Transparent due diligence and ongoing reporting.",
        "Long-term focus on stable rental income.",
      ],
      howTitle: "How it works",
      benefitsTitle: "Your benefits",
      steps: [
        "We present a specific property opportunity with key metrics.",
        "Interested partners review documents and terms.",
        "Commitments are confirmed and the acquisition is closed.",
        "We provide ongoing performance and occupancy updates.",
      ],
      contact: "Contact:",
    },
    market: {
      title: "Swiss Rental Market – Vacancy Rate",
      intro: "Vacancy rates are a key indicator for rental demand. Below is a simple snapshot of recent vacancy rate trends (illustrative layout; data can be replaced with updated market figures).",
      decimal: ".",
    },
    news: {
      title: "Market News",
      intro: "Highlights from the Swiss and European property markets (placeholder headlines — can be updated with live sources or recent reports).",
      points: [
        "Demand for quality rentals remains strong in urban Swiss cantons, supporting stable occupancy.",
        "Energy-efficiency upgrades continue to improve asset value and reduce operating costs.",
        "Institutional investors are focusing on resilient multifamily portfolios in key European cities.",
        "Tenant preferences show growing interest in furnished, flexible-term leasing options.",
      ],
    },
  },
};

// Sample vacancy rates in percent (placeholder data, as on the old page).
const vacancyRates = [
  { year: 2022, rate: 1.8 },
  { year: 2023, rate: 1.6 },
  { year: 2024, rate: 1.4 },
  { year: 2025, rate: 1.3 },
];
const maxRate = Math.max(...vacancyRates.map((v) => v.rate));

const heroSlides = [images.pilatus, images.zurich, images.luzern, images.zugersee];
const serviceImages = [images.livingRoom, images.kitchen, images.grossmuenster];

function CheckList({ items }) {
  return (
    <ul className="list-check">
      {items.map((item, i) => (
        <Reveal as="li" key={item} delay={i * 90}>{item}</Reveal>
      ))}
    </ul>
  );
}

function VacancyChart({ decimal }) {
  const [ref, visible] = useInView(0.3);
  return (
    <div className="chart" ref={ref}>
      {vacancyRates.map(({ year, rate }, i) => (
        <div className="chart-row" key={year}>
          <span className="chart-label">{year}</span>
          <div className="chart-track">
            <div
              className="chart-bar"
              style={{ width: visible ? `${(rate / maxRate) * 100}%` : "0%", transitionDelay: `${i * 120}ms` }}
            >
              {String(rate).replace(".", decimal)}%
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const t = useText(texts);
  const { lang } = useLang();

  return (
    <>
      <HeroSlideshow slides={heroSlides}>
        <header className="hero-text">
          <h1>Anaviche AG</h1>
          <p>{t.tagline}</p>
        </header>
        <div className="hero-actions">
          <Link to="/properties" className="cta">{t.cta}</Link>
          <Link to="/about#contact" className="cta cta-ghost">{t.ctaContact}</Link>
        </div>
      </HeroSlideshow>
      <Nav />

      <main className="home">
        <section id="overview" className="split">
          <Reveal className="split-media">
            <img src={images.multifamily.src} alt={images.multifamily.alt[lang]} loading="lazy" />
          </Reveal>
          <Reveal className="split-text" delay={120}>
            <h2>{t.focus.title}</h2>
            <p>{t.focus.intro}</p>
            <CheckList items={t.focus.points} />
          </Reveal>
        </section>

        <section id="services">
          <Reveal>
            <h2>{t.services.title}</h2>
            <p className="lead">{t.services.intro}</p>
          </Reveal>
          <div className="feature-grid">
            {t.services.points.map((point, i) => (
              <Reveal as="article" className="feature-card" key={point} delay={i * 120}>
                <div className="feature-media">
                  <img src={serviceImages[i].src} alt={serviceImages[i].alt[lang]} loading="lazy" />
                </div>
                <div className="feature-body">
                  <h3>{t.serviceTitles[i]}</h3>
                  <p>{point}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      </main>

      <section id="invest" className="parallax" style={{ "--bg": `url(${images.zugersee.src})` }}>
        <Reveal className="parallax-content">
          <h2>{t.invest.title}</h2>
          <p>{t.invest.intro}</p>
        </Reveal>
      </section>

      <main className="home">
        <section className="invest-details">
          <Reveal as="h3" className="steps-title">{t.invest.howTitle}</Reveal>
          <ol className="steps">
            {t.invest.steps.map((step, i) => (
              <Reveal as="li" key={step} delay={i * 120}>
                <p>{step}</p>
              </Reveal>
            ))}
          </ol>
          <Reveal className="invest-points">
            <h3>{t.invest.benefitsTitle}</h3>
            <CheckList items={t.invest.points} />
            <p className="contact-line">
              <strong>{t.invest.contact}</strong>{" "}
              <a href="mailto:anavicheag@outlook.com">anavicheag@outlook.com</a>
            </p>
          </Reveal>
        </section>

        <div className="two-col">
          <Panel id="market">
            <h2>{t.market.title}</h2>
            <p>{t.market.intro}</p>
            <VacancyChart decimal={t.market.decimal} />
          </Panel>

          <Panel id="news">
            <h2>{t.news.title}</h2>
            <p>{t.news.intro}</p>
            <CheckList items={t.news.points} />
          </Panel>
        </div>
      </main>
    </>
  );
}
