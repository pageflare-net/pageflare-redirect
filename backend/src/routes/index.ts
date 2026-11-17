import { Router } from "express";
import logger from "../logger";
import UI from "./ui";
import REDIRECT from "./redirect";
import API from "./api";
import { getDb } from "../mongo";

const router = Router();

router.get("/", (req, res) => {
  logger.info("Health check route hit");
  res.status(200).json({
    message: "Pageflare Redirect API",
  });
});

export function registerRoutes(app: Router) {
  logger.info("Registering all routes");

  app.get("/api/health", async (_req, res) => {
    try {
      await getDb().command({ ping: 1 });
      res.json({ status: "ok", db: "connected" });
    } catch {
      res.status(503).json({ status: "error", db: "unreachable" });
    }
  });
  app.use("/", router);
  app.use("/ui", UI);
  app.use("/redirect", REDIRECT);
  app.use("/api", API);
}
