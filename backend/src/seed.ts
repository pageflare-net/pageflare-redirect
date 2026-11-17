import { connectToMongo, createUser, findUserByUsername } from "./mongo";
const url = new URL(process.env.MONGO_URI ?? "");
if (
  process.env.PAGEFLARE_DEMO !== "true" ||
  !url.pathname.endsWith("_demo") ||
  !["localhost", "127.0.0.1", "mongo"].includes(url.hostname)
)
  throw new Error("Seed requires an isolated demo database");
async function main() {
  await connectToMongo();
  if (!(await findUserByUsername("demo")))
    await createUser("demo", "Pageflare-demo-2026!");
  console.log("Demo redirect account seeded");
  process.exit(0);
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
