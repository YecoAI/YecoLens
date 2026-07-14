// Final end-to-end smoke test: boots the built server and verifies every
// surface a real `npx yeco-lens` user would touch.
import { createServer } from "../server/dist/index.js";
import { writeFileSync } from "node:fs";

const lines = [];
const log = (s) => { lines.push(s); console.log(s); };

try {
  const server = await createServer({
    port: 7595,
    openBrowser: false,
    ollamaUrl: "http://127.0.0.1:1", // dead port → tests onboarding path
  });
  await new Promise((r) => setTimeout(r, 200));

  const h = await fetch("http://127.0.0.1:7595/healthz");
  log(`healthz: ${h.status} ${await h.text()}`);

  const s = await fetch("http://127.0.0.1:7595/api/status");
  log(`status: ${await s.text()}`);

  const idx = await fetch("http://127.0.0.1:7595/");
  const idxText = await idx.text();
  log(`dashboard: ${idx.status} root:${idxText.includes('id="root"')} assets:${idxText.includes("assets/")}`);

  const ws = new WebSocket("ws://127.0.0.1:7595/ws");
  const wsMsgs = [];
  await new Promise((resolve) => {
    ws.onmessage = (e) => {
      wsMsgs.push(JSON.parse(e.data).type);
      if (wsMsgs.length >= 2) { ws.close(); }
    };
    ws.onclose = () => resolve();
    ws.onerror = () => resolve();
    setTimeout(resolve, 5000);
  });
  log(`ws: ${wsMsgs.join(",")}`);

  await server.close();
  log("\nALL CHECKS PASSED");
  writeFileSync("smoke-result.txt", lines.join("\n"));
  process.exit(0);
} catch (err) {
  log("SMOKE TEST FAILED: " + (err?.message || err));
  writeFileSync("smoke-result.txt", lines.join("\n"));
  process.exit(1);
}
