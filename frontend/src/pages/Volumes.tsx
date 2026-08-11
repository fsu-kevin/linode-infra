import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface Volume {
  id: number; label: string; status: string; region: string; size: number;
  linode_id: number | null; linode_label: string | null; created: string;
}

const s: Record<string, React.CSSProperties> = {
  h1: { margin: "0 0 1.5rem", fontSize: "1.4rem", fontWeight: 700 },
  wrap: { background: "#161b22", border: "1px solid #30363d", borderRadius: 10, overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: "0.875rem" },
  th: { textAlign: "left" as const, padding: "0.6rem 1rem", borderBottom: "1px solid #30363d", color: "#8b949e", fontWeight: 600, fontSize: "0.78rem", textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  td: { padding: "0.75rem 1rem", borderBottom: "1px solid #21262d", verticalAlign: "middle" as const },
  btn: { padding: "0.3rem 0.7rem", border: "1px solid #30363d", borderRadius: 5, background: "transparent", color: "#8b949e", cursor: "pointer", fontSize: "0.8rem", marginRight: "0.3rem" },
  btnDanger: { borderColor: "#f8514940", color: "#f85149" },
};

export default function Volumes({ token }: { token: string }) {
  const [data, setData] = useState<Volume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    apiFetch<{ data: Volume[] }>("/volumes", token)
      .then(r => setData(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  async function del(id: number, label: string) {
    if (!confirm(`Delete volume "${label}"? Data will be lost.`)) return;
    try {
      await apiFetch(`/volumes/${id}`, token, { method: "DELETE" });
      setData(d => d.filter(v => v.id !== id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error");
    }
  }

  if (loading) return <p style={{ color: "#8b949e" }}>Loading volumes...</p>;
  if (error) return <p style={{ color: "#f85149" }}>{error}</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <h1 style={{ ...s.h1, margin: 0 }}>Volumes ({data.length})</h1>
        <button style={s.btn} onClick={load}>Refresh</button>
      </div>
      {data.length === 0 ? (
        <p style={{ color: "#8b949e" }}>No volumes found.</p>
      ) : (
        <div style={s.wrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {["Label", "Status", "Size", "Region", "Attached To", "Created", "Actions"].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(v => (
                <tr key={v.id}>
                  <td style={s.td}><div style={{ fontWeight: 600 }}>{v.label}</div><div style={{ color: "#8b949e", fontSize: "0.78rem" }}>#{v.id}</div></td>
                  <td style={{ ...s.td, color: v.status === "active" ? "#00b159" : "#8b949e" }}>{v.status}</td>
                  <td style={{ ...s.td, color: "#8b949e" }}>{v.size} GB</td>
                  <td style={{ ...s.td, color: "#8b949e" }}>{v.region}</td>
                  <td style={{ ...s.td, color: "#8b949e" }}>{v.linode_label ?? "—"}</td>
                  <td style={{ ...s.td, color: "#8b949e", fontSize: "0.82rem" }}>{new Date(v.created).toLocaleDateString()}</td>
                  <td style={s.td}>
                    <button style={{ ...s.btn, ...s.btnDanger }} onClick={() => del(v.id, v.label)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
