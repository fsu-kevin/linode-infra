import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

type TemplateId = "web-app" | "bastion" | "vpn" | "game-server" | "standalone";

interface Template {
  id: TemplateId;
  name: string;
  description: string;
  openPorts: string[];
  tags: string[];
}

interface DropdownOption { id: string; label: string; memory?: number; vcpus?: number; disk?: number }
interface Options { regions: DropdownOption[]; types: DropdownOption[]; images: DropdownOption[] }

const TEMPLATE_META: Record<TemplateId, { icon: string; color: string; bg: string }> = {
  "web-app":     { icon: "🌐", color: "#388bfd", bg: "rgba(56,139,253,0.12)" },
  "bastion":     { icon: "🏰", color: "#e3b341", bg: "rgba(227,179,65,0.12)" },
  "vpn":         { icon: "🔒", color: "#a371f7", bg: "rgba(163,113,247,0.12)" },
  "game-server": { icon: "🎮", color: "#00b159", bg: "rgba(0,177,89,0.12)" },
  "standalone":  { icon: "💻", color: "#8b949e", bg: "rgba(139,148,158,0.12)" },
};

const GAME_PRESETS = [
  { label: "Minecraft (Java)",   port: "25565" },
  { label: "Minecraft (Bedrock)", port: "19132" },
  { label: "Valheim",            port: "2456-2458" },
  { label: "CS2 / CSGO",        port: "27015" },
  { label: "Factorio",          port: "34197" },
  { label: "Terraria",          port: "7777" },
  { label: "Custom",            port: "" },
];

