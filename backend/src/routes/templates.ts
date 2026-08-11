import { Router, Request, Response, NextFunction } from "express";
import { linodeClient, getToken } from "../services/linode";
import { AxiosInstance } from "axios";

const router = Router();

export type TemplateId = "web-app" | "bastion" | "vpn" | "game-server" | "standalone";

interface FirewallOpts {
  sshSourceIp?: string;
  gamePort?: string;
}

interface TemplateDefinition {
  id: TemplateId;
  name: string;
  description: string;
  openPorts: string[];
  tags: string[];
  getFirewallRules: (opts: FirewallOpts) => object[];
  cloudInit: (opts: { sshKey?: string }) => string;
}

const HARDENING_BASE = `#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y fail2ban unattended-upgrades
systemctl enable fail2ban
systemctl start fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades
`;

const SSH_HARDENING = `
# Harden SSH: reduce auth tries, keep root login for key-based only
sed -i 's/^#*MaxAuthTries.*/MaxAuthTries 3/' /etc/ssh/sshd_config
sed -i 's/^#*LoginGraceTime.*/LoginGraceTime 30/' /etc/ssh/sshd_config
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl restart ssh || systemctl restart sshd
`;

const TEMPLATES: Record<TemplateId, TemplateDefinition> = {
  "web-app": {
    id: "web-app",
    name: "Web Application",
    description: "Nginx web server with fail2ban and auto-updates. Ports 80, 443 open to the world; SSH optionally restricted.",
    openPorts: ["22 (SSH)", "80 (HTTP)", "443 (HTTPS)"],
    tags: ["web"],
    getFirewallRules: ({ sshSourceIp }) => [
      { protocol: "TCP", ports: "80", addresses: { ipv4: ["0.0.0.0/0"], ipv6: ["::/0"] }, action: "ACCEPT", label: "allow-http" },
      { protocol: "TCP", ports: "443", addresses: { ipv4: ["0.0.0.0/0"], ipv6: ["::/0"] }, action: "ACCEPT", label: "allow-https" },
      { protocol: "TCP", ports: "22", addresses: { ipv4: [sshSourceIp ? `${sshSourceIp}/32` : "0.0.0.0/0"] }, action: "ACCEPT", label: "allow-ssh" },
    ],
    cloudInit: () => HARDENING_BASE + SSH_HARDENING + `
apt-get install -y nginx
systemctl enable nginx
systemctl start nginx
`,
  },

  "bastion": {
    id: "bastion",
    name: "Bastion / Jump Host",
    description: "Hardened SSH-only jump box. Acts as the single entry point to a private network. No other ports exposed.",
    openPorts: ["22 (SSH)"],
    tags: ["bastion", "security"],
    getFirewallRules: ({ sshSourceIp }) => [
      { protocol: "TCP", ports: "22", addresses: { ipv4: [sshSourceIp ? `${sshSourceIp}/32` : "0.0.0.0/0"] }, action: "ACCEPT", label: "allow-ssh" },
    ],
    cloudInit: () => HARDENING_BASE + SSH_HARDENING + `
# Install mosh for resilient SSH sessions
apt-get install -y mosh
`,
  },

  "vpn": {
    id: "vpn",
    name: "WireGuard VPN",
    description: "WireGuard VPN server installed and ready to configure. UDP 51820 open. SSH optionally restricted.",
    openPorts: ["22 (SSH)", "51820/UDP (WireGuard)"],
    tags: ["vpn", "wireguard"],
    getFirewallRules: ({ sshSourceIp }) => [
      { protocol: "UDP", ports: "51820", addresses: { ipv4: ["0.0.0.0/0"], ipv6: ["::/0"] }, action: "ACCEPT", label: "allow-wireguard" },
      { protocol: "TCP", ports: "22", addresses: { ipv4: [sshSourceIp ? `${sshSourceIp}/32` : "0.0.0.0/0"] }, action: "ACCEPT", label: "allow-ssh" },
    ],
    cloudInit: () => HARDENING_BASE + SSH_HARDENING + `
apt-get install -y wireguard
# Enable IP forwarding
echo 'net.ipv4.ip_forward=1' >> /etc/sysctl.conf
echo 'net.ipv6.conf.all.forwarding=1' >> /etc/sysctl.conf
sysctl -p
`,
  },

  "game-server": {
    id: "game-server",
    name: "Game Server",
    description: "SSH access plus TCP/UDP on your chosen game port. fail2ban protects SSH. Outbound unrestricted.",
    openPorts: ["22 (SSH)", "custom port (TCP+UDP)"],
    tags: ["game"],
    getFirewallRules: ({ sshSourceIp, gamePort }) => {
      const rules: object[] = [
        { protocol: "TCP", ports: "22", addresses: { ipv4: [sshSourceIp ? `${sshSourceIp}/32` : "0.0.0.0/0"] }, action: "ACCEPT", label: "allow-ssh" },
      ];
      if (gamePort) {
        rules.push(
          { protocol: "TCP", ports: gamePort, addresses: { ipv4: ["0.0.0.0/0"] }, action: "ACCEPT", label: "allow-game-tcp" },
          { protocol: "UDP", ports: gamePort, addresses: { ipv4: ["0.0.0.0/0"] }, action: "ACCEPT", label: "allow-game-udp" }
        );
      }
      return rules;
    },
    cloudInit: () => HARDENING_BASE + SSH_HARDENING,
  },

  "standalone": {
    id: "standalone",
    name: "Standalone / Dev",
    description: "Clean server with SSH only. Great for dev environments, cron runners, or anything you SSH into directly.",
    openPorts: ["22 (SSH)"],
    tags: ["standalone", "dev"],
    getFirewallRules: ({ sshSourceIp }) => [
      { protocol: "TCP", ports: "22", addresses: { ipv4: [sshSourceIp ? `${sshSourceIp}/32` : "0.0.0.0/0"] }, action: "ACCEPT", label: "allow-ssh" },
    ],
    cloudInit: () => HARDENING_BASE + SSH_HARDENING,
  },
};

