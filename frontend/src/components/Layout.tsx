import { NavLink } from "react-router-dom";

const NAV = [
  { to: "/",            label: "Deploy VM",     group: "deploy" },
  { to: "/stack",       label: "App Stack",     group: "deploy" },
  { to: "/firewalls",   label: "Firewalls",     group: "infra" },
  { to: "/instances",   label: "Instances",     group: "infra" },
  { to: "/volumes",     label: "Volumes",       group: "infra" },
  { to: "/domains",     label: "Domains",       group: "infra" },
  { to: "/nodebalancers", label: "NodeBalancers", group: "infra" },
  { to: "/longview",    label: "Longview",      group: "infra" },
];

const s: Record<string, React.CSSProperties> = {
  shell:       { display: "flex", minHeight: "100vh" },
  sidebar:     { width: 210, background: "#161b22", borderRight: "1px solid #30363d", padding: "1.5rem 0", flexShrink: 0, display: "flex", flexDirection: "column" as const },
  brand:       { padding: "0 1.25rem 1.5rem", fontWeight: 800, fontSize: "1.05rem", color: "#00b159", letterSpacing: "-0.5px" },
  section:     { padding: "0 1.25rem 0.35rem", fontSize: "0.68rem", fontWeight: 700, color: "#484f58", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginTop: "0.75rem" },
  link:        { display: "block", padding: "0.55rem 1.25rem", color: "#8b949e", textDecoration: "none", fontSize: "0.88rem", borderLeft: "3px solid transparent" },
  activeLink:  { color: "#e6edf3", borderLeft: "3px solid #00b159", background: "rgba(0,177,89,0.07)" },
  main:        { flex: 1, padding: "2rem", overflowY: "auto" as const },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const deployLinks = NAV.filter(n => n.group === "deploy");
  const infraLinks  = NAV.filter(n => n.group === "infra");

  return (
    <div style={s.shell}>
      <nav style={s.sidebar}>
        <div style={s.brand}>Linode Infra</div>

        <div style={s.section}>Provision</div>
        {deployLinks.map(n => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            style={({ isActive }) => ({ ...s.link, ...(isActive ? s.activeLink : {}) })}
          >
            {n.label}
          </NavLink>
        ))}

        <div style={s.section}>Manage</div>
        {infraLinks.map(n => (
          <NavLink
            key={n.to}
            to={n.to}
            style={({ isActive }) => ({ ...s.link, ...(isActive ? s.activeLink : {}) })}
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
      <main style={s.main}>{children}</main>
    </div>
  );
}
