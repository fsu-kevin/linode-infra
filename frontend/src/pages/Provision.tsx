import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface Option { id: string; label: string }
interface Options { regions: Option[]; types: (Option & { memory: number; vcpus: number; disk: number })[]; images: (Option & { description?: string })[] }

const s: Record<string, React.CSSProperties> = {
  h1: { margin: "0 0 0.25rem", fontSize: "1.4rem", fontWeight: 700 },
  sub: { color: "#8b949e", marginBottom: "2rem", fontSize: "0.9rem" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", maxWidth: 860 },
  card: { background: "#161b22", border: "1px solid #30363d", borderRadius: 10, padding: "1.5rem" },
  cardTitle: { margin: "0 0 1rem", fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" },
  row: { marginBottom: "1rem" },
  label: { display: "block", marginBottom: "0.4rem", fontSize: "0.82rem", fontWeight: 600, color: "#8b949e", textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  input: { width: "100%", padding: "0.6rem 0.8rem", background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, color: "#e6edf3", fontSize: "0.9rem" },
  select: { width: "100%", padding: "0.6rem 0.8rem", background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, color: "#e6edf3", fontSize: "0.9rem" },
  btn: { padding: "0.75rem 2rem", background: "#00b159", border: "none", borderRadius: 6, color: "#fff", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer" },
  btnDis: { opacity: 0.5, cursor: "not-allowed" },
  badge: { display: "inline-block", padding: "0.2rem 0.6rem", borderRadius: 4, fontSize: "0.75rem", fontWeight: 700 },
  result: { marginTop: "2rem", maxWidth: 860, background: "#161b22", border: "1px solid #30363d", borderRadius: 10, padding: "1.5rem" },
  pre: { background: "#0d1117", borderRadius: 6, padding: "1rem", overflowX: "auto" as const, fontSize: "0.8rem", color: "#8b949e" },
  err: { color: "#f85149", marginTop: "1rem" },
  note: { background: "#161b22", border: "1px solid #388bfd", borderRadius: 8, padding: "1rem 1.25rem", fontSize: "0.85rem", color: "#8b949e", marginBottom: "2rem" },
  noteTitle: { color: "#388bfd", fontWeight: 700, marginBottom: "0.4rem" },
};

export default function Provision({ token }: { token: string }) {
  const [opts, setOpts] = useState<Options | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState("");

  const [region, setRegion] = useState("");
  const [webType, setWebType] = useState("");
  const [dbType, setDbType] = useState("");
  const [image, setImage] = useState("");
  const [rootPass, setRootPass] = useState("");
  const [label, setLabel] = useState("demo");

  useEffect(() => {
    apiFetch<Options>("/provision/options", token)
      .then(d => {
        setOpts(d);
        if (d.regions.length) setRegion(d.regions[0].id);
        const nano = d.types.find(t => t.id === "g6-nanog-1") ?? d.types[0];
        if (nano) { setWebType(nano.id); setDbType(nano.id); }
        const debian = d.images.find(i => i.id.includes("debian")) ?? d.images[0];
        if (debian) setImage(debian.id);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setResult(null); setError("");
    try {
      const r = await apiFetch("/provision/stack", token, {
        method: "POST",
        body: JSON.stringify({ region, webType, dbType, image, rootPass, label }),
      });
      setResult(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p style={{ color: "#8b949e" }}>Loading options from Linode API...</p>;

  const res = result as Record<string, unknown> | null;

  return (
    <div>
      <h1 style={s.h1}>Provision a Stack</h1>
      <p style={s.sub}>Creates a web server + database pair with network isolation via Linode Firewalls, plus Longview observability clients.</p>

      <div style={s.note}>
        <div style={s.noteTitle}>How the network security works</div>
        <div>
          <strong style={{ color: "#e6edf3" }}>Web server</strong> — public IP, firewall allows TCP 80, 443, 22 inbound; drops everything else.<br />
          <strong style={{ color: "#e6edf3" }}>Database</strong> — has a public IP (Linode always assigns one) but its firewall has <em>zero</em> public inbound rules.
          Only the web server's private 192.168.x.x IP can reach port 5432. From the internet, the database is unreachable.<br />
          <strong style={{ color: "#e6edf3" }}>Limitation:</strong> Linode private IPs require both Linodes to be in the same region. For stronger isolation you'd use VLANs.
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={s.grid}>
          <div style={s.card}>
            <div style={s.cardTitle}><span style={{ ...s.badge, background: "#00b15920", color: "#00b159" }}>WEB</span> Web Server</div>
            <div style={s.row}>
              <label style={s.label}>Region</label>
              <select style={s.select} value={region} onChange={e => setRegion(e.target.value)}>
                {opts?.regions.map(r => <option key={r.id} value={r.id}>{r.label} ({r.id})</option>)}
              </select>
            </div>
            <div style={s.row}>
              <label style={s.label}>Plan</label>
              <select style={s.select} value={webType} onChange={e => setWebType(e.target.value)}>
                {opts?.types.map(t => <option key={t.id} value={t.id}>{t.label} — {t.vcpus}vCPU, {t.memory / 1024}GB RAM</option>)}
              </select>
            </div>
            <div style={s.row}>
              <label style={s.label}>Image</label>
              <select style={s.select} value={image} onChange={e => setImage(e.target.value)}>
                {opts?.images.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
              </select>
            </div>
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}><span style={{ ...s.badge, background: "#f8514920", color: "#f85149" }}>DB</span> Database Server</div>
            <div style={s.row}>
              <label style={s.label}>Plan</label>
              <select style={s.select} value={dbType} onChange={e => setDbType(e.target.value)}>
                {opts?.types.map(t => <option key={t.id} value={t.id}>{t.label} — {t.vcpus}vCPU, {t.memory / 1024}GB RAM</option>)}
              </select>
            </div>
            <div style={s.row}>
              <label style={s.label}>Uses same region and image as web server</label>
              <input style={{ ...s.input, color: "#8b949e" }} value={`Region: ${region} / Image: ${image}`} readOnly />
            </div>
            <div style={{ ...s.row, background: "#0d1117", borderRadius: 6, padding: "0.75rem", fontSize: "0.82rem", color: "#8b949e", border: "1px solid #21262d" }}>
              Firewall: all public inbound DROPPED. Only web server private IP allowed on :5432.
            </div>
          </div>

          <div style={{ ...s.card, gridColumn: "1 / -1" }}>
            <div style={s.cardTitle}>Stack Settings</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={s.label}>Stack Label (used for naming all resources)</label>
                <input style={s.input} value={label} onChange={e => setLabel(e.target.value)} placeholder="demo" />
              </div>
              <div>
                <label style={s.label}>Root Password (both Linodes)</label>
                <input style={s.input} type="password" value={rootPass} onChange={e => setRootPass(e.target.value)} placeholder="Strong password" />
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
          <button style={{ ...s.btn, ...(submitting ? s.btnDis : {}) }} type="submit" disabled={submitting}>
            {submitting ? "Provisioning..." : "Provision Stack"}
          </button>
          {submitting && <span style={{ color: "#8b949e", fontSize: "0.85rem" }}>This takes ~30–60s. Linodes boot after firewalls are attached.</span>}
        </div>
      </form>

      {error && <p style={s.err}>{error}</p>}

      {res && (
        <div style={s.result}>
          <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem" }}>Stack Provisioned</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            <div style={{ background: "#0d1117", borderRadius: 8, padding: "1rem" }}>
              <div style={{ fontWeight: 700, marginBottom: "0.5rem", color: "#00b159" }}>Web Server</div>
              <div style={{ fontSize: "0.85rem", color: "#8b949e" }}>
                ID: {(res.webServer as Record<string, unknown>)?.id as string}<br />
                IPs: {((res.webServer as Record<string, unknown>)?.ipv4 as string[])?.join(", ")}<br />
                Status: {(res.webServer as Record<string, unknown>)?.status as string}
              </div>
            </div>
            <div style={{ background: "#0d1117", borderRadius: 8, padding: "1rem" }}>
              <div style={{ fontWeight: 700, marginBottom: "0.5rem", color: "#f85149" }}>Database Server</div>
              <div style={{ fontSize: "0.85rem", color: "#8b949e" }}>
                ID: {(res.dbServer as Record<string, unknown>)?.id as string}<br />
                IPs: {((res.dbServer as Record<string, unknown>)?.ipv4 as string[])?.join(", ")}<br />
                Status: {(res.dbServer as Record<string, unknown>)?.status as string}
              </div>
            </div>
          </div>
          {Boolean((res.longview as Record<string, unknown>)?.web) && (
            <div style={{ marginBottom: "1rem", background: "#0d1117", borderRadius: 8, padding: "1rem", fontSize: "0.85rem" }}>
              <div style={{ fontWeight: 700, marginBottom: "0.5rem", color: "#388bfd" }}>Longview Install</div>
              <div style={{ color: "#8b949e" }}>
                SSH into each Linode and run:<br />
                <code style={{ color: "#79c0ff" }}>curl -s https://lv.linode.com/{'<install_code>'} | sudo bash</code><br />
                Web install code: <strong style={{ color: "#e6edf3" }}>{((res.longview as Record<string, unknown>)?.web as Record<string, unknown>)?.install_code as string}</strong><br />
                DB install code: <strong style={{ color: "#e6edf3" }}>{((res.longview as Record<string, unknown>)?.db as Record<string, unknown>)?.install_code as string}</strong>
              </div>
            </div>
          )}
          <details>
            <summary style={{ cursor: "pointer", color: "#8b949e", fontSize: "0.85rem" }}>Full API response</summary>
            <pre style={s.pre}>{JSON.stringify(res, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
