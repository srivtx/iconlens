/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, run } from "../src/cli.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLI = join(ROOT, "src", "cli.ts");

const CLEAN =
  '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A dot"><title>A dot</title><desc>A dot</desc></svg>';
const BROKEN =
  '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="missing"><rect width="1" height="1"/></svg>';
const GARBAGE = "definitely not xml";

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "iconlens-cli-"));
}

async function withTempFile(
  name: string,
  contents: string,
  fn: (path: string) => Promise<void> | void,
) {
  const dir = tempDir();
  const path = join(dir, name);
  writeFileSync(path, contents);
  try {
    await fn(path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function silence<T>(fn: () => Promise<T>): Promise<T> {
  const log = console.log;
  const error = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.log = log;
    console.error = error;
  }
}

describe("parseArgs", () => {
  test("supports inline --sarif=, --fail-on= and --dir=", () => {
    const opts = parseArgs(["--sarif=out.sarif", "--fail-on=warning", "--dir=icons"]);
    expect(opts.sarif).toBe("out.sarif");
    expect(opts.failOn).toBe("warning");
    expect(opts.dir).toBe("icons");
  });

  test("rejects a --sarif value that is another flag", () => {
    expect(() => parseArgs(["--sarif", "--json", "x.svg"])).toThrow(/--sarif/);
  });

  test("rejects a --dir value that is another flag", () => {
    expect(() => parseArgs(["--dir", "--json"])).toThrow(/--dir/);
  });

  test("rejects a missing --sarif path", () => {
    expect(() => parseArgs(["--sarif"])).toThrow(/--sarif/);
  });

  test("rejects a missing --fail-on level", () => {
    expect(() => parseArgs(["--fail-on"])).toThrow(/--fail-on/);
  });

  test("rejects an invalid --fail-on level", () => {
    expect(() => parseArgs(["--fail-on", "loud"])).toThrow(/fail-on/);
  });

  test("accepts -v and -q aliases", () => {
    const opts = parseArgs(["-v", "-q"]);
    expect(opts.version).toBe(true);
    expect(opts.quiet).toBe(true);
  });
});

describe("run exit codes", () => {
  test("no arguments is a usage error", async () => {
    expect(await silence(() => run([]))).toBe(2);
  });

  test("a clean svg exits 0", async () => {
    await withTempFile("clean.svg", CLEAN, async (path) => {
      expect(await silence(() => run([path]))).toBe(0);
    });
  });

  test("findings at the threshold exit 1", async () => {
    await withTempFile("broken.svg", BROKEN, async (path) => {
      expect(await silence(() => run([path]))).toBe(1);
    });
  });

  test("--fail-on none suppresses the findings exit", async () => {
    await withTempFile("broken.svg", BROKEN, async (path) => {
      expect(await silence(() => run(["--fail-on", "none", path]))).toBe(0);
    });
  });

  test("--fail-on warning trips on warning-only input", async () => {
    await withTempFile("warn.svg", "<svg xmlns='http://www.w3.org/2000/svg'><rect/></svg>", async (path) => {
      expect(await silence(() => run([path]))).toBe(0);
      expect(await silence(() => run(["--fail-on", "warning", path]))).toBe(1);
    });
  });

  test("a missing file exits 2", async () => {
    const missing = join(tmpdir(), `iconlens-missing-${Date.now()}.svg`);
    expect(await silence(() => run([missing]))).toBe(2);
  });

  test("malformed XML exits 2 instead of reporting clean", async () => {
    await withTempFile("garbage.svg", GARBAGE, async (path) => {
      expect(await silence(() => run([path]))).toBe(2);
    });
  });

  test("non-SVG XML exits 2", async () => {
    await withTempFile("page.svg", "<html><body>hi</body></html>", async (path) => {
      expect(await silence(() => run([path]))).toBe(2);
    });
  });

  test("--dir on a missing directory exits 2", async () => {
    const missing = join(tmpdir(), `iconlens-no-dir-${Date.now()}`);
    expect(await silence(() => run(["--dir", missing]))).toBe(2);
  });

  test("--dir on a file exits 2", async () => {
    await withTempFile("clean.svg", CLEAN, async (path) => {
      expect(await silence(() => run(["--dir", path]))).toBe(2);
    });
  });

  test("--dir with no svg files exits 2", async () => {
    const dir = tempDir();
    try {
      writeFileSync(join(dir, "readme.txt"), "nope");
      expect(await silence(() => run(["--dir", dir]))).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("an unwritable --sarif report exits 2", async () => {
    const dir = tempDir();
    try {
      const clean = join(dir, "clean.svg");
      writeFileSync(clean, CLEAN);
      const blocker = join(dir, "not-a-directory");
      writeFileSync(blocker, "file");
      expect(await silence(() => run([clean, "--sarif", join(blocker, "report.sarif")]))).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("--version, -v and --help exit 0", async () => {
    expect(await silence(() => run(["--version"]))).toBe(0);
    expect(await silence(() => run(["-v"]))).toBe(0);
    expect(await silence(() => run(["--help"]))).toBe(0);
  });
});

describe("cli process", () => {
  test("--json over multiple files emits one valid JSON array", () => {
    const dir = tempDir();
    try {
      const a = join(dir, "a.svg");
      const b = join(dir, "b.svg");
      writeFileSync(a, CLEAN);
      writeFileSync(b, BROKEN);
      const proc = spawnSync("bun", ["run", CLI, "--json", a, b], { cwd: ROOT, encoding: "utf8" });
      expect(proc.status).toBe(1);
      const parsed = JSON.parse(proc.stdout) as unknown[];
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("--sarif followed by another flag is rejected", () => {
    const dir = tempDir();
    try {
      const clean = join(dir, "clean.svg");
      writeFileSync(clean, CLEAN);
      const proc = spawnSync("bun", ["run", CLI, "--sarif", "--json", clean], {
        cwd: ROOT,
        encoding: "utf8",
      });
      expect(proc.status).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("stdin '-' is linted", () => {
    const clean = spawnSync("bun", ["run", CLI, "-"], {
      cwd: ROOT,
      input: CLEAN,
      encoding: "utf8",
    });
    expect(clean.status).toBe(0);

    const garbage = spawnSync("bun", ["run", CLI, "-"], {
      cwd: ROOT,
      input: GARBAGE,
      encoding: "utf8",
    });
    expect(garbage.status).toBe(2);
    expect(garbage.stdout).toContain("<stdin>");
  });
});
