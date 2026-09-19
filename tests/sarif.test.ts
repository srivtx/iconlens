import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditSvg } from "../src/audit.ts";
import { makeBadSvg } from "../src/fixtures.ts";
import { toSarif, writeSarif } from "../src/sarif.ts";

describe("toSarif", () => {
  test("emits SARIF 2.1.0 with tool metadata and rules", () => {
    const result = auditSvg(makeBadSvg(), "bad.svg");
    const sarif = toSarif(result, "iconlens", "0.1.0");

    expect(sarif.version).toBe("2.1.0");
    expect(sarif.$schema).toBe("https://json.schemastore.org/sarif-2.1.0.json");

    const run = sarif.runs[0]!;
    expect(run.tool.driver.name).toBe("iconlens");
    expect(run.tool.driver.version).toBe("0.1.0");
    expect(run.tool.driver.informationUri).toBe("https://github.com/srivtx/iconlens");
    expect(run.tool.driver.rules.map((rule) => rule.id)).toContain("SVG-NAME-001");
  });

  test("maps SVG-NAME-001 to ruleId and level error", () => {
    const result = auditSvg(makeBadSvg(), "bad.svg");
    const sarif = toSarif(result, "iconlens", "0.1.0");

    const found = sarif.runs[0]!.results.find((r) => r.ruleId === "SVG-NAME-001");
    expect(found).toBeDefined();
    expect(found!.level).toBe("error");
    expect(found!.message.text.length).toBeGreaterThan(0);
    expect(found!.locations[0]!.physicalLocation.artifactLocation.uri).toBe("bad.svg");
    expect(found!.locations[0]!.physicalLocation.region.startLine).toBe(1);
  });

  test("accepts an array of results and dedupes rules", () => {
    const a = auditSvg(makeBadSvg(), "a.svg");
    const b = auditSvg(makeBadSvg(), "b.svg");
    const sarif = toSarif([a, b], "iconlens", "0.1.0");
    const ids = sarif.runs[0]!.tool.driver.rules.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(sarif.runs[0]!.results.length).toBe(a.issues.length + b.issues.length);
  });
});

describe("writeSarif", () => {
  test("writes a parseable SARIF file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "iconlens-sarif-"));
    const path = join(dir, "report.sarif");
    try {
      const result = auditSvg(makeBadSvg(), "bad.svg");
      await writeSarif(path, result, "iconlens", "0.1.0");

      const parsed = JSON.parse(readFileSync(path, "utf8")) as ReturnType<typeof toSarif>;
      expect(parsed.version).toBe("2.1.0");
      expect(parsed.runs[0]!.tool.driver.name).toBe("iconlens");
      expect(parsed.runs[0]!.results.some((r) => r.ruleId === "SVG-NAME-001")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
