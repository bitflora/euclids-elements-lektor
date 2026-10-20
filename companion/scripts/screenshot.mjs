#!/usr/bin/env node
// Screenshot pages of the running dev server (npm run dev) for visual review.
//   node scripts/screenshot.mjs "#/I.1/6" "#/I/definitions" …
//   BASE=http://localhost:5199 WIDTH=390 node scripts/screenshot.mjs "#/I.5"
// Also reports console errors, which makes it a cheap smoke test.
import { chromium } from "playwright";
import fs from "node:fs";

const base = process.env.BASE ?? "http://localhost:5199/";
const width = Number(process.env.WIDTH ?? 1400);
const height = Number(process.env.HEIGHT ?? 900);
const dark = process.env.DARK === "1";
const routes = process.argv.slice(2);
fs.mkdirSync("screenshots", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, colorScheme: dark ? "dark" : "light", deviceScaleFactor: 1 });
const problems = [];
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && problems.push(`${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));

for (const r of routes.length ? routes : ["#/"]) {
  const [hash, action] = r.split("!");
  await page.goto(base + hash, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  if (action) {
    // "click:<selector>" or "hover:<selector>" or "type:<text>"
    for (const a of action.split("&")) {
      const [verb, ...rest] = a.split(":");
      const arg = rest.join(":");
      if (verb === "click") await page.click(arg);
      if (verb === "hover") await page.hover(arg);
      if (verb === "type") await page.keyboard.type(arg);
      if (verb === "key") await page.keyboard.press(arg);
      if (verb === "eval") await page.evaluate(arg);
      if (verb === "reload") await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(300);
    }
  }
  const name = (hash + (action ? "-" + action : "")).replace(/[^a-zA-Z0-9.]+/g, "_").replace(/^_+|_+$/g, "") || "home";
  const file = `screenshots/${name}-${width}${dark ? "-dark" : ""}.png`;
  if (process.env.NOSHOT === "1") continue;
  await page.screenshot({ path: file, fullPage: process.env.FULL === "1" });
  console.log(file);
}
if (problems.length) console.log("CONSOLE:\n" + [...new Set(problems)].join("\n"));
await browser.close();
