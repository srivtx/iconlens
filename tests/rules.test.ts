/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { parseSvg, accessibleName } from "../src/svg.ts";
import { auditSvg } from "../src/audit.ts";

const GOOD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="svg-title">
  <title id="svg-title">A blue circle</title>
  <desc>A blue circle centered on a white background.</desc>
  <circle id="circle" cx="10" cy="10" r="5" fill="blue"/>
</svg>`;

const BAD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="missing">
  <g id="a" tabindex="0">
    <rect id="a" width="10" height="10"/>
  </g>
  <title>Late title</title>
  <use href="#nope"/>
</svg>`;

const PRIORITY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="alt">
  <title id="svg-title">From title element</title>
  <text id="alt">From aria-labelledby</text>
</svg>`;

describe("auditSvg", () => {
  test("a well-formed accessible svg has no errors", () => {
    const result = auditSvg(GOOD_SVG, "good.svg");
    expect(result.counts.error).toBe(0);
    expect(result.issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  test("a malformed svg reports the expected defects", () => {
    const result = auditSvg(BAD_SVG, "bad.svg");
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toContain("SVG-NAME-001");
    expect(codes).toContain("SVG-NAME-002");
    expect(codes).toContain("SVG-ID-006");
    expect(codes).toContain("SVG-USE-007");
    expect(codes).toContain("SVG-FOCUS-008");
  });

  test("issues are sorted by code", () => {
    const result = auditSvg(BAD_SVG, "bad.svg");
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toEqual([...codes].sort());
  });

  test("every issue location references the file name", () => {
    const result = auditSvg(BAD_SVG, "bad.svg");
    for (const issue of result.issues) {
      expect(issue.location).toContain("bad.svg");
    }
  });
});

describe("accessibleName priority", () => {
  test("aria-labelledby wins over a first-child title", () => {
    const parsed = parseSvg(PRIORITY_SVG);
    const name = accessibleName(parsed);
    expect(name.source).toBe("aria-labelledby");
    expect(name.name).toBe("From aria-labelledby");
  });

  test("falls back to title when there is no labelling attribute", () => {
    const parsed = parseSvg(`<svg xmlns="http://www.w3.org/2000/svg"><title>Title only</title></svg>`);
    const name = accessibleName(parsed);
    expect(name.source).toBe("title");
    expect(name.name).toBe("Title only");
  });
});
