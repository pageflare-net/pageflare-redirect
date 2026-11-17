import {jwtSecret} from "../secret";
import { Router } from "express";
import {
  addConfig,
  getConfigByUUID,
  getConfigs,
  getRedirectStats,
  createUser,
  findUserByUsername,
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
  }
);

const createConfigSchema = z.object({
  source: z.string().toLowerCase().regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/),
  target: z.string().url().refine(value=>["http:","https:"].includes(new URL(value).protocol),"HTTP(S) destinations only"),
});

router.post(
  "/configs",
  validateBody(createConfigSchema),
  authenticateWithBearer(),
  async (req, res) => {
    const { source, target } = req.body;

    try {
      await addConfig(source, target);
      logger.info("Config created", { source, target });
      res.status(201).json({
        message: "Config created successfully",
        config: { source, target },
      });
      return;
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        logger.warn("Config already exists", { source });
        res.status(409).json({
          message: "Config already exists",
        });
        return;
      }

      throw error;
    }
  }
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
  }
);

router.get("/ui-data", authenticateWithBearer(), async (req, res) => {
  const configs = (await getConfigs()) ?? [];
  const stats = await Promise.all(
    configs.map(async (config) => {
      const stat = await getRedirectStats(config.uuid);
      return {
        ...config,
        stats: stat,
      };
    })
  );

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
  if (prodMode) {
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

router.post("/login", validateBody(authSchema), async (req, res) => {
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
  const actual=Buffer.from(hash,"hex");const expected=Buffer.from(storedHash,"hex");
  const valid=actual.length===expected.length && crypto.timingSafeEqual(actual,expected);
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
});

// Network probes require a controlled egress service; never fetch user-selected hosts here.
router.get("/test-redirect/:uuid",authenticateWithBearer(),(_req,res)=>{res.status(503).json({message:"Network probes are unavailable until a restricted egress worker is configured"});});
export default router;
