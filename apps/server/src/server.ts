import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildServer } from "./api";
import { App, type Config } from "./app";
import { syncKnowledge } from "./services/coach";
import { seedDemo } from "./services/onboarding";
import { Scheduler } from "./services/scheduler";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export async function start(): Promise<void> {
  const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
  const demo = process.argv.includes("--demo");
  const config: Config = {
    repoRoot,
    demo,
    dataDir: resolve(arg("data") ?? join(repoRoot, "data")),
    port: Number(arg("port") ?? process.env.EVERYDAY_PORT ?? 8787),
    host: arg("host") ?? "127.0.0.1",
    timeZone: process.env.EVERYDAY_TZ ?? "Europe/Warsaw",
    webDist: join(repoRoot, "apps", "web", "dist"),
  };
  const app = new App(config);
  const fakeToday = arg("today");
  if (demo && fakeToday) {
    // Demo only: pretend today is another date (time of day stays real).
    const offset = Date.parse(fakeToday + "T00:00:00Z") - Date.parse(app.today() + "T00:00:00Z");
    app.clock = () => new Date(Date.now() + offset);
  }
  syncKnowledge(app);
  if (demo) await seedDemo(app);
  const server = await buildServer(app);
  await server.listen({ port: config.port, host: config.host });
  const scheduler = new Scheduler(app);
  scheduler.start();
  console.log(`EveryDay ${demo ? "(DEMO) " : ""}działa: http://${config.host}:${config.port}`);
  if (!existsSync(config.webDist)) console.log("Uwaga: brak zbudowanej aplikacji web — uruchom `npm run build`.");
  const stop = async () => {
    scheduler.stop();
    await server.close();
    app.db.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
