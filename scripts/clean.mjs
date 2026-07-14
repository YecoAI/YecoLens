// Removes build artifacts so `npm install && npm run build` is reproducible.
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";

const targets = [
  "packages/protocol/dist",
  "server/dist",
  "apps/dashboard/dist",
  "cli/dist",
  "coverage",
];

for (const t of targets) {
  if (existsSync(t)) {
    await rm(t, { recursive: true, force: true });
    console.log(`removed ${t}`);
  }
}
console.log("clean done");
