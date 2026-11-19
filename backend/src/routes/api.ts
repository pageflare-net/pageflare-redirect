import { loginRateLimiter } from "../middlewares/rateLimit";
import { jwtSecret } from "../secret";
import { Router } from "express";
import {
  addConfig,
  getConfigByUUID,
  getConfigs,
  getRedirectStats,
  createUser,
  findUserByUsername,
  updateConfig,
  deleteConfig,
  getStatsForConfigurations,
} from "../mongo";
import { validateBody, validateParams } from "../middlewares/validate";
import { z } from "zod";
import logger from "../logger";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { authenticateWithBearer } from "../middlewares/authenticate";

const prodMode = process.env.NODE_ENV === "production";

const router = Router();

// Serve static files for the frontend dashboard
router.get("/configs", authenticateWithBearer(), async (req, res) => {
  const configs = (await getConfigs()) ?? [];
  logger.info(`Retrieved ${configs.length} configs`);

  res.status(200).json({
    message: "Configs retrieved successfully",
    configs,
  });
});

const uuidParamsSchema = z.object({
  uuid: z.string().uuid(),
});

router.get(
  "/configs/:uuid",
  validateParams(uuidParamsSchema),
  authenticateWithBearer(),
  async (req, res) => {
    const { uuid } = req.params;
    const config = await getConfigByUUID(uuid as string);
    if (!config) {
      logger.warn(`Config ${uuid} not found`);
      res.status(404).json({
        message: `Config ${uuid} not found`,
      });
      return;
    }
    res.status(200).json({
      message: "Config retrieved successfully",
      config,
    });
  },
);

const configFields = z
  .object({
    source: z
      .string()
      .trim()
      .max(253)
      .toLowerCase()
      .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/),
    target: z
      .string()
      .trim()
      .max(2048)
      .url()
      .refine((value) => {
        try {
          const url = new URL(value);
          return (
            ["http:", "https:"].includes(url.protocol) &&
            !url.username &&
            !url.password &&
            !/[\u0000-\u0020\u007f]/.test(value)
          );
        } catch {
          return false;
        }
      }, "Use an HTTP(S) destination without credentials or whitespace"),
  })
  .strict();
const createConfigSchema = configFields.refine((value) => {
  try {
    return new URL(value.target).hostname.toLowerCase() !== value.source;
  } catch {
    return false;
  }
}, "Source and destination hostname must differ to avoid redirect loops");
const updateConfigSchema = configFields
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide a source or destination",
  );

router.post(
  "/configs",
  authenticateWithBearer(),
  validateBody(createConfigSchema),
  async (req, res) => {
    const { source, target } = req.body;

    try {
      const config = await addConfig(source, target);
      logger.info("Config created", { source, target });
      res.status(201).json({
        message: "Config created successfully",
        config,
      });
      return;
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("already exists") ||
          (error as { code?: number }).code === 11000)
      ) {
        logger.warn("Config already exists", { source });
        res.status(409).json({
          message: "Config already exists",
        });
        return;
      }

      throw error;
    }
  },
);

router.patch(
  "/configs/:uuid",
  authenticateWithBearer(),
  validateParams(uuidParamsSchema),
  validateBody(updateConfigSchema),
  async (req, res) => {
    const uuid = req.params.uuid as string;
    const current = await getConfigByUUID(uuid);
    if (!current) {
      res.status(404).json({ message: "Redirect not found" });
      return;
    }
    const parsed = createConfigSchema.safeParse({
      source: req.body.source ?? current.source,
      target: req.body.target ?? current.target,
    });
    if (!parsed.success) {
      res
        .status(400)
        .json({
          message: "Invalid redirect configuration",
          errors: parsed.error.errors,
        });
      return;
    }
    try {
      const config = await updateConfig(
        uuid,
        parsed.data.source,
        parsed.data.target,
      );
      if (!config) {
        res.status(404).json({ message: "Redirect not found" });
        return;
      }
      res.json({ message: "Redirect updated", config });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        res.status(409).json({ message: "Source hostname already exists" });
        return;
      }
      throw error;
    }
  },
);

router.delete(
  "/configs/:uuid",
  authenticateWithBearer(),
  validateParams(uuidParamsSchema),
  async (req, res) => {
    if (!(await deleteConfig(req.params.uuid as string))) {
      res.status(404).json({ message: "Redirect not found" });
      return;
    }
    res.status(204).end();
  },
);

router.get(
  "/stats/:uuid",
  validateParams(uuidParamsSchema),
  authenticateWithBearer(),
  async (req, res) => {
    const { uuid } = req.params;
    const config = await getRedirectStats(uuid as string);
    if (!config) {
      logger.warn(`Stats for ${uuid} not found`);
      res.status(404).json({
        message: `Stats for ${uuid} not found`,
      });
      return;
    }
    res.status(200).json({
      message: "Stats retrieved successfully",
      config,
    });
  },
);

router.get("/ui-data", authenticateWithBearer(), async (req, res) => {
  const configs = (await getConfigs()) ?? [];
  const recorded = new Map(
    (await getStatsForConfigurations(configs.map((config) => config.uuid))).map(
      (stat) => [stat.uuid, stat],
    ),
  );
  const stats = configs.map((config) => ({
    ...config,
    stats: recorded.get(config.uuid) ?? null,
  }));

  res.status(200).json({
    message: "UI data retrieved successfully",
    stats,
  });
});

const authSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
});

router.post("/register", validateBody(authSchema), async (req, res) => {
  if (prodMode || process.env.PAGEFLARE_DEMO !== "true") {
    logger.warn("Register endpoint is disabled in production");
    res.status(403).json({
      message: "Register endpoint is disabled in production",
    });
    return;
  }
  const { username, password } = req.body;

  const user = await findUserByUsername(username);
  if (user) {
    logger.warn(`Register failed for ${username}: user already exists`);
    res.status(409).json({
      message: "User already exists",
    });
    return;
  }

  await createUser(username, password);
  logger.info(`User registered: ${username}`);
  res.status(201).json({ message: "User registered" });
});

router.post(
  "/login",
  loginRateLimiter,
  validateBody(authSchema),
  async (req, res) => {
    const { username, password } = req.body;

    const user = await findUserByUsername(username);

    if (!user) {
      logger.warn(`Login failed for ${username}: user not found`);
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const [salt, storedHash] = user.passwordHash.split(":");
    const hash = crypto
      .pbkdf2Sync(password, salt, 100000, 64, "sha512")
      .toString("hex");
    const actual = Buffer.from(hash, "hex");
    const expected = Buffer.from(storedHash, "hex");
    const valid =
      actual.length === expected.length &&
      crypto.timingSafeEqual(actual, expected);
    if (!valid) {
      logger.warn(`Invalid password for user: ${username}`);
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const token = jwt.sign({ username, id: user!._id }, jwtSecret(), {
      expiresIn: "7d",
    });

    logger.info(`User logged in: ${username}`);
    res.json({ token });
  },
);

// Network probes require a controlled egress service; never fetch user-selected hosts here.
router.get("/test-redirect/:uuid", authenticateWithBearer(), (_req, res) => {
  res.status(503).json({
    message:
      "Network probes are unavailable until a restricted egress worker is configured",
  });
});
export default router;
