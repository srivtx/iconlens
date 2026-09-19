import { describe, expect, test } from "bun:test";
import { auditSvg } from "../src/audit.ts";
import { makeBadSvg, makeGoodSvg } from "../src/fixtures.ts";
import { formatText } from "../src/report.ts";

describe("svg-a11y fixtures", () => {
  test("good fixture has no errors", () => {
    const result = auditSvg(makeGoodSvg(), "good.svg");
    expect(result.counts.error).toBe(0);
  });

  test("bad fixture has errors", () => {
    const result = auditSvg(makeBadSvg(), "bad.svg");
    expect(result.counts.error).toBeGreaterThan(0);
  });

  test("bad fixture text report names SVG-NAME-001", () => {
    const output = formatText(auditSvg(makeBadSvg(), "bad.svg"));
    expect(output).toContain("SVG-NAME-001");
  });

  test("good fixture text report is produced", () => {
    const output = formatText(auditSvg(makeGoodSvg(), "good.svg"));
    expect(typeof output).toBe("string");
  });
});
