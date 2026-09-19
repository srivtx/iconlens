/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { auditSvg } from "../src/audit.ts";
import { accessibleName, parseSvg } from "../src/svg.ts";
import { PARSE_ERROR_CODE } from "../src/types.ts";

describe("parse failure detection", () => {
  test("garbage input is not silently clean", () => {
    const parsed = parseSvg("definitely not xml");
    expect(parsed.error).not.toBeNull();

    const result = auditSvg("definitely not xml", "garbage.txt");
    expect(result.counts.error).toBe(1);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.code).toBe(PARSE_ERROR_CODE);
    expect(result.issues[0]!.file).toBe("garbage.txt");
  });

  test("non-svg XML is rejected", () => {
    const result = auditSvg("<html><body>hi</body></html>", "page.svg");
    expect(result.issues[0]!.code).toBe(PARSE_ERROR_CODE);
    expect(result.issues[0]!.message).toContain("not <svg>");
  });

  test("empty input is rejected", () => {
    const result = auditSvg("", "empty.svg");
    expect(result.issues[0]!.code).toBe(PARSE_ERROR_CODE);
  });

  test("unclosed tags are rejected", () => {
    const result = auditSvg('<svg xmlns="http://www.w3.org/2000/svg"><g></svg>', "broken.svg");
    expect(result.issues[0]!.code).toBe(PARSE_ERROR_CODE);
  });

  test("a valid svg has no parse error", () => {
    const parsed = parseSvg('<svg xmlns="http://www.w3.org/2000/svg"><title>ok</title></svg>');
    expect(parsed.error).toBeNull();
    expect(accessibleName(parsed).name).toBe("ok");
  });

  test("rules still run when parsing succeeds", () => {
    const result = auditSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" role="img"><rect width="1" height="1"/></svg>',
      "no-name.svg",
    );
    expect(result.issues.map((issue) => issue.code)).toContain("SVG-NAME-001");
  });

  test("an unexpected rule-runner throw is never reported as clean", () => {
    const result = auditSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ok"><title>ok</title></svg>',
      "boom.svg",
      () => {
        throw new Error("boom");
      },
    );
    expect(result.counts.error).toBe(1);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.code).toBe(PARSE_ERROR_CODE);
    expect(result.issues[0]!.message).toContain("Internal error");
    expect(result.issues[0]!.file).toBe("boom.svg");
  });
});
