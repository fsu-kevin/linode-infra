import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface Domain {
  id: number; domain: string; type: string; status: string; soa_email: string; tags: string[];
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

export default function Domains({ token }: { token: string }) {
  const [data, setData] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    apiFetch<{ data: Domain[] }>("/domains", token)
      .then(r => setData(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  async function del(id: number, domain: string) {
    if (!confirm(`Delete domain "${domain}" and all its records?`)) return;
    try {
      await apiFetch(`/domains/${id}`, token, { method: "DELETE" });
      setData(d => d.filter(i => i.id !== id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error");
    }
  }

  if (loading) return <p style={{ color: "#8b949e" }}>Loading domains...</p>;
  if (error) return <p style={{ color: "#f85149" }}>{error}</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <h1 style={s.h1}>Domains ({data.length})</h1>
        <button style={s.btn} onClick={load}>Refresh</button>
      </div>
      {data.length === 0 ? (
        <p style={{ color: "#8b949e" }}>No domains found.</p>
      ) : (
        <div style={s.wrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {["Domain", "Type", "Status", "SOA Email", "Tags", "Actions"].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(d => (
                <tr key={d.id}>
                  <td style={s.td}><div style={{ fontWeight: 600 }}>{d.domain}</div><div style={{ color: "#8b949e", fontSize: "0.78rem" }}>#{d.id}</div></td>
                  <td style={{ ...s.td, color: "#8b949e" }}>{d.type}</td>
                  <td style={{ ...s.td, color: d.status === "active" ? "#00b159" : "#8b949e" }}>{d.status}</td>
                  <td style={{ ...s.td, color: "#8b949e" }}>{d.soa_email}</td>
                  <td style={s.td}>{d.tags.map(t => <span key={t} style={{ background: "#21262d", color: "#8b949e", padding: "0.15rem 0.5rem", borderRadius: 4, fontSize: "0.75rem", marginRight: 4 }}>{t}</span>)}</td>
                  <td style={s.td}><button style={{ ...s.btn, ...s.btnDanger }} onClick={() => del(d.id, d.domain)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
