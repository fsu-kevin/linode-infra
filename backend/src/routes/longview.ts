import { Router, Request, Response, NextFunction } from "express";
import { linodeClient, getToken } from "../services/linode";

const router = Router();

// List all Longview clients enrolled on the account
router.get("/clients", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = linodeClient(getToken(req));
    const r = await client.get("/longview/clients");
    res.json(r.data);
  } catch (e) { next(e); }
});

// Get a single Longview client (includes the install token needed for the agent)
router.get("/clients/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = linodeClient(getToken(req));
    const r = await client.get(`/longview/clients/${req.params.id}`);
    res.json(r.data);
  } catch (e) { next(e); }
});

// Create a new Longview client slot (returns install_code for the agent)
router.post("/clients", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = linodeClient(getToken(req));
    const r = await client.post("/longview/clients", req.body);
    res.json(r.data);
  } catch (e) { next(e); }
});

router.delete("/clients/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = linodeClient(getToken(req));
    const r = await client.delete(`/longview/clients/${req.params.id}`);
    res.json(r.data);
  } catch (e) { next(e); }
});

// Longview subscription tier info
router.get("/plan", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = linodeClient(getToken(req));
    const r = await client.get("/longview/plan");
    res.json(r.data);
  } catch (e) { next(e); }
});

export default router;
