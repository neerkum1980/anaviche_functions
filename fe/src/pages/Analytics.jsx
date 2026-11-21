import { Nav, Reveal } from "../components/Layout.jsx";
import { images } from "../images.js";
import { useText } from "../i18n.jsx";

const HOUSING_URL = "https://www.bfs.admin.ch/bfs/en/home/statistics/construction-housing.html";
const PRICE_INDEX_URL = "https://www.bfs.admin.ch/bfs/en/home/statistics/prices/property-price.html";

const texts = {
  de: {
    title: "Immobilien-Analysen",
    intro: "Aktuelle Kennzahlen und Berichte auf Basis der Statistiken des Schweizer Bundesamts für Statistik (BFS). Die Quellen öffnen in einem neuen Tab.",
    sectionTitle: "Kennzahlen & Berichte (BFS)",
    cards: [
      { title: "Bau- und Wohnungswesen", text: "Überblick zu Wohngebäuden, Leerstandsquoten, Mieten und Eigentumsquote.", link: "Zur BFS-Übersicht", url: HOUSING_URL },
      { title: "Leerwohnungszählung", text: "Aktuelle Informationen zur Leerstandsquote und zum Wohnungsbestand.", link: "Aktuelle Leerstandsdaten", url: HOUSING_URL },
      { title: "Wohnimmobilienpreisindex", text: "Der IMPI misst die Preisentwicklung von Wohnimmobilien in der Schweiz.", link: "Zum Preisindex (IMPI)", url: PRICE_INDEX_URL },
    ],
  },
  en: {
    title: "Real Estate Analytics",
    intro: "Current indicators and reports based on official Swiss Federal Statistical Office (FSO) data sources. Links open in a new tab.",
    sectionTitle: "Key Data & Reports (FSO)",
    cards: [
      { title: "Construction & Housing", text: "Overview of residential buildings, vacancy rates, rents, and ownership levels.", link: "Open FSO Overview", url: HOUSING_URL },
      { title: "Vacant Dwellings Census", text: "Latest information on vacancy rates and dwelling stock.", link: "Open vacancy data", url: HOUSING_URL },
      { title: "Residential Property Price Index", text: "The IMPI tracks quarterly residential property price changes in Switzerland.", link: "Open IMPI index", url: PRICE_INDEX_URL },
    ],
  },
};

export default function Analytics() {
  const t = useText(texts);

  return (
    <>
      <Nav />
      <section className="banner" style={{ "--bg": `url(${images.grossmuenster.src})` }}>
        <Reveal className="banner-content">
          <h1>{t.title}</h1>
          <p>{t.intro}</p>
        </Reveal>
      </section>
      <main>
        <section>
          <Reveal as="h2">{t.sectionTitle}</Reveal>
          <div className="grid">
            {t.cards.map((card, i) => (
              <Reveal as="div" className="card" key={card.title} delay={i * 120}>
                <span className="card-number">{String(i + 1).padStart(2, "0")}</span>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
                <a href={card.url} target="_blank" rel="noopener noreferrer">{card.link} →</a>
              </Reveal>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
