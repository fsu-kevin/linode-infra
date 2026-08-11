# linode-infra

A browser-based infrastructure provisioning portal for Akamai Cloud (Linode). Pick a VM template, fill in a few fields, and get a hardened server running in under 60 seconds with the firewall, fail2ban, and SSH hardening already taken care of.

I built this because every time I spun up a VM manually, something was different. Firewall rules got forgotten. fail2ban never got installed. SSH stayed wide open. This portal makes the secure path the default.

## What it does

**Deploy VM** gives you five templates, each pre-wired with the right firewall rules and a cloud-init hardening script that runs on first boot.

| Template | Ports | Use Case |
|---|---|---|
| Web Application | 80, 443, 22 | nginx, APIs, static sites |
| Bastion / Jump Host | 22 | Single SSH entry point to a private network |
| WireGuard VPN | 51820/UDP, 22 | Self-hosted VPN, IP forwarding enabled |
| Game Server | 22 + custom | Minecraft, Valheim, CS2, Factorio, etc. |
| Standalone / Dev | 22 | Dev boxes, cron runners, scratch VMs |

Every VM gets a Linode Cloud Firewall with `inbound_policy: DROP` (enforced at the hypervisor, not just UFW), fail2ban running on first boot, unattended security upgrades, and SSH hardened with `MaxAuthTries 3` and `LoginGraceTime 30`.

You can also lock SSH down to your IP address and add an SSH public key per deployment.

**App Stack** provisions a web server and PostgreSQL database as a pair with network isolation. The database firewall has no public inbound rules. Only the web server's private `192.168.x.x` address can reach port 5432, so the database is unreachable from the internet even though it has a public IP.

**Firewalls** lists all your account firewalls with expandable rule tables so you can audit what's actually open.

The rest of the pages (Instances, Volumes, Domains, NodeBalancers, Longview) are standard Linode API views.

## Architecture

```
Browser (React + Vite)
  TokenGate stores your Linode PAT in component state only
  never written to disk, never sent anywhere except the Linode API

  /api/* → Vite proxy → Express backend
                              |
                      X-Linode-Token header
                              |
                    Linode API v4
```

The backend is a thin authenticated proxy. It adds opinionated provisioning logic on top of the Linode API: template definitions, firewall rules, and cloud-init scripts. Your token travels in the `X-Linode-Token` header on every request and is forwarded directly to Linode. It is never logged or stored anywhere.

## Security model

**Cloud Firewall vs UFW**

Linode Cloud Firewalls operate at the hypervisor network layer, so traffic is dropped before it even reaches the VM's network interface. Even if the OS firewall is misconfigured or wiped, the Cloud Firewall holds. Every provisioned VM gets one with `inbound_policy: DROP` by default.

**Web + DB isolation**

The App Stack uses Linode's region-scoped private networking. The database has a public IP (Linode always assigns one) but its firewall has zero public inbound rules. The only allowed rule is port 5432 from the web server's private `192.168.x.x` address. The database doesn't respond to anything from the internet.

**cloud-init hardening**

The hardening script is base64-encoded and passed through `metadata.user_data` when the VM is created. It runs before the VM is exposed to any traffic since the firewall is attached before boot. It installs fail2ban, enables unattended-upgrades, and tightens sshd_config.

## Tech stack

React 18 + TypeScript for the frontend, Vite for bundling and the dev proxy. Express + TypeScript on the backend with Axios for Linode API calls. tsx for running TypeScript directly in development without a separate compile step. nginx + PM2 in production.

No database, no ORM, no auth server. The Linode API token is the credential and the Linode API is the data store.

## Project structure

```
backend/
  src/
    index.ts              Express app, route registration
    middleware/
      error.ts            Axios error → consistent JSON response shape
    routes/
      templates.ts        VM template provisioning
      provision.ts        Web + DB stack provisioning
      firewalls.ts        Firewall list and inspect
      instances.ts        Instance CRUD + power management
      volumes.ts
      domains.ts
      nodebalancers.ts
      longview.ts
    services/
      linode.ts           Axios client factory, token extraction

frontend/
  src/
    App.tsx               Routes
    components/
      Layout.tsx          Sidebar nav
      TokenGate.tsx       Token entry screen
    lib/
      api.ts              apiFetch wrapper
    pages/
      Deploy.tsx          Template picker + VM provisioner
      Provision.tsx       Web + DB stack provisioner
      Firewalls.tsx       Firewall audit view
      Instances.tsx
      Volumes.tsx
      Domains.tsx
      NodeBalancers.tsx
      Longview.tsx

deploy/
  provision-vm.sh         Bootstrap a Linode VM to host this app
  setup-server.sh         Install nginx, Node, PM2 on the VM
  redeploy.sh             Push code updates to a running VM
```

## Quick start

You need Node.js 20+ and a [Linode Personal Access Token](https://cloud.linode.com/profile/tokens) with read/write access to Linodes, Firewalls, and Longview.

```bash
make install
cp backend/.env.example backend/.env
make dev
```

Open http://localhost:5173, enter your token, and you're in. The backend runs on `:3001` and the Vite dev server proxies `/api/*` to it.

## Deploying the app itself to Linode

```bash
LINODE_TOKEN=your_token ROOT_PASS=your_password make provision
```

This creates a VM, attaches a Cloud Firewall, waits for SSH, runs `setup-server.sh` remotely, builds the frontend, and syncs everything over. Takes a few minutes the first time.

```bash
SERVER_IP=your_vm_ip make redeploy
```

For subsequent deploys — builds the frontend locally and rsyncs the changes.

**Environment variables**

| Variable | Default | Description |
|---|---|---|
| `LINODE_TOKEN` | required | Linode Personal Access Token |
| `ROOT_PASS` | required | Root password for the new VM |
| `REGION` | `us-east` | Linode region ID |
| `TYPE` | `g6-nanog-1` | Linode plan ID |
| `IMAGE` | `linode/debian12` | OS image ID |
| `LABEL` | `infra-app` | Label applied to VM and related resources |

## Adding a new VM template

Templates live in `backend/src/routes/templates.ts`. Each one needs an id, name, description, a function that returns the firewall rules, and a cloud-init script.

```typescript
{
  id: "my-template",
  name: "My Template",
  description: "...",
  openPorts: ["22 (SSH)", "8080 (App)"],
  tags: ["my-template"],
  getFirewallRules: ({ sshSourceIp }) => [...],
  cloudInit: () => `#!/bin/bash\n...`,
}
```

The frontend reads the template list from `GET /api/templates` at startup so no frontend changes are needed.

## What's next

SSH key management across deployments, VLAN support for stronger multi-VM isolation, firewall rule editing from the UI, Longview graphs inline on the Instances page, Object Storage management, and a Terraform export for any provisioned stack.

## Author

**Kevin Lapommeray**

## License

MIT — [github.com/fsu-kevin](https://github.com/fsu-kevin)
