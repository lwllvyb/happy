#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const defaultManifest = path.join(repoRoot, "packages", "happy-server", "deploy", "handy.yaml");

function parseArgs(argv) {
  if (argv[0] === "--") {
    argv = argv.slice(1);
  }

  const options = {
    dockerfile: "Dockerfile.server",
    manifest: defaultManifest,
    context: repoRoot,
    push: true,
    apply: true,
    rollout: true,
    namespace: undefined,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) {
        throw new Error(`Missing value for ${arg}`);
      }
      return argv[i];
    };

    switch (arg) {
      case "--image":
        options.image = next();
        break;
      case "--tag":
        options.tag = next();
        break;
      case "--dockerfile":
        options.dockerfile = next();
        break;
      case "--manifest":
        options.manifest = path.resolve(repoRoot, next());
        break;
      case "--namespace":
      case "-n":
        options.namespace = next();
        break;
      case "--no-push":
        options.push = false;
        break;
      case "--no-apply":
        options.apply = false;
        break;
      case "--no-rollout":
        options.rollout = false;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.image) {
    options.image = process.env.SERVER_IMAGE;
  }
  if (!options.tag) {
    options.tag = process.env.SERVER_TAG || shortGitSha();
  }
  if (!options.image) {
    throw new Error("Missing --image or SERVER_IMAGE, for example: ghcr.io/me/happy-server");
  }

  return options;
}

function shortGitSha() {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return "local";
  }
  return result.stdout.trim() || "local";
}

function printHelp() {
  console.log(`Deploy happy-server.

Usage:
  pnpm deploy:server -- --image ghcr.io/you/happy-server
  pnpm deploy:server -- --image registry.example.com/happy-server --tag v1

Options:
  --image <name>       Required image repository, unless SERVER_IMAGE is set
  --tag <tag>          Image tag. Defaults to SERVER_TAG or current git sha
  --dockerfile <file>  Dockerfile to build. Defaults to Dockerfile.server
  --manifest <file>    Kubernetes manifest template. Defaults to server handy.yaml
  --namespace, -n      Kubernetes namespace for apply and rollout
  --no-push            Build locally but skip docker push
  --no-apply           Build/push but skip kubectl apply
  --no-rollout         Skip kubectl rollout status
  --dry-run            Print commands and render the manifest without running them
`);
}

function run(command, args, opts = {}) {
  console.log(`\n==> ${command} ${args.join(" ")}`);
  if (opts.dryRun) {
    return;
  }

  const result = spawnSync(command, args, {
    cwd: opts.cwd || repoRoot,
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

function renderManifest(manifestPath, imageRef) {
  const source = fs.readFileSync(manifestPath, "utf8");
  const rendered = source.replace(/docker\.korshakov\.com\/handy-server:\{version\}/g, imageRef);
  const outPath = path.join(os.tmpdir(), `happy-server-${Date.now()}.yaml`);
  fs.writeFileSync(outPath, rendered);
  return outPath;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const imageRef = `${options.image}:${options.tag}`;
  const dockerfilePath = path.resolve(repoRoot, options.dockerfile);

  if (!fs.existsSync(dockerfilePath)) {
    throw new Error(`Dockerfile not found: ${dockerfilePath}`);
  }
  if (!fs.existsSync(options.manifest)) {
    throw new Error(`Manifest not found: ${options.manifest}`);
  }

  run("docker", ["build", "-f", dockerfilePath, "-t", imageRef, options.context], { dryRun: options.dryRun });

  if (options.push) {
    run("docker", ["push", imageRef], { dryRun: options.dryRun });
  }

  if (!options.apply) {
    console.log(`\nBuilt${options.push ? " and pushed" : ""}: ${imageRef}`);
    return;
  }

  const renderedManifest = renderManifest(options.manifest, imageRef);
  if (options.dryRun) {
    console.log(`\nRendered manifest: ${renderedManifest}`);
  }
  const namespaceArgs = options.namespace ? ["--namespace", options.namespace] : [];
  run("kubectl", ["apply", ...namespaceArgs, "-f", renderedManifest], { dryRun: options.dryRun });

  if (options.rollout) {
    run("kubectl", ["rollout", "status", ...namespaceArgs, "deployment/handy-server"], { dryRun: options.dryRun });
  }

  console.log(`\nDeployed ${imageRef}`);
}

main();
