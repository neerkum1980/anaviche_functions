import { useEffect, useRef, useState } from "react";
import { useApi } from "../auth.jsx";
import { useText } from "../i18n.jsx";

const texts = {
  de: {
    open: "Assistent",
    title: "Portfolio-Assistent",
    close: "Schliessen",
    intro: "Fragen Sie zu Immobilien, Buchungen oder Dokumenten, z. B. „Wie hoch waren die Unterhaltskosten 2026?“ Der Assistent kann nur lesen.",
    placeholder: "Nachricht eingeben…",
    send: "Senden",
    thinking: "Denkt nach…",
    failed: "Keine Antwort erhalten.",
  },
  en: {
    open: "Assistant",
    title: "Portfolio assistant",
    close: "Close",
    intro: "Ask about properties, expenses or documents, e.g. “What were the maintenance costs in 2026?” The assistant can only read data.",
    placeholder: "Type a message…",
    send: "Send",
    thinking: "Thinking…",
    failed: "No answer received.",
  },
};

// Floating chat window that talks to the backend chat endpoint (Claude + MCP server).
export default function ChatPanel() {
  const t = useText(texts);
  const api = useApi();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, pending, open]);

  async function send(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || pending) return;
    const history = [...messages, { role: "user", content: text }];
    setMessages(history);
    setDraft("");
    setError("");
    setPending(true);
    try {
      const res = await api("chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();
      setMessages([...history, { role: "assistant", content: data.reply || t.failed }]);
    } catch (err) {
      console.error("Chat failed:", err);
      // Show the backend's error text when it sent one, e.g. "Chat is not configured".
      const match = String(err.message || "").match(/"error":\s*"([^"]+)"/);
      setError(match ? match[1] : t.failed);
      // Drop the unanswered question so the history stays user/assistant pairs.
      setMessages(messages);
      setDraft(text);
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="chat-toggle" onClick={() => setOpen(true)}>
        💬 {t.open}
      </button>
    );
  }

  return (
    <section className="chat-panel" aria-label={t.title}>
      <header className="chat-header">
        <strong>{t.title}</strong>
        <button type="button" className="chat-close" aria-label={t.close} onClick={() => setOpen(false)}>×</button>
      </header>
      <div className="chat-messages" ref={listRef}>
        <p className="chat-intro">{t.intro}</p>
        {messages.map((m, i) => (
          <div key={i} className={`chat-message ${m.role}`}>{m.content}</div>
        ))}
        {pending && <div className="chat-message assistant pending">{t.thinking}</div>}
        {error && <p className="chat-error">{error}</p>}
      </div>
      <form className="chat-form" onSubmit={send}>
        <textarea
          rows="2"
          value={draft}
          placeholder={t.placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) send(e);
          }}
        />
        <button type="submit" disabled={pending || !draft.trim()}>{t.send}</button>
      </form>
    </section>
  );
}
