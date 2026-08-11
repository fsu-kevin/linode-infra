import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface LVClient {
  id: number; label: string; api_key: string; install_code: string;
  created: string; updated: string;
}
interface LVPlan { longview_subscription: string | null }

const s: Record<string, React.CSSProperties> = {
  h1: { margin: "0 0 0.25rem", fontSize: "1.4rem", fontWeight: 700 },
  sub: { color: "#8b949e", marginBottom: "2rem", fontSize: "0.9rem" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" },
  card: { background: "#161b22", border: "1px solid #30363d", borderRadius: 10, padding: "1.25rem" },
  cardTitle: { fontWeight: 700, marginBottom: "0.75rem", fontSize: "1rem" },
  row: { display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.85rem" },
  key: { color: "#8b949e" },
  val: { color: "#e6edf3", fontFamily: "monospace", fontSize: "0.8rem", wordBreak: "break-all" as const, maxWidth: "55%", textAlign: "right" as const },
  note: { background: "#161b22", border: "1px solid #388bfd", borderRadius: 8, padding: "1rem 1.25rem", fontSize: "0.85rem", color: "#8b949e", marginBottom: "2rem" },
  noteTitle: { color: "#388bfd", fontWeight: 700, marginBottom: "0.5rem" },
  code: { background: "#0d1117", padding: "0.75rem 1rem", borderRadius: 6, fontFamily: "monospace", fontSize: "0.8rem", color: "#79c0ff", marginTop: "0.5rem", overflowX: "auto" as const },
  btn: { padding: "0.3rem 0.7rem", border: "1px solid #f8514940", borderRadius: 5, background: "transparent", color: "#f85149", cursor: "pointer", fontSize: "0.8rem" },
  planBadge: { display: "inline-block", padding: "0.2rem 0.75rem", borderRadius: 4, fontWeight: 700, fontSize: "0.8rem" },
};

export default function Longview({ token }: { token: string }) {
  const [clients, setClients] = useState<LVClient[]>([]);
  const [plan, setPlan] = useState<LVPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    Promise.all([
      apiFetch<{ data: LVClient[] }>("/longview/clients", token),
      apiFetch<LVPlan>("/longview/plan", token),
    ])
      .then(([c, p]) => { setClients(c.data); setPlan(p); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  async function del(id: number, label: string) {
    if (!confirm(`Remove Longview client "${label}"?`)) return;
    try {
      await apiFetch(`/longview/clients/${id}`, token, { method: "DELETE" });
      setClients(c => c.filter(x => x.id !== id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error");
    }
  }

  if (loading) return <p style={{ color: "#8b949e" }}>Loading Longview data...</p>;
  if (error) return <p style={{ color: "#f85149" }}>{error}</p>;

  const isFree = !plan?.longview_subscription;
  const freeLimit = 10;

  return (
    <div>
      <h1 style={s.h1}>Longview Observability</h1>
      <p style={s.sub}>
        Plan: <span style={{ ...s.planBadge, background: isFree ? "#21262d" : "#388bfd20", color: isFree ? "#8b949e" : "#388bfd" }}>
          {isFree ? "Free (up to 10 clients, 12h retention)" : plan?.longview_subscription}
        </span>
        &nbsp;&nbsp;Clients: {clients.length} / {isFree ? freeLimit : "∞"}
      </p>

      <div style={s.note}>
        <div style={s.noteTitle}>How Longview works (and its limitations)</div>
        <p style={{ margin: "0 0 0.75rem" }}>
          The Linode REST API manages <strong style={{ color: "#e6edf3" }}>client slots</strong> — registration records with an <code>install_code</code>.
          The actual metrics (CPU, memory, disk I/O, network) are collected by a daemon you install <em>inside each Linode</em>.
        </p>
        <p style={{ margin: "0 0 0.75rem" }}>
          <strong style={{ color: "#e6edf3" }}>API limitation:</strong> Raw time-series data is NOT accessible via the Linode REST API.
          Graphs and historical metrics only appear in the Linode Cloud Manager UI (manager.linode.com → Longview).
          This is a deliberate product boundary — Longview data flows to Linode's collector, not back through the API.
        </p>
        <strong style={{ color: "#e6edf3" }}>To activate an agent on a Linode:</strong>
        <div style={s.code}>
          # SSH into the Linode, then run:<br />
          curl -s https://lv.linode.com/&lt;install_code&gt; | sudo bash<br />
          sudo systemctl enable --now longview
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <span style={{ fontWeight: 600 }}>Clients ({clients.length})</span>
        <button style={{ padding: "0.3rem 0.7rem", border: "1px solid #30363d", borderRadius: 5, background: "transparent", color: "#8b949e", cursor: "pointer", fontSize: "0.8rem" }} onClick={load}>Refresh</button>
      </div>

      {clients.length === 0 ? (
        <p style={{ color: "#8b949e" }}>No Longview clients yet. Use Provision to create a stack — it automatically creates client slots.</p>
      ) : (
        <div style={s.grid}>
          {clients.map(c => (
            <div key={c.id} style={s.card}>
              <div style={s.cardTitle}>{c.label}</div>
              <div style={s.row}><span style={s.key}>ID</span><span style={s.val}>{c.id}</span></div>
              <div style={s.row}><span style={s.key}>Install code</span><span style={s.val}>{c.install_code}</span></div>
              <div style={s.row}><span style={s.key}>API key</span><span style={{ ...s.val, fontSize: "0.72rem" }}>{c.api_key}</span></div>
              <div style={s.row}><span style={s.key}>Created</span><span style={s.val}>{new Date(c.created).toLocaleDateString()}</span></div>
              <div style={s.row}><span style={s.key}>Last seen</span><span style={s.val}>{new Date(c.updated).toLocaleString()}</span></div>
              <div style={{ marginTop: "1rem" }}>
                <div style={{ fontSize: "0.78rem", color: "#8b949e", marginBottom: "0.4rem" }}>Agent install command:</div>
                <div style={{ ...s.code, fontSize: "0.75rem" }}>curl -s https://lv.linode.com/{c.install_code} | sudo bash</div>
              </div>
              <div style={{ marginTop: "0.75rem", textAlign: "right" }}>
                <button style={s.btn} onClick={() => del(c.id, c.label)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
