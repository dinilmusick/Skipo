#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..");
const target = process.argv[2];

const sourceDirs = [
  "scripts",
  "checklists",
  "scaffolds",
  "generators",
  "mutators",
  "architecture",
  "ui",
  "backend",
  "features",
  "api",
];

function copyDirectory(name, engine) {
  const source = join(repo, name);
  if (existsSync(source)) cpSync(source, join(engine, name), { recursive: true });
}

if (target === "clean-skipo") {
  rmSync(join(repo, "packages", "skipo", "dist"), { recursive: true, force: true });
  process.exit(0);
}

if (target !== "skipo") {
  console.error("Usage: prepare-npm-package.mjs skipo|clean-skipo");
  process.exit(2);
}

const rootPackage = JSON.parse(readFileSync(join(repo, "package.json"), "utf8"));
const dist = join(repo, "packages", "skipo", "dist");
const engine = join(dist, "engine");

rmSync(dist, { recursive: true, force: true });
mkdirSync(engine, { recursive: true });

for (const dir of sourceDirs) copyDirectory(dir, engine);
/* Source scaffolds use .gitignore patterns (including *.cjs) that must
 * never suppress executable/test assets from the published npm archive.
 * The generated-app copy operation deliberately omits this pack-only file. */
const viteBundle = join(engine, "scaffolds", "vite");
if (existsSync(viteBundle)) {
  writeFileSync(
    join(viteBundle, ".npmignore"),
    "# Bundle the complete generated scaffold despite source .gitignore patterns.\n",
  );
  // npm always filters source .gitignore from packed archives. Preserve its
  // exact bytes under a package-safe template name, then restore it on create.
  const gitignore = join(repo, "scaffolds", "vite", ".gitignore");
  if (!existsSync(gitignore)) throw new Error("Canonical Vite .gitignore is missing");
  writeFileSync(join(viteBundle, "skipo-gitignore.template"), readFileSync(gitignore));
}

for (const file of ["assistant.py"]) {
  const source = join(repo, file);
  if (existsSync(source)) cpSync(source, join(engine, file));
}

writeFileSync(
  join(engine, "package.json"),
  JSON.stringify(
    {
      name: "skipo-engine-runtime",
      version: rootPackage.version,
      private: true,
      type: "module",
      description: "Bundled Skipo framework engine.",
    },
    null,
    2,
  ) + "\n",
);

console.log(`Prepared self-contained Skipo npm engine v${rootPackage.version}.`);