async function createFirewall(client: AxiosInstance, label: string, inboundRules: object[], linodeId: number) {
  const r = await client.post("/networking/firewalls", {
    label,
    rules: {
      inbound: inboundRules,
      inbound_policy: "DROP",
      outbound: [],
      outbound_policy: "ACCEPT",
    },
    devices: { linodes: [linodeId] },
  });
  return r.data;
}

router.get("/", (_req, res) => {
  res.json(Object.values(TEMPLATES).map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    openPorts: t.openPorts,
    tags: t.tags,
  })));
});

router.post("/provision", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = linodeClient(getToken(req));
    const {
      template: templateId,
      region,
      type,
      image,
      rootPass,
      label,
      sshKey,
      sshSourceIp,
      gamePort,
    } = req.body as {
      template: TemplateId;
      region: string;
      type: string;
      image: string;
      rootPass: string;
      label: string;
      sshKey?: string;
      sshSourceIp?: string;
      gamePort?: string;
    };

    if (!templateId || !region || !type || !image || !rootPass || !label) {
      return res.status(400).json({ errors: [{ reason: "Missing required fields" }] });
    }

    const tmpl = TEMPLATES[templateId];
    if (!tmpl) {
      return res.status(400).json({ errors: [{ reason: `Unknown template: ${templateId}` }] });
    }

    if (templateId === "game-server" && !gamePort) {
      return res.status(400).json({ errors: [{ reason: "Game server template requires a game port" }] });
    }

    const cloudInitScript = tmpl.cloudInit({ sshKey });
    const userData = Buffer.from(cloudInitScript).toString("base64");

    const instancePayload: Record<string, unknown> = {
      label: `${label}-${templateId}`,
      region,
      type,
      image,
      root_pass: rootPass,
      private_ip: true,
      booted: false,
      tags: [...tmpl.tags, label],
      metadata: { user_data: userData },
    };

    if (sshKey?.trim()) {
      instancePayload.authorized_keys = [sshKey.trim()];
    }

    const instance = await client.post("/linode/instances", instancePayload);
    const instanceId: number = instance.data.id;

    const firewallRules = tmpl.getFirewallRules({ sshSourceIp, gamePort });
    const firewall = await createFirewall(client, `${label}-${templateId}-fw`, firewallRules, instanceId);

    await client.post(`/linode/instances/${instanceId}/boot`);

    res.json({
      instance: {
        id: instance.data.id,
        label: instance.data.label,
        status: instance.data.status,
        ipv4: instance.data.ipv4,
        region: instance.data.region,
        type: instance.data.type,
      },
      firewall: {
        id: firewall.id,
        label: firewall.label,
        rulesCount: firewallRules.length,
        inboundPolicy: "DROP",
      },
      template: tmpl.name,
      security: {
        fail2ban: true,
        sshHardened: true,
        unattendedUpgrades: true,
        sshKeyAuth: !!(sshKey?.trim()),
        sshSourceRestricted: !!sshSourceIp,
        sshSource: sshSourceIp ?? "0.0.0.0/0 (unrestricted)",
        firewallInboundDefault: "DROP",
      },
    });
  } catch (e) { next(e); }
});

export default router;
