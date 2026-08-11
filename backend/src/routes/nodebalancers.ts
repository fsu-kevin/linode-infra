import { Router, Request, Response, NextFunction } from "express";
import { linodeClient, getToken } from "../services/linode";

const router = Router();

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = linodeClient(getToken(req));
    const r = await client.get("/nodebalancers");
    res.json(r.data);
  } catch (e) { next(e); }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = linodeClient(getToken(req));
    const r = await client.post("/nodebalancers", req.body);
    res.json(r.data);
  } catch (e) { next(e); }
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = linodeClient(getToken(req));
    const r = await client.delete(`/nodebalancers/${req.params.id}`);
    res.json(r.data);
  } catch (e) { next(e); }
});

export default router;
