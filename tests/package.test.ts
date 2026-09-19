/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
) as Record<string, any>;

describe("package.json publish metadata", () => {
  test("does not declare peerDependencies", () => {
    expect(pkg.peerDependencies).toBeUndefined();
  });

  test("does not declare publishConfig (the tool is not published to npm)", () => {
    expect(pkg.publishConfig).toBeUndefined();
  });

  test("typescript lives in devDependencies", () => {
    expect(pkg.devDependencies?.typescript).toBeDefined();
  });

  test("exposes a types entry and a files allowlist", () => {
    expect(typeof pkg.types).toBe("string");
    expect(pkg.types).toBe("src/index.ts");
    expect(pkg.files).toContain("src");
  });

  test("main and module point at the source entry", () => {
    expect(pkg.main).toBe("src/index.ts");
    expect(pkg.module).toBe("src/index.ts");
  });
});
