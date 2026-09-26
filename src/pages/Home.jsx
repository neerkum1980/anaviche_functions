import { Link } from "react-router-dom";
import { Nav, Panel } from "../components/Layout.jsx";
import { useText } from "../i18n.jsx";

const texts = {
  de: {
    tagline: "Investitionen in Mehrfamilienhäuser & hochwertige möblierte Vermietungen in der Schweiz",
    cta: "Unsere Immobilien ansehen",
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

function CheckList({ items }) {
  return (
    <ul className="list-check">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

export default function Home() {
  const t = useText(texts);

  return (
    <>
      <div className="hero">
        <div className="hero-overlay">
          <header>
            <h1>Anaviche AG</h1>
            <p>{t.tagline}</p>
          </header>
          <Link to="/properties" className="cta">{t.cta}</Link>
        </div>
      </div>
      <Nav />

      <main>
        <Panel id="overview">
          <h2>{t.focus.title}</h2>
          <p>{t.focus.intro}</p>
          <CheckList items={t.focus.points} />
        </Panel>

        <Panel id="services">
          <h2>{t.services.title}</h2>
          <p>{t.services.intro}</p>
          <CheckList items={t.services.points} />
        </Panel>

        <Panel id="invest">
          <h2>{t.invest.title}</h2>
          <p>{t.invest.intro}</p>
          <CheckList items={t.invest.points} />
          <h3>{t.invest.howTitle}</h3>
          <ol>
            {t.invest.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
          <p><strong>{t.invest.contact}</strong> anavicheag@outlook.com</p>
        </Panel>

        <Panel id="market">
          <h2>{t.market.title}</h2>
          <p>{t.market.intro}</p>
          <div className="chart">
            {vacancyRates.map(({ year, rate }) => (
              <div className="chart-row" key={year}>
                <span className="chart-label">{year}</span>
                <div className="chart-bar" style={{ width: `${rate * 10}%` }}>
                  {String(rate).replace(".", t.market.decimal)}%
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel id="news">
          <h2>{t.news.title}</h2>
          <p>{t.news.intro}</p>
          <CheckList items={t.news.points} />
        </Panel>
      </main>
    </>
  );
}
