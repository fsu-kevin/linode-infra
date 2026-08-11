import { Router, Request, Response, NextFunction } from "express";
import { linodeClient, getToken } from "../services/linode";

const router = Router();

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = linodeClient(getToken(req));
    const r = await client.get("/networking/firewalls");
    res.json(r.data);
  } catch (e) { next(e); }
});

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = linodeClient(getToken(req));
    const [fw, rules, devices] = await Promise.all([
      client.get(`/networking/firewalls/${req.params.id}`),
      client.get(`/networking/firewalls/${req.params.id}/rules`),
      client.get(`/networking/firewalls/${req.params.id}/devices`),
    ]);
    res.json({ ...fw.data, rules: rules.data, devices: devices.data });
  } catch (e) { next(e); }
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = linodeClient(getToken(req));
    await client.delete(`/networking/firewalls/${req.params.id}`);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
