import { MongoClient } from "mongodb";
import { format } from "date-fns";
import logger from "./logger";
import crypto from "crypto";

// MongoDB connection URI
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/redirects";

// Create a MongoDB client
const client = new MongoClient(MONGO_URI, {
  timeoutMS: 10000,
  connectTimeoutMS: 10000,
  serverSelectionTimeoutMS: 10000,
});

/**
 * Connects to MongoDB using native MongoDB driver
 */
export async function connectToMongo(): Promise<void> {
  await client.connect();
  await client
    .db()
    .collection("configs")
    .createIndex({ source: 1 }, { unique: true });
  await client.db().collection("configs").createIndex({ uuid: 1 }, { unique: true });
  await client
    .db()
    .collection("users")
    .createIndex({ username: 1 }, { unique: true });
  await client
    .db()
    .collection("stats")
    .createIndex({ uuid: 1 }, { unique: true });
  logger.info("Connected to MongoDB");
}

type Config = {
  uuid: string;
  source: string;
  target: string;
  createdAt: Date;
};

export async function addConfig(source: string, target: string): Promise<Config> {
  // Check if the config already exists
  const config = await findConfigByHostname(source);
  if (config) {
    logger.warn(`Attempted to add duplicate config for ${source}`);
    throw new Error(
      `Config for ${source} already exists with UUID: ${config.uuid}`,
    );
  }

  const newConfig: Config = {
    uuid: crypto.randomUUID(),
    source,
    target,
    createdAt: new Date(),
  };
  await client.db().collection<Config>("configs").insertOne(newConfig);
  logger.info(
    `Added new config for ${source} -> ${target} with UUID: ${newConfig.uuid}`,
  );
  return newConfig;
}

export async function updateConfig(uuid: string, source: string, target: string): Promise<Config | null> {
  return client.db().collection<Config>("configs").findOneAndUpdate(
    { uuid }, { $set: { source, target } }, { returnDocument: "after" },
  );
}

export async function deleteConfig(uuid: string): Promise<boolean> {
  const result = await client.db().collection<Config>("configs").deleteOne({ uuid });
  if (!result.deletedCount) return false;
  await client.db().collection("stats").deleteOne({ uuid });
  return true;
}

export async function getStatsForConfigurations(uuids: string[]): Promise<RedirectStats[]> {
  return client.db().collection<RedirectStats>("stats").find({ uuid: { $in: uuids } }).toArray();
}

export async function disconnectFromMongo(): Promise<void> { await client.close(); }

export function findConfigByHostname(hostname: string): Promise<Config | null> {
  return client
    .db()
    .collection<Config>("configs")
    .findOne({ source: hostname });
}

export async function getConfigs(): Promise<Config[]> {
  return client.db().collection<Config>("configs").find().toArray();
}

export async function getConfigByUUID(uuid: string): Promise<Config | null> {
  return client.db().collection<Config>("configs").findOne({ uuid });
}

export type RedirectStats = {
  uuid: string;
  redirectCounts: Record<string, number>;
  totalRedirects: number;
  lastRedirected: Date;
  firstRedirected: Date;
};

export async function getRedirectStats(
  uuid: string,
): Promise<RedirectStats | null> {
  return client.db().collection<RedirectStats>("stats").findOne({ uuid });
}

export async function logRedirect(uuid: string): Promise<void> {
  const today = new Date();
  const formattedDate = format(today, "yyyy-MM-dd");

  const db = getDb();
  const redirectsCollection = db.collection("stats");

  await redirectsCollection.updateOne(
    { uuid },
    {
      $inc: { totalRedirects: 1, [`redirectCounts.${formattedDate}`]: 1 },
      $set: { lastRedirected: today },
      $setOnInsert: { firstRedirected: today },
    },
    { upsert: true },
  );
}

export type User = {
  _id?: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
};

export async function createUser(
  username: string,
  password: string,
): Promise<void> {
  const existing = await client
    .db()
    .collection<User>("users")
    .findOne({ username });
  if (existing) {
    logger.warn(`Attempted to create duplicate user: ${username}`);
    throw new Error(`User ${username} already exists`);
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");
  const user: User = {
    username,
    passwordHash: `${salt}:${passwordHash}`,
    createdAt: new Date(),
  };
  await client.db().collection<User>("users").insertOne(user);
  logger.info(`Created new user: ${username}`);
}

export async function findUserByUsername(
  username: string,
): Promise<User | null> {
  return client.db().collection<User>("users").findOne({ username });
}

// Export MongoDB client to be used elsewhere in the application
export const getDb = () => client.db();

// Default export for easier importing
export default {
  connectToMongo,
  getDb,
};
