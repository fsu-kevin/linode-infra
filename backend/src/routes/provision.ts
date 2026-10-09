import { Router, Request, Response, NextFunction } from "express";
import { linodeClient, getToken } from "../services/linode";
import { AxiosInstance } from "axios";

const router = Router();

// Lists available regions, types, and images so the frontend can populate dropdowns
router.get("/options", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = linodeClient(getToken(req));
    const [regions, types, images] = await Promise.all([
      client.get("/regions"),
      client.get("/linode/types"),
      client.get("/images?filter={\"is_public\":true}"),
    ]);
    res.json({
      regions: regions.data.data,
      types: types.data.data,
      images: images.data.data,
    });
  } catch (e) { next(e); }
});

async function createFirewall(
  client: AxiosInstance,
  label: string,
  inboundRules: object[],
  linodeId?: number
) {
  const payload: Record<string, unknown> = {
    label,
    rules: {
      inbound: inboundRules,
      inbound_policy: "DROP",
      outbound: [],
      outbound_policy: "ACCEPT",
    },
  };
  if (linodeId) {
    payload.devices = { linodes: [linodeId] };
  }
  const r = await client.post("/networking/firewalls", payload);
  return r.data;
}

// Web server is created first so its private IP is available when building the DB firewall rule.
// Private IPs are only assigned after instance creation, so the order matters here.
router.post("/stack", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = linodeClient(getToken(req));
    const { region, webType, dbType, image, rootPass, label } = req.body as {
      region: string;
      webType: string;
      dbType: string;
      image: string;
      rootPass: string;
      label: string;
    };

    if (!region || !webType || !dbType || !image || !rootPass || !label) {
      return res.status(400).json({ errors: [{ reason: "Missing required fields" }] });
    }

    const webServer = await client.post("/linode/instances", {
      label: `${label}-web`,
      region,
      type: webType,
      image,
      root_pass: rootPass,
      private_ip: true,           // enables 192.168.x.x private IP within the region
      booted: false,              // don't boot yet — attach firewall first
      tags: ["web", label],
    });
    const webId: number = webServer.data.id;
    const webPrivateIp: string | undefined = webServer.data.ipv4?.find((ip: string) =>
      ip.startsWith("192.168.")
    );

    const webFirewall = await createFirewall(client, `${label}-web-fw`, [
      { protocol: "TCP", ports: "80", addresses: { ipv4: ["0.0.0.0/0"], ipv6: ["::/0"] }, action: "ACCEPT", label: "allow-http" },
      { protocol: "TCP", ports: "443", addresses: { ipv4: ["0.0.0.0/0"], ipv6: ["::/0"] }, action: "ACCEPT", label: "allow-https" },
      { protocol: "TCP", ports: "22", addresses: { ipv4: ["0.0.0.0/0"] }, action: "ACCEPT", label: "allow-ssh" },
    ], webId);

    const dbServer = await client.post("/linode/instances", {
      label: `${label}-db`,
      region,
      type: dbType,
      image,
      root_pass: rootPass,
      private_ip: true,
      booted: false,
      tags: ["database", label],
    });
    const dbId: number = dbServer.data.id;

    // DB firewall allows port 5432 from the web server's private IP only. Nothing public.
    const dbInbound: object[] = webPrivateIp
      ? [{ protocol: "TCP", ports: "5432", addresses: { ipv4: [`${webPrivateIp}/32`] }, action: "ACCEPT", label: "allow-db-from-web" }]
      : [];

    const dbFirewall = await createFirewall(client, `${label}-db-fw`, dbInbound, dbId);

    // Longview slots — non-fatal, free plan caps at 5 clients
    let webLongview = null;
    let dbLongview = null;
    try {
      const [wlv, dlv] = await Promise.all([
        client.post("/longview/clients", { label: `${label}-web-lv` }),
        client.post("/longview/clients", { label: `${label}-db-lv` }),
      ]);
      webLongview = wlv.data;
      dbLongview = dlv.data;
    } catch {
      // Longview creation is non-fatal (free plan allows 5 clients)
    }

    // Boot after firewalls are attached so the VMs are never briefly exposed
    await Promise.all([
      client.post(`/linode/instances/${webId}/boot`),
      client.post(`/linode/instances/${dbId}/boot`),
    ]);

    res.json({
      webServer: { ...webServer.data, firewall: webFirewall },
      dbServer: { ...dbServer.data, firewall: dbFirewall },
      longview: {
        web: webLongview,
        db: dbLongview,
        note: "SSH into each Linode and run the curl install command shown with the install_code to activate the Longview agent.",
      },
      networkingNote:
        "The database has no inbound rules for public IPs. Only the web server's private IP (192.168.x.x) can reach port 5432. Both share the same region so the private IP route works without going over the public internet.",
    });
  } catch (e) { next(e); }
});

export default router;
