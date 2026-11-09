import {describe, expect, it} from "vitest";
import {readFileSync} from "node:fs";

describe("Skipo generated runtime declarations", () => {
  it("marks generated Wrangler scaffolds as Worker targets while keeping the Node compatibility dependency explicit", () => {
    for (const path of [
      "scaffolds/nextjs/wrangler.toml",
      "scaffolds/vite/wrangler.toml",
    ]) {
      const config = readFileSync(path, "utf8");
      expect(config).toContain('main = "api/index.js"');
      expect(config).toContain('"nodejs_compat"');
    }
  });
});
