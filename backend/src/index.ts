import { jwtSecret } from "./secret";
// Pageflare Redirect - Express server
import express from "express";
import { connectToMongo } from "./mongo";
import { registerRoutes } from "./routes";
import logger from "./logger";
import cors from "cors";
import helmet from "helmet";
import { globalRateLimiter } from "./middlewares/rateLimit";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(
  cors({ origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:4330" }),
);
app.use(helmet());
app.use(express.json({ limit: "32kb" }));
app.use(globalRateLimiter);

const port = process.env.PORT || 3000;
const prodMode = process.env.NODE_ENV === "production";

async function boot() {
  jwtSecret();
  logger.info("Booting up Pageflare Redirect...");

  if (prodMode && !process.env.JWT_SECRET) {
    logger.error("JWT_SECRET is not set in production mode");
    process.exit(1);
  }

  logger.info("Connecting to MongoDB...");
  await connectToMongo();

  logger.info("Registering routes...");
  registerRoutes(app);

  logger.info("Starting server...");
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      logger.error("request_failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
      res.status(500).json({ message: "Request failed" });
    },
  );
  app.listen(port, () => {
    logger.info(
      `Pageflare Redirect listening on port ${port}, mode: ${prodMode ? "PROD" : "DEV"}`,
    );
  });
}
boot().catch((error) => {
  logger.error("startup_failed", error);
  process.exit(1);
});
