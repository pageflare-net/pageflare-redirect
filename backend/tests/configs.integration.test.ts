import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import express from "express";
import jwt from "jsonwebtoken";
import type { Server } from "node:http";
const address =
  process.env.PAGEFLARE_REDIRECT_TEST_URL ??
  "mongodb://127.0.0.1:55440/pageflare_redirect_test";
const parsed = new URL(address);
if (
  !["localhost", "127.0.0.1"].includes(parsed.hostname) ||
  !parsed.pathname.endsWith("_test")
)
  throw Error("Use only a loopback test database");
process.env.MONGO_URI = address;
process.env.JWT_SECRET = "isolated-test-only-signing-secret-not-for-deployment";
const mongo = await import("../src/mongo");
const router = (await import("../src/routes/api")).default;
let server: Server;
let origin: string;
const ids: string[] = [];
const prefix = "test-crud-" + Date.now();
const token = jwt.sign(
  { username: "test-fixture", id: "test-fixture" },
  process.env.JWT_SECRET,
);
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};
const call = (
  path: string,
  method = "GET",
  data?: unknown,
  authenticated = true,
) =>
  fetch(origin + "/api" + path, {
    method,
    headers: authenticated ? headers : { "Content-Type": "application/json" },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
beforeAll(async () => {
  await mongo.connectToMongo();
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  for (const uuid of ids) await mongo.deleteConfig(uuid);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await mongo.disconnectFromMongo();
});
describe("redirect management with real isolated MongoDB", () => {
  test("unauthenticated writes are rejected", async () => {
    expect(
      (
        await call(
          "/configs",
          "POST",
          { source: prefix + ".example", target: "https://example.com" },
          false,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await call(
          "/configs/" + crypto.randomUUID(),
          "PATCH",
          { target: "https://example.com" },
          false,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await call(
          "/configs/" + crypto.randomUUID(),
          "DELETE",
          undefined,
          false,
        )
      ).status,
    ).toBe(401);
  });
  test("create, edit with retained analytics, duplicate conflict and delete", async () => {
    const create = await call("/configs", "POST", {
      source: prefix + ".example",
      target: "https://example.com/old",
    });
    expect(create.status).toBe(201);
    const first = (await create.json()).config;
    ids.push(first.uuid);
    await mongo.logRedirect(first.uuid);
    const patch = await call("/configs/" + first.uuid, "PATCH", {
      target: "https://example.com/new",
    });
    expect(patch.status).toBe(200);
    expect((await patch.json()).config.uuid).toBe(first.uuid);
    const list = await (await call("/ui-data")).json();
    expect(
      list.stats.find((x: { uuid: string }) => x.uuid === first.uuid).stats
        .totalRedirects,
    ).toBe(1);
    const second = (
      await (
        await call("/configs", "POST", {
          source: prefix + "-second.example",
          target: "https://example.com",
        })
      ).json()
    ).config;
    ids.push(second.uuid);
    expect(
      (await call("/configs/" + second.uuid, "PATCH", { source: first.source }))
        .status,
    ).toBe(409);
    expect((await call("/configs/" + first.uuid, "DELETE")).status).toBe(204);
    expect((await call("/configs/" + first.uuid)).status).toBe(404);
    expect(await mongo.getRedirectStats(first.uuid)).toBeNull();
    expect((await call("/configs/" + first.uuid, "DELETE")).status).toBe(404);
  });
  test("malformed, credential-bearing, unsupported and self-loop destinations are rejected", async () => {
    for (const target of [
      "not-a-url",
      "javascript:alert(1)",
      "https://user:secret@example.com",
      "https://" + prefix + ".example/path",
      "https://example.com/\nheader",
    ]) {
      expect(
        (
          await call("/configs", "POST", {
            source: prefix + ".example",
            target,
          })
        ).status,
      ).toBe(400);
    }
    expect(
      (await call("/configs/" + crypto.randomUUID(), "PATCH", {})).status,
    ).toBe(400);
    expect((await call("/configs/not-a-uuid", "DELETE")).status).toBe(400);
  });
});
