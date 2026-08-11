import { Router, Request, Response, NextFunction } from "express";
import { linodeClient, getToken } from "../services/linode";

const router = Router();

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = linodeClient(getToken(req));
    const r = await client.get("/linode/instances");
    res.json(r.data);
  } catch (e) { next(e); }
});

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = linodeClient(getToken(req));
    const r = await client.get(`/linode/instances/${req.params.id}`);
    res.json(r.data);
  } catch (e) { next(e); }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = linodeClient(getToken(req));
    const r = await client.post("/linode/instances", req.body);
    res.status(200).json(r.data);
  } catch (e) { next(e); }
});

router.post("/:id/boot", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = linodeClient(getToken(req));
    const r = await client.post(`/linode/instances/${req.params.id}/boot`);
    res.json(r.data);
  } catch (e) { next(e); }
});

router.post("/:id/reboot", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = linodeClient(getToken(req));
    const r = await client.post(`/linode/instances/${req.params.id}/reboot`);
    res.json(r.data);
  } catch (e) { next(e); }
});

router.post("/:id/shutdown", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = linodeClient(getToken(req));
    const r = await client.post(`/linode/instances/${req.params.id}/shutdown`);
    res.json(r.data);
  } catch (e) { next(e); }
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = linodeClient(getToken(req));
    const r = await client.delete(`/linode/instances/${req.params.id}`);
    res.json(r.data);
  } catch (e) { next(e); }
});

export default router;
