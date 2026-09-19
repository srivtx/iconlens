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

describe("rule edge cases", () => {
  test('aria-hidden="false" does not suppress SVG-DECOR-003', () => {
    const result = auditSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="false"><rect width="1" height="1"/></svg>',
      "x.svg",
    );
    expect(result.issues.map((issue) => issue.code)).toContain("SVG-DECOR-003");
  });

  test('aria-hidden="true" marks the graphic decorative', () => {
    const result = auditSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="1" height="1"/></svg>',
      "x.svg",
    );
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).not.toContain("SVG-DECOR-003");
    expect(codes).not.toContain("SVG-NAME-001");
  });

  test("dangling aria-describedby references are errors", () => {
    const result = auditSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="x" aria-describedby="gone"></svg>',
      "x.svg",
    );
    const issue = result.issues.find((candidate) => candidate.code === "SVG-REF-009");
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("error");
  });

  test('tabindex="-1" is not a focus-order violation', () => {
    const result = auditSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="x"><g tabindex="-1"><rect width="1" height="1"/></g></svg>',
      "x.svg",
    );
    expect(result.issues.map((issue) => issue.code)).not.toContain("SVG-FOCUS-008");
  });

  test('tabindex="0" on a non-interactive element is flagged', () => {
    const result = auditSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="x"><g tabindex="0"><rect width="1" height="1"/></g></svg>',
      "x.svg",
    );
    expect(result.issues.map((issue) => issue.code)).toContain("SVG-FOCUS-008");
  });

  test("issues carry the plain file path alongside the annotated location", () => {
    const result = auditSvg(BAD_SVG, "bad.svg");
    for (const issue of result.issues) {
      expect(issue.file).toBe("bad.svg");
    }
  });
});