const s: Record<string, React.CSSProperties> = {
  h1:        { margin: "0 0 0.25rem", fontSize: "1.4rem", fontWeight: 700 },
  sub:       { color: "#8b949e", marginBottom: "2rem", fontSize: "0.9rem" },
  templates: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.75rem", marginBottom: "2rem" },
  card:      { background: "#161b22", border: "1px solid #30363d", borderRadius: 10, padding: "1rem 0.9rem", cursor: "pointer", transition: "border-color 0.15s" },
  cardIcon:  { fontSize: "1.5rem", marginBottom: "0.5rem" },
  cardName:  { fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.25rem" },
  cardDesc:  { color: "#8b949e", fontSize: "0.75rem", lineHeight: 1.4 },
  form:      { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", maxWidth: 860 },
  panel:     { background: "#161b22", border: "1px solid #30363d", borderRadius: 10, padding: "1.5rem" },
  panelTitle:{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 700 },
  row:       { marginBottom: "1rem" },
  label:     { display: "block", marginBottom: "0.4rem", fontSize: "0.82rem", fontWeight: 600, color: "#8b949e", textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  input:     { width: "100%", padding: "0.6rem 0.8rem", background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, color: "#e6edf3", fontSize: "0.9rem", boxSizing: "border-box" as const },
  select:    { width: "100%", padding: "0.6rem 0.8rem", background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, color: "#e6edf3", fontSize: "0.9rem", boxSizing: "border-box" as const },
  textarea:  { width: "100%", padding: "0.6rem 0.8rem", background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, color: "#e6edf3", fontSize: "0.85rem", fontFamily: "monospace", minHeight: 80, resize: "vertical" as const, boxSizing: "border-box" as const },
  hint:      { color: "#6e7681", fontSize: "0.75rem", marginTop: "0.25rem" },
  secBadge:  { display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.35rem 0.7rem", borderRadius: 6, fontSize: "0.8rem", marginBottom: "0.5rem" },
  btn:       { padding: "0.75rem 2rem", background: "#00b159", border: "none", borderRadius: 6, color: "#fff", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer" },
  btnDis:    { opacity: 0.5, cursor: "not-allowed" },
  result:    { marginTop: "2rem", maxWidth: 860, background: "#161b22", border: "1px solid #30363d", borderRadius: 10, padding: "1.5rem" },
  pre:       { background: "#0d1117", borderRadius: 6, padding: "1rem", overflowX: "auto" as const, fontSize: "0.8rem", color: "#8b949e" },
  err:       { color: "#f85149", marginTop: "1rem" },
  chip:      { display: "inline-block", padding: "0.15rem 0.5rem", borderRadius: 4, fontSize: "0.72rem", fontWeight: 600, marginRight: "0.3rem" },
};

function SecurityBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ ...s.secBadge, background: ok ? "rgba(0,177,89,0.1)" : "rgba(139,148,158,0.08)", color: ok ? "#00b159" : "#6e7681" }}>
      <span>{ok ? "✓" : "○"}</span>
      <span>{label}</span>
    </div>
  );
}

export default function Deploy({ token }: { token: string }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [opts, setOpts] = useState<Options | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<TemplateId | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  const [region, setRegion] = useState("");
  const [type, setType] = useState("");
  const [image, setImage] = useState("");
  const [label, setLabel] = useState("my-vm");
  const [rootPass, setRootPass] = useState("");
  const [sshKey, setSshKey] = useState("");
  const [sshSourceIp, setSshSourceIp] = useState("");
  const [gamePreset, setGamePreset] = useState(GAME_PRESETS[0].label);
  const [gamePort, setGamePort] = useState(GAME_PRESETS[0].port);

  useEffect(() => {
    Promise.all([
      apiFetch<Template[]>("/templates", token),
      apiFetch<Options>("/provision/options", token),
    ]).then(([tmpl, o]) => {
      setTemplates(tmpl);
      setOpts(o);
      if (o.regions.length) setRegion(o.regions[0].id);
      const nano = o.types.find(t => t.id === "g6-nanog-1") ?? o.types[0];
      if (nano) setType(nano.id);
      const debian = o.images.find(i => i.id.includes("debian")) ?? o.images[0];
      if (debian) setImage(debian.id);
    }).catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const selected = templates.find(t => t.id === selectedId);
  const meta = selectedId ? TEMPLATE_META[selectedId] : null;

  function handleGamePreset(preset: string) {
    setGamePreset(preset);
    const found = GAME_PRESETS.find(p => p.label === preset);
    if (found) setGamePort(found.port);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSubmitting(true); setResult(null); setError("");
    try {
      const r = await apiFetch<Record<string, unknown>>("/templates/provision", token, {
        method: "POST",
        body: JSON.stringify({
          template: selectedId,
          region, type, image, rootPass, label,
          sshKey: sshKey || undefined,
          sshSourceIp: sshSourceIp || undefined,
          gamePort: gamePort || undefined,
        }),
      });
      setResult(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p style={{ color: "#8b949e" }}>Loading options...</p>;

  return (
    <div>
      <h1 style={s.h1}>Deploy a VM</h1>
      <p style={s.sub}>Pick a template — firewall rules, cloud-init hardening, and fail2ban are pre-configured for each use case.</p>

      <div style={s.templates}>
        {templates.map(t => {
          const m = TEMPLATE_META[t.id as TemplateId];
          const active = selectedId === t.id;
          return (
            <div
              key={t.id}
              style={{ ...s.card, borderColor: active ? m.color : "#30363d", background: active ? m.bg : "#161b22" }}
              onClick={() => setSelectedId(t.id as TemplateId)}
            >
              <div style={s.cardIcon}>{m.icon}</div>
              <div style={{ ...s.cardName, color: active ? m.color : "#e6edf3" }}>{t.name}</div>
              <div style={s.cardDesc}>{t.description}</div>
              <div style={{ marginTop: "0.6rem" }}>
                {t.openPorts.map(p => (
                  <span key={p} style={{ ...s.chip, background: "rgba(139,148,158,0.12)", color: "#8b949e" }}>{p}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selected && meta && (
        <form onSubmit={handleSubmit}>
          <div style={s.form}>
            <div style={s.panel}>
              <div style={{ ...s.panelTitle, color: meta.color }}>
                {meta.icon} {selected.name} — Configuration
              </div>

              <div style={s.row}>
                <label style={s.label}>Label</label>
                <input style={s.input} value={label} onChange={e => setLabel(e.target.value)} placeholder="my-vm" />
              </div>
              <div style={s.row}>
                <label style={s.label}>Region</label>
                <select style={s.select} value={region} onChange={e => setRegion(e.target.value)}>
                  {opts?.regions.map(r => <option key={r.id} value={r.id}>{r.label} ({r.id})</option>)}
                </select>
              </div>
              <div style={s.row}>
                <label style={s.label}>Plan</label>
                <select style={s.select} value={type} onChange={e => setType(e.target.value)}>
                  {opts?.types.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.label}{t.vcpus ? ` — ${t.vcpus}vCPU, ${(t.memory ?? 0) / 1024}GB RAM` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div style={s.row}>
                <label style={s.label}>Image</label>
                <select style={s.select} value={image} onChange={e => setImage(e.target.value)}>
                  {opts?.images.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
                </select>
              </div>
              <div style={s.row}>
                <label style={s.label}>Root Password</label>
                <input style={s.input} type="password" value={rootPass} onChange={e => setRootPass(e.target.value)} placeholder="Strong password" />
              </div>

              {selectedId === "game-server" && (
                <div style={s.row}>
                  <label style={s.label}>Game / Port</label>
                  <select style={{ ...s.select, marginBottom: "0.5rem" }} value={gamePreset} onChange={e => handleGamePreset(e.target.value)}>
                    {GAME_PRESETS.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
                  </select>
                  <input
                    style={s.input}
                    value={gamePort}
                    onChange={e => setGamePort(e.target.value)}
                    placeholder="e.g. 25565 or 7000-7005"
                  />
                  <div style={s.hint}>Port or range (e.g. 2456-2458) opened for both TCP and UDP</div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column" as const, gap: "1.5rem" }}>
              <div style={s.panel}>
                <div style={s.panelTitle}>Security Extras</div>

                <div style={s.row}>
                  <label style={s.label}>SSH Public Key (Recommended)</label>
                  <textarea
                    style={s.textarea}
                    value={sshKey}
                    onChange={e => setSshKey(e.target.value)}
                    placeholder="ssh-ed25519 AAAA... or ssh-rsa AAAA..."
                  />
                  <div style={s.hint}>If set, root password auth is still allowed but key auth is configured. Run <code>ssh-keygen -t ed25519</code> to generate one.</div>
                </div>

                <div style={s.row}>
                  <label style={s.label}>Restrict SSH to IP</label>
                  <input
                    style={s.input}
                    value={sshSourceIp}
                    onChange={e => setSshSourceIp(e.target.value)}
                    placeholder="e.g. 12.34.56.78  (leave blank for open)"
                  />
                  <div style={s.hint}>Locks SSH firewall rule to a single source IP. Highly recommended for bastion hosts.</div>
                </div>
              </div>

              <div style={s.panel}>
                <div style={s.panelTitle}>Protection Applied</div>
                <SecurityBadge ok label="Firewall: default DROP all inbound" />
                <SecurityBadge ok label="fail2ban — bans brute-force SSH IPs" />
                <SecurityBadge ok label="Unattended security upgrades" />
                <SecurityBadge ok label="SSH: MaxAuthTries 3, grace 30s" />
                <SecurityBadge ok={!!sshKey} label={sshKey ? "SSH key auth configured" : "SSH key — not set (password only)"} />
                <SecurityBadge ok={!!sshSourceIp} label={sshSourceIp ? `SSH locked to ${sshSourceIp}` : "SSH source IP — unrestricted"} />
              </div>
            </div>
          </div>

          <div style={{ marginTop: "1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
            <button
              style={{ ...s.btn, ...(submitting || !rootPass || !label ? s.btnDis : {}) }}
              type="submit"
              disabled={submitting || !rootPass || !label}
            >
              {submitting ? "Provisioning..." : `Deploy ${selected.name}`}
            </button>
            {submitting && <span style={{ color: "#8b949e", fontSize: "0.85rem" }}>Takes ~30–60s — firewall attaches before boot.</span>}
          </div>
        </form>
      )}

      {error && <p style={s.err}>{error}</p>}

      {result && (
        <div style={s.result}>
          <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem" }}>
            {meta?.icon} {result.template as string} deployed
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            <div style={{ background: "#0d1117", borderRadius: 8, padding: "1rem" }}>
              <div style={{ fontWeight: 700, marginBottom: "0.5rem", color: meta?.color ?? "#00b159" }}>Instance</div>
              <div style={{ fontSize: "0.85rem", color: "#8b949e", lineHeight: 1.8 }}>
                ID: {(result.instance as Record<string, unknown>)?.id as string}<br />
                Label: {(result.instance as Record<string, unknown>)?.label as string}<br />
                Status: {(result.instance as Record<string, unknown>)?.status as string}<br />
                IPs: {((result.instance as Record<string, unknown>)?.ipv4 as string[])?.join(", ")}
              </div>
            </div>

            <div style={{ background: "#0d1117", borderRadius: 8, padding: "1rem" }}>
              <div style={{ fontWeight: 700, marginBottom: "0.5rem", color: "#e3b341" }}>Firewall</div>
              <div style={{ fontSize: "0.85rem", color: "#8b949e", lineHeight: 1.8 }}>
                ID: {(result.firewall as Record<string, unknown>)?.id as string}<br />
                Label: {(result.firewall as Record<string, unknown>)?.label as string}<br />
                Rules: {(result.firewall as Record<string, unknown>)?.rulesCount as string} inbound<br />
                Default: DROP
              </div>
            </div>

            <div style={{ background: "#0d1117", borderRadius: 8, padding: "1rem" }}>
              <div style={{ fontWeight: 700, marginBottom: "0.5rem", color: "#00b159" }}>Security</div>
              <div style={{ fontSize: "0.85rem", color: "#8b949e", lineHeight: 1.8 }}>
                {Object.entries((result.security as Record<string, unknown>) ?? {}).map(([k, v]) => (
                  <div key={k} style={{ color: v === true ? "#00b159" : v === false ? "#f85149" : "#8b949e" }}>
                    {k}: {String(v)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <details>
            <summary style={{ cursor: "pointer", color: "#8b949e", fontSize: "0.85rem" }}>Full response</summary>
            <pre style={s.pre}>{JSON.stringify(result, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
