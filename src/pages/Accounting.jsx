import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "../components/Layout.jsx";
import { RequireSignIn, useApi } from "../auth.jsx";
import { saveBlob, saveResponse } from "../download.js";
import { common, useLang } from "../i18n.jsx";
import { useProperties } from "../useProperties.js";

const PAGE_SIZE = 20;

const texts = {
  de: {
    title: "Buchhaltung",
    subtitle: "Ausgaben und Rechnungen Ihrer Immobilien verwalten",
    formTitle: "Buchung erfassen",
    property: "Immobilie",
    selectProperty: "Immobilie auswählen",
    category: "Kategorie",
    categoryPlaceholder: "z. B. Unterhalt, Nebenkosten",
    amount: "Betrag",
    date: "Datum",
    transaction: "Buchungsart",
    selectType: "Art auswählen",
    types: { informative: "Informativ", debit: "Belastung", credit: "Gutschrift" },
    description: "Beschreibung",
    bill: "Rechnung (optional)",
    save: "Buchung speichern",
    saved: "Buchung gespeichert.",
    listTitle: "Buchungen",
    annualLabel: "Jahresbericht (CH-Geschäftsjahr)",
    yearPlaceholder: "Jahr",
    exportAnnual: "Jahresbericht exportieren",
    customLabel: "Bericht für Zeitraum",
    to: "bis",
    exportCustom: "Zeitraum exportieren",
    columns: {
      PropertyName: "Immobilie",
      Category: "Kategorie",
      Amount: "Betrag",
      ExpenseDate: "Datum",
      Transaction: "Buchungsart",
      Description: "Beschreibung",
      DocumentId: "Rechnung",
    },
    download: "Herunterladen",
    choose: "Wählen Sie eine Immobilie, um die Buchungen zu sehen.",
    loading: "Wird geladen...",
    empty: "Keine Buchungen gefunden.",
    failed: "Buchungen konnten nicht geladen werden.",
    previous: "Zurück",
    next: "Weiter",
    page: (n, total) => `Seite ${n} von ${total}`,
    noExpenses: "Keine Buchungen zum Exportieren.",
    invalidYear: "Bitte ein gültiges Jahr eingeben.",
    noneInYear: "Keine Buchungen in diesem Jahr.",
    noneInPeriod: "Keine Buchungen in diesem Zeitraum.",
    popupBlocked: "Pop-up blockiert. Bitte Pop-ups erlauben, um das PDF zu erstellen.",
    annualTitle: (year) => `Jahresbericht ${year}`,
    customTitle: "Bericht für Zeitraum",
  },
  en: {
    title: "Accounting",
    subtitle: "Manage expenses and bills for your properties",
    formTitle: "Add Expense",
    property: "Property",
    selectProperty: "Select property",
    category: "Category",
    categoryPlaceholder: "e.g., Maintenance, Utilities",
    amount: "Amount",
    date: "Date",
    transaction: "Transaction Type",
    selectType: "Select type",
    types: { informative: "Informative", debit: "Debit", credit: "Credit" },
    description: "Description",
    bill: "Bill (optional)",
    save: "Save Expense",
    saved: "Expense saved.",
    listTitle: "Expenses",
    annualLabel: "Annual Expense Report (CH fiscal year)",
    yearPlaceholder: "Year",
    exportAnnual: "Export Annual Report",
    customLabel: "Custom Period Expense Report",
    to: "To",
    exportCustom: "Export Custom Period Report",
    columns: {
      PropertyName: "Property",
      Category: "Category",
      Amount: "Amount",
      ExpenseDate: "Date",
      Transaction: "Transaction Type",
      Description: "Description",
      DocumentId: "Bill",
    },
    download: "Download",
    choose: "Select a property to view expenses.",
    loading: "Loading...",
    empty: "No expenses found.",
    failed: "Failed to load expenses.",
    previous: "Previous",
    next: "Next",
    page: (n, total) => `Page ${n} of ${total}`,
    noExpenses: "No expenses to export.",
    invalidYear: "Enter a valid year.",
    noneInYear: "No expenses for this year.",
    noneInPeriod: "No expenses for this period.",
    popupBlocked: "Pop-up blocked. Please allow pop-ups to export PDF.",
    annualTitle: (year) => `Annual Expense Report ${year}`,
    customTitle: "Custom Period Expense Report",
  },
};

// Table columns; the last one (Bill) is not exported.
const COLUMNS = [
  { key: "PropertyName", type: "text" },
  { key: "Category", type: "text" },
  { key: "Amount", type: "number" },
  { key: "ExpenseDate", type: "date" },
  { key: "Transaction", type: "text" },
  { key: "Description", type: "text" },
  { key: "DocumentId", type: "text" },
];
const EXPORT_COLUMNS = COLUMNS.slice(0, 6);

