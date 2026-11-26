// Renders one preview still per scene (at `at` fraction of each scene) into out/stills/.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const at = Number(process.argv[2] || 0.75);
const only = process.argv[3]?.split(",");
const narration = JSON.parse(readFileSync("src/narration.json", "utf8"));
const durations = JSON.parse(readFileSync("src/durations.json", "utf8"));
const frames = (id) => Math.ceil(durations[id] * 30) + 8 + 24;

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: "Explainer", chromiumOptions: { gl: "angle" } });
mkdirSync("out/stills", { recursive: true });
let start = 0;
for (const { id } of narration) {
  const n = frames(id);
  if (!only || only.includes(id)) {
    const frame = start + Math.floor(n * at);
    await renderStill({ serveUrl, composition, frame, output: `out/stills/${id}.png`, chromiumOptions: { gl: "angle" }, scale: 0.5 });
    console.log(id, frame);
  }
  start += n;
}
