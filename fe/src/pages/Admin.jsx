import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../components/Layout.jsx";
import { ApiError, RequireSignIn, useApi } from "../auth.jsx";
import { common, useLang } from "../i18n.jsx";

const texts = {
  de: {
    title: "Plattform-Admin",
    subtitle: "Kunden der ANAVICHE-Plattform verwalten und neue Kunden aufnehmen.",
    listTitle: "Kunden",
    columns: ["Kunde", "Name", "Status", "Website", "Angefragt von", "Aktualisiert"],
    loading: "Kunden werden geladen...",
    empty: "Noch keine Kunden.",
    refresh: "Aktualisieren",
    master: "Master",
    open: "Öffnen",
    details: "Details",
    status: {
      requested: "Angefragt",
      provisioning: "Wird eingerichtet",
      ready: "Bereit",
      failed: "Fehlgeschlagen",
    },
    formTitle: "Neuen Kunden aufnehmen",
    formHelp:
      "Erstellt eine eigene Umgebung mit eigenem Speicher und eigener Anmeldung. Die Einrichtung startet innerhalb von 15 Minuten und dauert etwa 10 Minuten. Die erste Benutzerin oder der erste Benutzer erhält eine Einladung per E-Mail.",
    clientId: "Kunden-ID",
    clientIdHelp: "3–12 Kleinbuchstaben oder Ziffern, z. B. acme. Wird in Ressourcennamen verwendet und kann nicht geändert werden.",
    clientName: "Name",
    adminEmail: "E-Mail der ersten Benutzerin / des ersten Benutzers",
    submit: "Kunden anfragen",
    requested: (c) => `${c} wurde angefragt. Der Status aktualisiert sich hier.`,
    noRole: "Diese Seite ist Plattform-Admins vorbehalten (Rolle Platform.Admin).",
    failed: "Fehler: ",
  },
  en: {
    title: "Platform admin",
    subtitle: "Manage the clients of the ANAVICHE platform and onboard new ones.",
    listTitle: "Clients",
    columns: ["Client", "Name", "Status", "Site", "Requested by", "Updated"],
    loading: "Loading clients...",
    empty: "No clients yet.",
    refresh: "Refresh",
    master: "Master",
    open: "Open",
    details: "Details",
    status: {
      requested: "Requested",
      provisioning: "Provisioning",
      ready: "Ready",
      failed: "Failed",
    },
    formTitle: "Onboard a new client",
    formHelp:
      "Creates a separate stack with its own storage and sign-in. Provisioning starts within 15 minutes and takes about 10 minutes. The first user gets an email invitation.",
    clientId: "Client id",
    clientIdHelp: "3–12 lowercase letters or digits, e.g. acme. Used in resource names; it can't be changed later.",
    clientName: "Name",
    adminEmail: "First user's email",
    submit: "Request client",
    requested: (c) => `${c} was requested. Its status updates here.`,
    noRole: "This page is for platform admins (Platform.Admin role).",
    failed: "Failed: ",
  },
};

const empty = { client: "", clientName: "", adminEmail: "" };

function errorMessage(err, t) {
  if (err instanceof ApiError && err.status === 403) return t.noRole;
  try {
    return t.failed + JSON.parse(err.message.replace(/^API error \d+: /, "")).error;
  } catch {
    return t.failed + err.message;
  }
}

function formatTime(value, lang) {
  return value ? new Date(value).toLocaleString(lang === "de" ? "de-CH" : "en-GB") : "";
}

function ClientTable({ t, lang, clients, loading }) {
  const message = loading ? t.loading : clients.length === 0 ? t.empty : null;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{t.columns.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {message ? (
            <tr><td colSpan={t.columns.length}>{message}</td></tr>
          ) : (
            clients.map((c) => (
              <tr key={c.client}>
                <td>{c.client}{c.master ? ` (${t.master})` : ""}</td>
                <td>{c.clientName}</td>
                <td>
                  {t.status[c.status] || c.status}
                  {c.message ? <><br /><small>{c.message}</small></> : null}
                  {c.status === "failed" && c.runUrl ? (
                    <> · <a href={c.runUrl} target="_blank" rel="noopener noreferrer">{t.details}</a></>
                  ) : null}
                </td>
                <td>
                  {c.frontendUrl ? <a href={c.frontendUrl} target="_blank" rel="noopener noreferrer">{t.open}</a> : ""}
                </td>
                <td>{c.requestedBy || ""}</td>
                <td>{formatTime(c.updatedAt, lang)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function AdminPanel({ t, lang }) {
  const api = useApi();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api("admin/clients");
      setClients(await res.json());
    } catch (err) {
      setStatus(errorMessage(err, t));
    } finally {
      setLoading(false);
    }
  }, [api, t]);

  useEffect(() => {
    load();
    // Requests change status in the background; keep the list current while the page is open.
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      await api("admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, client: form.client.trim().toLowerCase() }),
      });
      setStatus(t.requested(form.client.trim().toLowerCase()));
      setForm(empty);
      await load();
    } catch (err) {
      setStatus(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="form-actions">
        <h2>{t.listTitle}</h2>
        <button type="button" className="secondary small" onClick={load}>{t.refresh}</button>
      </div>
      <ClientTable t={t} lang={lang} clients={clients} loading={loading} />

      <h2>{t.formTitle}</h2>
      <form className="card-form" onSubmit={submit}>
        <p>{t.formHelp}</p>
        <label htmlFor="client">{t.clientId}</label>
        <input id="client" value={form.client} onChange={update("client")} pattern="[a-z0-9]{3,12}" required />
        <small>{t.clientIdHelp}</small>
        <label htmlFor="clientName">{t.clientName}</label>
        <input id="clientName" value={form.clientName} onChange={update("clientName")} maxLength={80} required />
        <label htmlFor="adminEmail">{t.adminEmail}</label>
        <input id="adminEmail" type="email" value={form.adminEmail} onChange={update("adminEmail")} required />
        <div className="form-actions">
          <button type="submit" disabled={busy}>{t.submit}</button>
        </div>
      </form>
      {status && <p className="status">{status}</p>}
    </>
  );
}

export default function Admin() {
  const { lang } = useLang();
  const t = texts[lang];

  return (
    <>
      <PageHeader title={t.title} subtitle={t.subtitle} />
      <main>
        <RequireSignIn message={common[lang].pleaseSignIn}>
          <AdminPanel t={t} lang={lang} />
        </RequireSignIn>
      </main>
    </>
  );
}
