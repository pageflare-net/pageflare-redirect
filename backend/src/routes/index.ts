import { Router } from "express";
import logger from "../logger";
import UI from "./ui";
import REDIRECT from "./redirect";
import API from "./api";

const router = Router();

router.get("/", (req, res) => {
  logger.info("Health check route hit");
  res.status(200).json({
    message: "Pageflare Redirect API",
  });
});

export function registerRoutes(app: Router) {
  logger.info("Registering all routes");

  app.use("/", router);
  app.use("/ui", UI);
  app.use("/redirect", REDIRECT);
  app.use("/api", API);
}
