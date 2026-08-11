import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface NB {
  id: number; label: string; hostname: string; region: string;
  ipv4: string; ipv6: string; created: string;
  transfer: { in: number; out: number; total: number };
}

const s: Record<string, React.CSSProperties> = {
  h1: { margin: "0", fontSize: "1.4rem", fontWeight: 700 },
  wrap: { background: "#161b22", border: "1px solid #30363d", borderRadius: 10, overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: "0.875rem" },
  th: { textAlign: "left" as const, padding: "0.6rem 1rem", borderBottom: "1px solid #30363d", color: "#8b949e", fontWeight: 600, fontSize: "0.78rem", textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  td: { padding: "0.75rem 1rem", borderBottom: "1px solid #21262d", verticalAlign: "middle" as const },
  btn: { padding: "0.3rem 0.7rem", border: "1px solid #30363d", borderRadius: 5, background: "transparent", color: "#8b949e", cursor: "pointer", fontSize: "0.8rem", marginRight: "0.3rem" },
  btnDanger: { borderColor: "#f8514940", color: "#f85149" },
};

function fmt(gb: number) {
  if (gb < 1) return `${(gb * 1024).toFixed(1)} MB`;
  return `${gb.toFixed(2)} GB`;
}

export default function NodeBalancers({ token }: { token: string }) {
  const [data, setData] = useState<NB[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    apiFetch<{ data: NB[] }>("/nodebalancers", token)
      .then(r => setData(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  async function del(id: number, label: string) {
    if (!confirm(`Delete NodeBalancer "${label}"?`)) return;
    try {
      await apiFetch(`/nodebalancers/${id}`, token, { method: "DELETE" });
      setData(d => d.filter(n => n.id !== id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error");
    }
  }

  if (loading) return <p style={{ color: "#8b949e" }}>Loading NodeBalancers...</p>;
  if (error) return <p style={{ color: "#f85149" }}>{error}</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <h1 style={s.h1}>NodeBalancers ({data.length})</h1>
        <button style={s.btn} onClick={load}>Refresh</button>
      </div>
      {data.length === 0 ? (
        <p style={{ color: "#8b949e" }}>No NodeBalancers found.</p>
      ) : (
        <div style={s.wrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {["Label", "Hostname", "Region", "IPv4", "Transfer (in/out)", "Created", "Actions"].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(n => (
                <tr key={n.id}>
                  <td style={s.td}><div style={{ fontWeight: 600 }}>{n.label}</div><div style={{ color: "#8b949e", fontSize: "0.78rem" }}>#{n.id}</div></td>
                  <td style={{ ...s.td, color: "#8b949e", fontSize: "0.82rem" }}>{n.hostname}</td>
                  <td style={{ ...s.td, color: "#8b949e" }}>{n.region}</td>
                  <td style={{ ...s.td, color: "#8b949e" }}>{n.ipv4}</td>
                  <td style={{ ...s.td, color: "#8b949e", fontSize: "0.82rem" }}>{fmt(n.transfer.in)} / {fmt(n.transfer.out)}</td>
                  <td style={{ ...s.td, color: "#8b949e", fontSize: "0.82rem" }}>{new Date(n.created).toLocaleDateString()}</td>
                  <td style={s.td}><button style={{ ...s.btn, ...s.btnDanger }} onClick={() => del(n.id, n.label)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
