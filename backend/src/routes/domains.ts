import { Router, Request, Response, NextFunction } from "express";
import { linodeClient, getToken } from "../services/linode";

const router = Router();

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = linodeClient(getToken(req));
    const r = await client.get("/domains");
    res.json(r.data);
  } catch (e) { next(e); }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = linodeClient(getToken(req));
    const r = await client.post("/domains", req.body);
    res.json(r.data);
  } catch (e) { next(e); }
});

router.get("/:id/records", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = linodeClient(getToken(req));
    const r = await client.get(`/domains/${req.params.id}/records`);
    res.json(r.data);
  } catch (e) { next(e); }
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = linodeClient(getToken(req));
    const r = await client.delete(`/domains/${req.params.id}`);
    res.json(r.data);
  } catch (e) { next(e); }
});

export default router;
