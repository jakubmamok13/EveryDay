import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Card, useAction } from "../ui";

const CHIPS = ["Mam tylko 45 min", "Bolą mnie nogi", "Dlaczego ten trening?", "Ile jeść na długiej jeździe?"];
const NOTE_KIND: Record<string, string> = { injury: "ból / uraz", illness: "choroba", travel: "wyjazd", other: "inne" };

export function Chat() {
  const [msgs, setMsgs] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const { run } = useAction();
  const end = useRef<HTMLDivElement>(null);

  const load = async () => {
    const d = await api.get("/api/chat");
    setMsgs(d.messages);
    setNotes(d.notes);
  };
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [msgs, thinking]);

  const send = async (m: string) => {
    const message = m.trim();
    if (!message || thinking) return;
    setText("");
    setMsgs((x) => [...x, { id: `tmp${Date.now()}`, role: "user", content: message }]);
    setThinking(true);
    await run(async () => {
      await api.post("/api/chat", { message });
      await load();
    });
    setThinking(false);
  };

  return (
    <>
      <header className="topbar"><h1>Czat z trenerem</h1></header>
      {notes.length > 0 && (
        <Card title="Pamiętam">
          {notes.map((n) => (
            <div key={n.id} className="spread small" style={{ padding: "4px 0" }}>
              <span><span className="tag">{NOTE_KIND[n.kind] ?? n.kind}</span> {n.text} <span className="muted">· do {n.end_date}</span></span>
              <button className="linkbtn" onClick={() => run(async () => { await api.del(`/api/notes/${n.id}`); await load(); }, "Usunięto.")}>Usuń</button>
            </div>
          ))}
        </Card>
      )}
      <div className="chat" aria-live="polite">
        {msgs.length === 0 && <p className="muted small">Napisz, jeśli masz mniej czasu, coś boli albo chcesz wiedzieć, po co jest dany trening.</p>}
        {msgs.map((m) => <div key={m.id} className={`bubble ${m.role === "user" ? "user" : "coach"}`}>{m.content}</div>)}
        {thinking && <div className="bubble coach muted">Trener pisze…</div>}
        <div ref={end} />
      </div>
      <div className="composer">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Napisz do trenera…" aria-label="Wiadomość"
          onKeyDown={(e) => e.key === "Enter" && void send(text)} maxLength={1000} />
        <button className="btn primary" disabled={!text.trim() || thinking} onClick={() => void send(text)}>Wyślij</button>
      </div>
      <div className="chips">
        {CHIPS.map((c) => <button key={c} className="btn small" disabled={thinking} onClick={() => void send(c)}>{c}</button>)}
      </div>
    </>
  );
}
