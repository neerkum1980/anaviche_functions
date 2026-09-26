import { useEffect, useRef, useState } from "react";
import ChatPanel from "../components/ChatPanel.jsx";
import { PageHeader } from "../components/Layout.jsx";
import { RequireSignIn, useApi } from "../auth.jsx";
import { saveResponse } from "../download.js";
import { common, useLang } from "../i18n.jsx";
import { useProperties } from "../useProperties.js";

const texts = {
  de: {
    title: "Immobilien verwalten",
    subtitle: "Immobilien hinzufügen, bearbeiten, löschen und Dokumente verwalten",
    formTitleNew: "Immobilie hinzufügen",
    formTitleEdit: "Immobilie bearbeiten",
    name: "Name der Immobilie",
    namePlaceholder: "Beispiel: Baarstrasse 12, Zug",
    location: "Standort",
    locationPlaceholder: "Stadt oder Kanton",
    units: "Anzahl Einheiten",
    description: "Beschreibung",
    descriptionPlaceholder: "Kurze Angaben zur Immobilie...",
    save: "Immobilie speichern",
    cancelEdit: "Abbrechen",
    saved: "Immobilie gespeichert.",
    listTitle: "Immobilienliste",
    columns: ["Immobilien-ID", "Name", "Standort", "Einheiten", "Beschreibung", "Aktionen"],
    edit: "Bearbeiten",
    delete: "Löschen",
    documents: "Dokumente",
    confirmDelete: "Diese Immobilie löschen?",
    loading: "Wird geladen...",
    empty: "Keine Immobilien gefunden.",
    failed: "Immobilien konnten nicht geladen werden.",
    docsTitle: "Dokumente für",
    upload: "Dokument hochladen",
    uploaded: "Dokument hochgeladen.",
    chooseFile: "Bitte zuerst eine Datei auswählen.",
    docColumns: ["Dateiname", "Grösse", "Hochgeladen am", "Aktionen"],
    download: "Herunterladen",
    noDocs: "Keine Dokumente.",
    docsFailed: "Dokumente konnten nicht geladen werden.",
  },
  en: {
    title: "Manage Properties",
    subtitle: "Add, edit, delete properties and manage documents",
    formTitleNew: "Add Property",
    formTitleEdit: "Edit Property",
    name: "Property Name",
    namePlaceholder: "Example: Baarstrasse 12, Zug",
    location: "Location",
    locationPlaceholder: "City or Canton",
    units: "Number of Units",
    description: "Description",
    descriptionPlaceholder: "Brief property details...",
    save: "Save Property",
    cancelEdit: "Cancel",
    saved: "Property saved.",
    listTitle: "Property List",
    columns: ["Property ID", "Name", "Location", "Units", "Description", "Actions"],
    edit: "Edit",
    delete: "Delete",
    documents: "Documents",
    confirmDelete: "Delete this property?",
    loading: "Loading...",
    empty: "No properties found.",
    failed: "Failed to load properties.",
    docsTitle: "Documents for",
    upload: "Upload Document",
    uploaded: "Document uploaded.",
    chooseFile: "Select a file first.",
    docColumns: ["File Name", "Size", "Uploaded At", "Actions"],
    download: "Download",
    noDocs: "No documents.",
    docsFailed: "Failed to load documents.",
  },
};

const emptyForm = { Name: "", Location: "", Units: "", Description: "" };

function errorText(err) {
  return String(err?.message || err);
}

