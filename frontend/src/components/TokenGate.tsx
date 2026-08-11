import { useState } from "react";

const s: Record<string, React.CSSProperties> = {
  wrap: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "2rem" },
  card: { background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: "2.5rem", maxWidth: 480, width: "100%" },
  title: { margin: "0 0 0.5rem", fontSize: "1.5rem", fontWeight: 700 },
  sub: { margin: "0 0 2rem", color: "#8b949e", fontSize: "0.9rem" },
  label: { display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.85rem" },
  input: { width: "100%", padding: "0.75rem 1rem", background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, color: "#e6edf3", fontSize: "0.95rem" },
  btn: { marginTop: "1.25rem", width: "100%", padding: "0.75rem", background: "#00b159", border: "none", borderRadius: 6, color: "#fff", fontWeight: 700, fontSize: "1rem", cursor: "pointer" },
  note: { marginTop: "1rem", fontSize: "0.8rem", color: "#8b949e" },
};

export default function TokenGate({ onToken }: { onToken: (t: string) => void }) {
  const [val, setVal] = useState("");
  const [err, setErr] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = val.trim();
    if (!t) { setErr("Token is required"); return; }
    setErr("");
    onToken(t);
  }

  return (
    <div style={s.wrap}>
      <form style={s.card} onSubmit={submit}>
        <h1 style={s.title}>Linode Infra Demo</h1>
        <p style={s.sub}>Enter your Linode Personal Access Token. It is sent only to your local backend and never stored.</p>
        <label style={s.label} htmlFor="token">Personal Access Token</label>
        <input
          id="token"
          style={s.input}
          type="password"
          placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          value={val}
          onChange={e => setVal(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        {err && <p style={{ color: "#f85149", marginTop: "0.5rem", fontSize: "0.85rem" }}>{err}</p>}
        <button style={s.btn} type="submit">Connect</button>
        <p style={s.note}>
          Generate a token at: Linode Cloud Manager &rarr; Profile &rarr; API Tokens &rarr; Personal Access Tokens.<br />
          Required scopes: Linodes, Volumes, Domains, NodeBalancers, Firewalls, Longview (read/write).
        </p>
      </form>
    </div>
  );
}
