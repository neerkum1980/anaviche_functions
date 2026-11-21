import ChatPanel from "../components/ChatPanel.jsx";
import { PageHeader } from "../components/Layout.jsx";
import { RequireSignIn } from "../auth.jsx";
import { common, useLang } from "../i18n.jsx";
import { useProperties } from "../useProperties.js";

const texts = {
  de: {
    title: "Unsere Immobilien",
    subtitle: "Entdecken Sie das Portfolio von ANAVICHE AG mit Mehrfamilienhäusern und möblierten Vermietungen in der Schweiz.",
    listTitle: "Verfügbare Immobilien",
    columns: ["Name", "Standort", "Einheiten", "Beschreibung"],
    loading: "Immobilien werden geladen...",
    empty: "Keine Immobilien gefunden.",
    failed: "Immobilien konnten nicht geladen werden.",
  },
  en: {
    title: "Our Properties",
    subtitle: "Explore the ANAVICHE AG portfolio of multifamily homes and furnished rentals across Switzerland.",
    listTitle: "Available Properties",
    columns: ["Name", "Location", "Units", "Description"],
    loading: "Loading properties...",
    empty: "No properties found.",
    failed: "Failed to load properties.",
  },
};

function PropertyTable({ t }) {
  const { properties, loading, error } = useProperties();
  const message = loading ? t.loading : error ? t.failed : properties.length === 0 ? t.empty : null;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{t.columns.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {message ? (
            <tr><td colSpan={4}>{message}</td></tr>
          ) : (
            properties.map((p) => (
              <tr key={p.RowKey}>
                <td>{p.Name}</td>
                <td>{p.Location}</td>
                <td>{p.Units}</td>
                <td>{p.Description}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function Properties() {
  const { lang } = useLang();
  const t = texts[lang];

  return (
    <>
      <PageHeader title={t.title} subtitle={t.subtitle} />
      <main>
        <h2>{t.listTitle}</h2>
        <RequireSignIn message={common[lang].pleaseSignIn}>
          <PropertyTable t={t} />
          <ChatPanel />
        </RequireSignIn>
      </main>
    </>
  );
}
