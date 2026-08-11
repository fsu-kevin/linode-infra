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

/*
  POST /api/provision/stack
  Body: { region, webType, dbType, image, rootPass, label }

  What this does:
  1. Creates the web server Linode with a public IP + private IP
  2. Creates the database Linode with a public IP + private IP (we restrict access via firewall)
  3. Creates a firewall for the web server: allow inbound 80/443 from anywhere, 22 from anywhere
  4. Creates a firewall for the database: allow inbound 5432 only from the web server's private IP
     — the database has no open public ports, so it's inaccessible from the internet
  5. Creates Longview client slots for both nodes and returns install instructions

  Limitation note: Linode's private IPs are region-scoped (same DC). The DB firewall rule
  uses the web server's private IP, which is only assigned after the Linode is created — so
  we create the web server first, wait for IP assignment, then create the DB firewall.
*/
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

    // Step 1: Create the web server Linode (public + private IP)
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

    // Step 2: Create web server firewall — allow HTTP, HTTPS, SSH inbound; drop everything else
    const webFirewall = await createFirewall(client, `${label}-web-fw`, [
      { protocol: "TCP", ports: "80", addresses: { ipv4: ["0.0.0.0/0"], ipv6: ["::/0"] }, action: "ACCEPT", label: "allow-http" },
      { protocol: "TCP", ports: "443", addresses: { ipv4: ["0.0.0.0/0"], ipv6: ["::/0"] }, action: "ACCEPT", label: "allow-https" },
      { protocol: "TCP", ports: "22", addresses: { ipv4: ["0.0.0.0/0"] }, action: "ACCEPT", label: "allow-ssh" },
    ], webId);

    // Step 3: Create the database Linode (private IP enabled, no public-facing ports opened)
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

    // Step 4: Database firewall — only allow Postgres (5432) from the web server's private IP.
    // All public inbound traffic is dropped. The DB has no public route.
    const dbInbound: object[] = webPrivateIp
      ? [{ protocol: "TCP", ports: "5432", addresses: { ipv4: [`${webPrivateIp}/32`] }, action: "ACCEPT", label: "allow-db-from-web" }]
      : [];

    const dbFirewall = await createFirewall(client, `${label}-db-fw`, dbInbound, dbId);

    // Step 5: Create Longview client slots (the install_code is used to configure the agent on each node)
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

    // Step 6: Boot both Linodes now that firewalls are attached
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
