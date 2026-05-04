#!/usr/bin/env node

const { spawnSync } = require("child_process");

const steps = [
  ["Build shared wire package", ["--filter", "@slopus/happy-wire", "build"]],
  ["Build server", ["--filter", "happy-server", "build"]],
  ["Build CLI", ["--filter", "happy", "build"]],
  ["Build agent", ["--filter", "happy-agent", "build"]],
  ["Typecheck mobile app", ["--filter", "happy-app", "typecheck"]],
  ["Typecheck desktop app", ["--filter", "codium", "typecheck"]],
];

function runStep(label, args) {
  console.log(`\n==> ${label}`);
  const result = spawnSync("pnpm", args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

for (const [label, args] of steps) {
  runStep(label, args);
}

console.log("\nAll build checks completed successfully.");