const emptyForm = { category: "", amount: "", expenseDate: "", transaction: "", description: "" };

function sortValue(item, key, type) {
  const value = item[key] ?? "";
  if (type === "number") {
    const n = Number(value);
    return Number.isNaN(n) ? Number.NEGATIVE_INFINITY : n;
  }
  if (type === "date") {
    const time = value ? new Date(value).getTime() : 0;
    return Number.isNaN(time) ? 0 : time;
  }
  return String(value).toLowerCase();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Bills are stored as "<uuid>_<original name>"; show the original name.
function billFileName(documentId) {
  return documentId.replace(/^[0-9a-f-]{36}_/i, "") || "bill";
}

function exportCsv(rows, t, filename) {
  const header = EXPORT_COLUMNS.map((c) => t.columns[c.key]).join(",");
  const lines = rows.map((row) =>
    EXPORT_COLUMNS.map((c) => `"${String(row[c.key] ?? "").replace(/"/g, '""')}"`).join(",")
  );
  saveBlob(new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" }), filename);
}

function exportPdf(rows, t, title) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    window.alert(t.popupBlocked);
    return;
  }
  const head = EXPORT_COLUMNS.map((c) => `<th>${escapeHtml(t.columns[c.key])}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${EXPORT_COLUMNS.map((c) => `<td>${escapeHtml(row[c.key] ?? "")}</td>`).join("")}</tr>`)
    .join("");
  printWindow.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title>
<style>
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #222; }
  h1 { margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 8px; font-size: 12px; }
  th { background: #f0f0f0; text-align: left; }
  footer { margin-top: 24px; text-align: center; font-size: 12px; color: #555; }
</style></head>
<body><h1>${escapeHtml(title)}</h1>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
<footer>&copy; ${new Date().getFullYear()} Anaviche AG. All rights reserved.</footer>
</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

// Debit and credit entries between two ISO dates (inclusive), newest first.
function reportRows(rows, from, to) {
  return rows
    .filter((row) => {
      const type = String(row.Transaction || "").toLowerCase();
      const date = row.ExpenseDate || "";
      return (type === "debit" || type === "credit") && date >= from && date <= to;
    })
    .sort((a, b) => b.ExpenseDate.localeCompare(a.ExpenseDate));
}

function AccountingView({ t }) {
  const api = useApi();
  const { properties } = useProperties();
  const [propertyId, setPropertyId] = useState("");
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sort, setSort] = useState({ key: null, order: "asc" });
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [annualFormat, setAnnualFormat] = useState("csv");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [customFormat, setCustomFormat] = useState("csv");
  const billInput = useRef(null);

  const propertyName = properties.find((p) => p.RowKey === propertyId)?.Name || propertyId;

  async function loadExpenses(id = propertyId) {
    if (!id) {
      setExpenses([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api(`expenses?propertyId=${encodeURIComponent(id)}`);
      const data = await res.json();
      setExpenses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load expenses:", err);
      setError(t.failed);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }

  function selectProperty(id) {
    setPropertyId(id);
    setPage(1);
    setStatus("");
    loadExpenses(id);
  }

  // Rows with the property name filled in, sorted by the chosen column.
  const rows = useMemo(() => {
    const withNames = expenses.map((e) => ({ ...e, PropertyName: e.PropertyName || propertyName }));
    if (!sort.key) return withNames;
    const type = COLUMNS.find((c) => c.key === sort.key).type;
    const dir = sort.order === "asc" ? 1 : -1;
    return [...withNames].sort((a, b) => {
      const av = sortValue(a, sort.key, type);
      const bv = sortValue(b, sort.key, type);
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }, [expenses, propertyName, sort]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(key) {
    if (!expenses.length) return;
    setSort((s) => ({ key, order: s.key === key && s.order === "asc" ? "desc" : "asc" }));
    setPage(1);
  }

  const setField = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function save(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append("propertyId", propertyId);
    Object.entries(form).forEach(([key, value]) => formData.append(key, value));
    const bill = billInput.current?.files[0];
    if (bill) formData.append("bill", bill);
    try {
      await api("expenses", { method: "POST", body: formData });
      setForm(emptyForm);
      if (billInput.current) billInput.current.value = "";
      setStatus(t.saved);
      loadExpenses();
    } catch (err) {
      console.error("Error saving expense:", err);
      setStatus(String(err.message || err));
    }
  }

  async function downloadBill(documentId) {
    try {
      const params = new URLSearchParams({ blob: documentId, propertyId });
      const res = await api(`BillsDownloadApi?${params}`);
      await saveResponse(res, billFileName(documentId));
    } catch (err) {
      console.error("Bill download failed:", err);
      setStatus(String(err.message || err));
    }
  }

  function exportReport(fromDate, toDate, format, title, filename, noneMessage) {
    if (!expenses.length) return window.alert(t.noExpenses);
    const data = reportRows(rows, fromDate, toDate);
    if (!data.length) return window.alert(noneMessage);
    if (format === "pdf") exportPdf(data, t, title);
    else exportCsv(data, t, filename);
  }

  function exportAnnual() {
    if (!/^\d{4}$/.test(year)) return window.alert(t.invalidYear);
    exportReport(`${year}-01-01`, `${year}-12-31`, annualFormat, t.annualTitle(year),
      `annual-expense-report-${year}.csv`, t.noneInYear);
  }

  function exportCustom() {
    if (!/^\d{4}$/.test(year)) return window.alert(t.invalidYear);
    exportReport(from || `${year}-01-01`, to || `${year}-12-31`, customFormat, t.customTitle,
      "custom-period-expense-report.csv", t.noneInPeriod);
  }

  const message = !propertyId ? t.choose : loading ? t.loading : error || (rows.length === 0 ? t.empty : null);

  return (
    <>
      <h2>{t.formTitle}</h2>
      <form className="card-form" onSubmit={save}>
        <label htmlFor="property">{t.property}</label>
        <select id="property" required value={propertyId} onChange={(e) => selectProperty(e.target.value)}>
          <option value="">{t.selectProperty}</option>
          {properties.map((p) => <option key={p.RowKey} value={p.RowKey}>{p.Name || p.RowKey}</option>)}
        </select>
        <label htmlFor="category">{t.category}</label>
        <input id="category" type="text" required placeholder={t.categoryPlaceholder} value={form.category} onChange={setField("category")} />
        <label htmlFor="amount">{t.amount}</label>
        <input id="amount" type="number" required min="0.01" step="0.01" value={form.amount} onChange={setField("amount")} />
        <label htmlFor="expenseDate">{t.date}</label>
        <input id="expenseDate" type="date" required value={form.expenseDate} onChange={setField("expenseDate")} />
        <label htmlFor="transaction">{t.transaction}</label>
        <select id="transaction" required value={form.transaction} onChange={setField("transaction")}>
          <option value="">{t.selectType}</option>
          {Object.entries(t.types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label htmlFor="description">{t.description}</label>
        <textarea id="description" rows="2" value={form.description} onChange={setField("description")} />
        <label htmlFor="bill">{t.bill}</label>
        <input id="bill" type="file" ref={billInput} />
        <div className="form-actions">
          <button type="submit">{t.save}</button>
        </div>
        {status && <p className="status">{status}</p>}
      </form>

      <h2>{t.listTitle}</h2>
      <div className="export-actions">
        <label htmlFor="year"><strong>{t.annualLabel}</strong></label>
        <input id="year" type="number" min="2000" max="2100" step="1" placeholder={t.yearPlaceholder} value={year} onChange={(e) => setYear(e.target.value)} />
        <select value={annualFormat} onChange={(e) => setAnnualFormat(e.target.value)}>
          <option value="csv">CSV</option>
          <option value="pdf">PDF</option>
        </select>
        <button type="button" onClick={exportAnnual}>{t.exportAnnual}</button>
      </div>
      <div className="export-actions">
        <label htmlFor="from"><strong>{t.customLabel}</strong></label>
        <input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <label htmlFor="to">{t.to}</label>
        <input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <select value={customFormat} onChange={(e) => setCustomFormat(e.target.value)}>
          <option value="csv">CSV</option>
          <option value="pdf">PDF</option>
        </select>
        <button type="button" onClick={exportCustom}>{t.exportCustom}</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className="sortable"
                  data-order={sort.key === c.key ? sort.order : undefined}
                  onClick={() => toggleSort(c.key)}
                >
                  {t.columns[c.key]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {message ? (
              <tr><td colSpan={COLUMNS.length}>{message}</td></tr>
            ) : (
              pageRows.map((e) => (
                <tr key={e.RowKey}>
                  <td>{e.PropertyName}</td>
                  <td>{e.Category}</td>
                  <td>{e.Amount}</td>
                  <td>{e.ExpenseDate}</td>
                  <td>{t.types[String(e.Transaction).toLowerCase()] || e.Transaction}</td>
                  <td>{e.Description}</td>
                  <td>
                    {e.DocumentId && (
                      <button type="button" className="small" onClick={() => downloadBill(e.DocumentId)}>{t.download}</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t.previous}</button>
        <span>{t.page(page, totalPages)}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>{t.next}</button>
      </div>
    </>
  );
}

export default function Accounting() {
  const { lang } = useLang();
  const t = texts[lang];

  return (
    <>
      <PageHeader title={t.title} subtitle={t.subtitle} />
      <main>
        <RequireSignIn message={common[lang].pleaseSignIn}>
          <AccountingView t={t} />
        </RequireSignIn>
      </main>
    </>
  );
}
