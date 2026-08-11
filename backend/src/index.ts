import "dotenv/config";
import express from "express";
import cors from "cors";

import instancesRouter from "./routes/instances";
import volumesRouter from "./routes/volumes";
import domainsRouter from "./routes/domains";
import nodebalancersRouter from "./routes/nodebalancers";
import longviewRouter from "./routes/longview";
import provisionRouter from "./routes/provision";
import templatesRouter from "./routes/templates";
import firewallsRouter from "./routes/firewalls";
import { errorHandler } from "./middleware/error";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.use("/api/instances", instancesRouter);
app.use("/api/volumes", volumesRouter);
app.use("/api/domains", domainsRouter);
app.use("/api/nodebalancers", nodebalancersRouter);
app.use("/api/longview", longviewRouter);
app.use("/api/provision", provisionRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/firewalls", firewallsRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
