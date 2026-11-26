// Generates narration audio with macOS `say`, converts to WAV, writes durations.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const voice = process.argv[2] || "Samantha";
const lines = JSON.parse(readFileSync("src/narration.json", "utf8"));
mkdirSync("public/audio", { recursive: true });
const durations = {};
for (const { id, text } of lines) {
  const aiff = `public/audio/${id}.aiff`, wav = `public/audio/${id}.wav`;
  execFileSync("say", ["-v", voice, "-r", "172", "-o", aiff, text]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", aiff, "-ar", "48000", "-ac", "2", wav]);
  const d = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav]).toString();
  durations[id] = Number(d);
  console.log(id.padEnd(10), durations[id].toFixed(2) + "s");
}
writeFileSync("src/durations.json", JSON.stringify(durations, null, 2));
console.log("total", Object.values(durations).reduce((a, b) => a + b, 0).toFixed(1) + "s");
