import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface FirewallRule {
  label: string;
  action: string;
  protocol: string;
  ports?: string;
  addresses?: { ipv4?: string[]; ipv6?: string[] };
}

interface Firewall {
  id: number;
  label: string;
  status: string;
  created: string;
  updated: string;
  rules?: {
    inbound: FirewallRule[];
    inbound_policy: string;
    outbound: FirewallRule[];
    outbound_policy: string;
  };
}

const s: Record<string, React.CSSProperties> = {
  h1:         { margin: "0 0 0.25rem", fontSize: "1.4rem", fontWeight: 700 },
  sub:        { color: "#8b949e", marginBottom: "2rem", fontSize: "0.9rem" },
  grid:       { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1rem" },
  card:       { background: "#161b22", border: "1px solid #30363d", borderRadius: 10, padding: "1.25rem" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" },
  cardLabel:  { fontWeight: 700, fontSize: "0.95rem", color: "#e6edf3", marginBottom: "0.2rem" },
  cardId:     { color: "#6e7681", fontSize: "0.75rem" },
  status:     { display: "inline-block", padding: "0.2rem 0.55rem", borderRadius: 4, fontSize: "0.75rem", fontWeight: 700 },
  ruleTable:  { width: "100%", borderCollapse: "collapse" as const, fontSize: "0.78rem", marginTop: "0.5rem" },
  th:         { textAlign: "left" as const, color: "#6e7681", fontWeight: 600, padding: "0.25rem 0.4rem", borderBottom: "1px solid #21262d" },
  td:         { padding: "0.25rem 0.4rem", color: "#8b949e", verticalAlign: "top" as const },
  policy:     { display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", marginTop: "0.75rem", color: "#6e7681" },
  policyBadge:{ display: "inline-block", padding: "0.15rem 0.5rem", borderRadius: 4, fontSize: "0.72rem", fontWeight: 700 },
  expand:     { fontSize: "0.78rem", color: "#388bfd", cursor: "pointer", background: "none", border: "none", padding: "0.25rem 0", marginTop: "0.5rem" },
  empty:      { color: "#6e7681", fontStyle: "italic" as const, fontSize: "0.82rem" },
  err:        { color: "#f85149" },
  updated:    { color: "#6e7681", fontSize: "0.72rem", marginTop: "0.75rem" },
};

function statusStyle(status: string): React.CSSProperties {
  if (status === "enabled") return { ...s.status, background: "rgba(0,177,89,0.15)", color: "#00b159" };
  if (status === "disabled") return { ...s.status, background: "rgba(139,148,158,0.15)", color: "#8b949e" };
  return { ...s.status, background: "rgba(248,81,73,0.15)", color: "#f85149" };
}

function policyBadgeStyle(policy: string): React.CSSProperties {
  if (policy === "DROP" || policy === "DENY") return { ...s.policyBadge, background: "rgba(248,81,73,0.15)", color: "#f85149" };
  return { ...s.policyBadge, background: "rgba(0,177,89,0.12)", color: "#00b159" };
}

function RuleRow({ rule }: { rule: FirewallRule }) {
  const ips = [
    ...(rule.addresses?.ipv4 ?? []),
    ...(rule.addresses?.ipv6 ?? []),
  ];
  return (
    <tr>
      <td style={s.td}><span style={{ color: rule.action === "ACCEPT" ? "#00b159" : "#f85149" }}>{rule.action}</span></td>
      <td style={s.td}>{rule.protocol}</td>
      <td style={s.td}>{rule.ports ?? "any"}</td>
      <td style={s.td} title={ips.join(", ")}>{ips.length === 0 ? "any" : ips.length > 2 ? `${ips[0]} +${ips.length - 1}` : ips.join(", ")}</td>
      <td style={s.td}>{rule.label}</td>
    </tr>
  );
}

function FirewallCard({ fw, token }: { fw: Firewall; token: string }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<Firewall | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function expand() {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (!detail) {
      setLoadingDetail(true);
      try {
        const d = await apiFetch<Firewall>(`/firewalls/${fw.id}`, token);
        setDetail(d);
      } finally {
        setLoadingDetail(false);
      }
    }
  }

  const rules = detail?.rules ?? fw.rules;

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <div>
          <div style={s.cardLabel}>{fw.label}</div>
          <div style={s.cardId}>ID: {fw.id}</div>
        </div>
        <span style={statusStyle(fw.status)}>{fw.status}</span>
      </div>

      <div style={s.policy}>
        <span>Inbound default:</span>
        <span style={policyBadgeStyle(rules?.inbound_policy ?? "DROP")}>{rules?.inbound_policy ?? "—"}</span>
        <span style={{ marginLeft: "0.75rem" }}>Outbound default:</span>
        <span style={policyBadgeStyle(rules?.outbound_policy ?? "ACCEPT")}>{rules?.outbound_policy ?? "—"}</span>
      </div>

      <button style={s.expand} onClick={expand}>
        {expanded ? "▲ Hide rules" : "▼ Show rules"}
      </button>

      {expanded && (
        loadingDetail ? (
          <p style={s.empty}>Loading rules...</p>
        ) : rules ? (
          <>
            <div style={{ fontSize: "0.75rem", color: "#6e7681", marginTop: "0.75rem", marginBottom: "0.25rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Inbound ({rules.inbound.length} rule{rules.inbound.length !== 1 ? "s" : ""})
            </div>
            {rules.inbound.length === 0 ? (
              <p style={s.empty}>No allow rules — all inbound drops.</p>
            ) : (
              <table style={s.ruleTable}>
                <thead>
                  <tr>
                    <th style={s.th}>Action</th>
                    <th style={s.th}>Proto</th>
                    <th style={s.th}>Ports</th>
                    <th style={s.th}>Source</th>
                    <th style={s.th}>Label</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.inbound.map((r, i) => <RuleRow key={i} rule={r} />)}
                </tbody>
              </table>
            )}
          </>
        ) : null
      )}

      <div style={s.updated}>
        Updated {new Date(fw.updated).toLocaleString()}
      </div>
    </div>
  );
}

export default function Firewalls({ token }: { token: string }) {
  const [firewalls, setFirewalls] = useState<Firewall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ data: Firewall[] }>("/firewalls", token)
      .then(r => setFirewalls(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <p style={{ color: "#8b949e" }}>Loading firewalls...</p>;
  if (error) return <p style={s.err}>{error}</p>;

  return (
    <div>
      <h1 style={s.h1}>Firewalls</h1>
      <p style={s.sub}>{firewalls.length} firewall{firewalls.length !== 1 ? "s" : ""} in your account. Click any card to inspect its inbound rules.</p>

      {firewalls.length === 0 ? (
        <p style={{ color: "#6e7681" }}>No firewalls found. Deploy a VM from the Templates page to create one automatically.</p>
      ) : (
        <div style={s.grid}>
          {firewalls.map(fw => <FirewallCard key={fw.id} fw={fw} token={token} />)}
        </div>
      )}
    </div>
  );
}
