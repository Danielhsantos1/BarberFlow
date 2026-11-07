// Builds the app and assembles it in Vercel's Build Output API format
// (https://vercel.com/docs/build-output-api/v3):
//   - static web app  -> .vercel/output/static
//   - Express API     -> .vercel/output/functions/api.func (one Node function)
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, ".vercel/output");

const run = (cmd) => execSync(cmd, { cwd: root, stdio: "inherit" });

run("pnpm run build");

rmSync(out, { recursive: true, force: true });

// Static files
cpSync(path.join(root, "artifacts/barberflow/dist/public"), path.join(out, "static"), {
  recursive: true,
});

// API function
const fn = path.join(out, "functions/api.func");
mkdirSync(fn, { recursive: true });
cpSync(path.join(root, "artifacts/api-server/dist"), fn, { recursive: true });
writeFileSync(path.join(fn, "package.json"), JSON.stringify({ type: "module" }));
writeFileSync(
  path.join(fn, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs24.x",
      handler: "handler.mjs",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      supportsResponseStreaming: true,
      maxDuration: 30,
      // São Paulo, next to the Neon database (aws-sa-east-1).
      regions: ["gru1"],
    },
    null,
    2,
  ),
);

// Routing: /api/* -> function, existing files -> static, everything else -> SPA.
writeFileSync(
  path.join(out, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: "^/assets/(.*)$", headers: { "cache-control": "public, max-age=31536000, immutable" }, continue: true },
        { src: "^/api(/.*)?$", dest: "/api" },
        { handle: "filesystem" },
        { src: "/.*", dest: "/index.html" },
      ],
    },
    null,
    2,
  ),
);

console.log("Vercel output ready at .vercel/output");
