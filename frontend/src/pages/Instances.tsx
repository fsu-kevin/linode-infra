import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface Linode {
  id: number; label: string; status: string; region: string;
  type: string; ipv4: string[]; ipv6: string; image: string | null; tags: string[];
}

const statusColor: Record<string, string> = {
  running: "#00b159", offline: "#f85149", booting: "#f0883e",
  rebooting: "#f0883e", shutting_down: "#f0883e", provisioning: "#388bfd",
};

const s: Record<string, React.CSSProperties> = {
  h1: { margin: "0 0 1.5rem", fontSize: "1.4rem", fontWeight: 700 },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: "0.875rem" },
  th: { textAlign: "left" as const, padding: "0.6rem 1rem", borderBottom: "1px solid #30363d", color: "#8b949e", fontWeight: 600, fontSize: "0.78rem", textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  td: { padding: "0.75rem 1rem", borderBottom: "1px solid #21262d", verticalAlign: "middle" as const },
  wrap: { background: "#161b22", border: "1px solid #30363d", borderRadius: 10, overflow: "hidden" },
  badge: { display: "inline-block", padding: "0.15rem 0.5rem", borderRadius: 4, fontSize: "0.75rem", fontWeight: 700 },
  btn: { padding: "0.3rem 0.7rem", border: "1px solid #30363d", borderRadius: 5, background: "transparent", color: "#8b949e", cursor: "pointer", fontSize: "0.8rem", marginRight: "0.3rem" },
  btnDanger: { borderColor: "#f8514940", color: "#f85149" },
};

export default function Instances({ token }: { token: string }) {
  const [data, setData] = useState<Linode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acting, setActing] = useState<number | null>(null);

  function load() {
    setLoading(true);
    apiFetch<{ data: Linode[] }>("/instances", token)
      .then(r => setData(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  async function action(id: number, act: string) {
    setActing(id);
    try {
      await apiFetch(`/instances/${id}/${act}`, token, { method: "POST" });
      setTimeout(load, 1500);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setActing(null);
    }
  }

  async function del(id: number, label: string) {
    if (!confirm(`Delete Linode "${label}"? This is permanent.`)) return;
    setActing(id);
    try {
      await apiFetch(`/instances/${id}`, token, { method: "DELETE" });
      setData(d => d.filter(i => i.id !== id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setActing(null);
    }
  }

  if (loading) return <p style={{ color: "#8b949e" }}>Loading instances...</p>;
  if (error) return <p style={{ color: "#f85149" }}>{error}</p>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <h1 style={{ ...s.h1, margin: 0 }}>Instances ({data.length})</h1>
        <button style={{ ...s.btn, color: "#e6edf3", borderColor: "#30363d" }} onClick={load}>Refresh</button>
      </div>
      {data.length === 0 ? (
        <p style={{ color: "#8b949e" }}>No Linodes found. Use Provision to create a stack.</p>
      ) : (
        <div style={s.wrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {["Label", "Status", "Region", "IPs", "Type", "Tags", "Actions"].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(l => (
                <tr key={l.id}>
                  <td style={s.td}>
                    <div style={{ fontWeight: 600 }}>{l.label}</div>
                    <div style={{ color: "#8b949e", fontSize: "0.78rem" }}>#{l.id}</div>
                  </td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, background: `${statusColor[l.status] ?? "#8b949e"}20`, color: statusColor[l.status] ?? "#8b949e" }}>
                      {l.status}
                    </span>
                  </td>
                  <td style={{ ...s.td, color: "#8b949e" }}>{l.region}</td>
                  <td style={{ ...s.td, color: "#8b949e", fontSize: "0.82rem" }}>
                    {l.ipv4.map(ip => (
                      <div key={ip} style={ip.startsWith("192.168.") ? { color: "#f0883e" } : undefined}>
                        {ip}{ip.startsWith("192.168.") ? " (private)" : ""}
                      </div>
                    ))}
                  </td>
                  <td style={{ ...s.td, color: "#8b949e" }}>{l.type}</td>
                  <td style={s.td}>
                    {l.tags.map(t => (
                      <span key={t} style={{ ...s.badge, background: "#21262d", color: "#8b949e", marginRight: 4 }}>{t}</span>
                    ))}
                  </td>
                  <td style={s.td}>
                    {acting === l.id ? (
                      <span style={{ color: "#8b949e", fontSize: "0.8rem" }}>...</span>
                    ) : (
                      <>
                        {l.status === "running" && <button style={s.btn} onClick={() => action(l.id, "reboot")}>Reboot</button>}
                        {l.status === "running" && <button style={s.btn} onClick={() => action(l.id, "shutdown")}>Shutdown</button>}
                        {l.status === "offline" && <button style={s.btn} onClick={() => action(l.id, "boot")}>Boot</button>}
                        <button style={{ ...s.btn, ...s.btnDanger }} onClick={() => del(l.id, l.label)}>Delete</button>
                      </>
                    )}
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