function Documents({ property, t }) {
  const api = useApi();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const fileInput = useRef(null);
  const propertyId = property.RowKey;

  async function loadDocs() {
    setLoading(true);
    setError("");
    try {
      const res = await api(`DocumentManagement?propertyId=${encodeURIComponent(propertyId)}`);
      setDocs(await res.json());
    } catch (err) {
      console.error("Load documents failed:", err);
      setError(t.docsFailed);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setStatus("");
    loadDocs();
  }, [propertyId]);

  async function upload() {
    const file = fileInput.current?.files[0];
    if (!file) {
      setStatus(t.chooseFile);
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    formData.append("propertyId", propertyId);
    try {
      await api("DocumentManagement", { method: "POST", body: formData });
      fileInput.current.value = "";
      setStatus(t.uploaded);
      loadDocs();
    } catch (err) {
      console.error("Upload failed:", err);
      setStatus(errorText(err));
    }
  }

  async function download(doc) {
    try {
      const params = new URLSearchParams({ propertyId, documentId: doc.DocumentId });
      const res = await api(`DocumentManagement?${params}`);
      await saveResponse(res, doc.FileName || "document");
    } catch (err) {
      console.error("Download failed:", err);
      setStatus(errorText(err));
    }
  }

  const message = loading ? t.loading : error || (docs.length === 0 ? t.noDocs : null);

  return (
    <section className="doc-section">
      <h3>{t.docsTitle} {property.Name || propertyId}</h3>
      <div className="inline-form">
        <input type="file" ref={fileInput} />
        <button type="button" onClick={upload}>{t.upload}</button>
      </div>
      {status && <p className="status">{status}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>{t.docColumns.map((c) => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {message ? (
              <tr><td colSpan={4}>{message}</td></tr>
            ) : (
              docs.map((doc) => (
                <tr key={doc.DocumentId}>
                  <td>{doc.FileName}</td>
                  <td>{Math.round((doc.FileSize || 0) / 1024)} KB</td>
                  <td>{doc.UploadedAt ? new Date(doc.UploadedAt).toLocaleString() : ""}</td>
                  <td>
                    <button type="button" className="small" onClick={() => download(doc)}>{t.download}</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ManageProperties({ t }) {
  const api = useApi();
  const { properties, loading, error, reload } = useProperties();
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [status, setStatus] = useState("");
  const [docsFor, setDocsFor] = useState(null);

  const setField = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  function startEdit(p) {
    setEditing(p);
    setForm({ Name: p.Name || "", Location: p.Location || "", Units: p.Units || "", Description: p.Description || "" });
    setStatus("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditing(null);
    setForm(emptyForm);
  }

  async function save(e) {
    e.preventDefault();
    const body = {
      Name: form.Name.trim(),
      Location: form.Location.trim(),
      Units: form.Units,
      Description: form.Description.trim(),
    };
    // Updates need the table keys in the body; the API ignores the query string for PUT.
    if (editing) Object.assign(body, { PartitionKey: editing.PartitionKey, RowKey: editing.RowKey });
    try {
      await api("properties", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      cancelEdit();
      setStatus(t.saved);
      reload();
    } catch (err) {
      console.error("Error saving property:", err);
      setStatus(errorText(err));
    }
  }

  async function remove(p) {
    if (!window.confirm(t.confirmDelete)) return;
    try {
      await api(`properties?rowKey=${encodeURIComponent(p.RowKey)}`, { method: "DELETE" });
      if (docsFor?.RowKey === p.RowKey) setDocsFor(null);
      if (editing?.RowKey === p.RowKey) cancelEdit();
      reload();
    } catch (err) {
      console.error("Delete failed:", err);
      setStatus(errorText(err));
    }
  }

  const message = loading ? t.loading : error ? t.failed : properties.length === 0 ? t.empty : null;

  return (
    <>
      <h2>{editing ? t.formTitleEdit : t.formTitleNew}</h2>
      <form className="card-form" onSubmit={save}>
        <label htmlFor="name">{t.name}</label>
        <input id="name" type="text" required placeholder={t.namePlaceholder} value={form.Name} onChange={setField("Name")} />
        <label htmlFor="location">{t.location}</label>
        <input id="location" type="text" required placeholder={t.locationPlaceholder} value={form.Location} onChange={setField("Location")} />
        <label htmlFor="units">{t.units}</label>
        <input id="units" type="number" required min="1" value={form.Units} onChange={setField("Units")} />
        <label htmlFor="description">{t.description}</label>
        <textarea id="description" rows="3" placeholder={t.descriptionPlaceholder} value={form.Description} onChange={setField("Description")} />
        <div className="form-actions">
          <button type="submit">{t.save}</button>
          {editing && <button type="button" className="secondary" onClick={cancelEdit}>{t.cancelEdit}</button>}
        </div>
        {status && <p className="status">{status}</p>}
      </form>

      <h2>{t.listTitle}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>{t.columns.map((c) => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {message ? (
              <tr><td colSpan={6}>{message}</td></tr>
            ) : (
              properties.map((p) => (
                <tr key={p.RowKey}>
                  <td>{p.RowKey}</td>
                  <td>{p.Name}</td>
                  <td>{p.Location}</td>
                  <td>{p.Units}</td>
                  <td>{p.Description}</td>
                  <td className="actions">
                    <button type="button" className="small" onClick={() => startEdit(p)}>{t.edit}</button>
                    <button type="button" className="small" onClick={() => remove(p)}>{t.delete}</button>
                    <button type="button" className="small" onClick={() => setDocsFor(p)}>{t.documents}</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {docsFor && <Documents property={docsFor} t={t} />}
    </>
  );
}

export default function Manage() {
  const { lang } = useLang();
  const t = texts[lang];

  return (
    <>
      <PageHeader title={t.title} subtitle={t.subtitle} />
      <main>
        <RequireSignIn message={common[lang].pleaseSignIn}>
          <ManageProperties t={t} />
          <ChatPanel />
        </RequireSignIn>
      </main>
    </>
  );
}
