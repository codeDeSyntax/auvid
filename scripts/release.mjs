#!/usr/bin/env node
/**
 * Usage:
 *   node scripts/release.mjs "commit message"
 *   node scripts/release.mjs [patch|minor|major] "commit message"
 * Defaults: patch bump, message = "release"
 *
 * What it does:
 *   1. Bumps version in package.json
 *   2. git add -A
 *   3. git commit -m "chore: release v<version> — <message>"
 *   4. git tag v<version>
 *   5. git push && git push origin v<version>
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dirname, "../package.json");

const BUMPS = ["patch", "minor", "major"];
const arg1 = process.argv[2];
const arg2 = process.argv[3];

const bump = BUMPS.includes(arg1 ?? "") ? arg1 : "patch";
const message = BUMPS.includes(arg1 ?? "")
  ? (arg2 ?? "release")
  : (arg1 ?? "release");

if (!BUMPS.includes(bump)) {
  console.error(`Unknown bump type "${bump}". Use patch, minor, or major.`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const parts = pkg.version.split(".").map(Number);

if (bump === "major") {
  parts[0]++;
  parts[1] = 0;
  parts[2] = 0;
} else if (bump === "minor") {
  parts[1]++;
  parts[2] = 0;
} else {
  parts[2]++;
}

const version = parts.join(".");
pkg.version = version;

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
console.log(`Bumped version to ${version}`);

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

run("git add -A");
run(`git commit -m "chore: release v${version} — ${message}"`);
run(`git tag v${version}`);
run("git push");
run(`git push origin v${version}`);

console.log(`\nReleased v${version}. GitHub Actions will build & publish.`);
