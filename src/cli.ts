#!/usr/bin/env bun
import { readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { auditSvg } from "./audit.ts";
import { formatJson, formatText } from "./report.ts";

interface Options {
  json: boolean;
  quiet: boolean;
  dir: string | null;
  help: boolean;
  files: string[];
}

const USAGE = `svg-a11y - offline accessibility linter for standalone SVG files

Usage:
  svg-a11y <file...> [--json] [--quiet]
  svg-a11y --dir <path> [--json] [--quiet]

Options:
  --dir <path>   Lint every .svg file in <path> (non-recursive, sorted)
  --json         Print machine-readable JSON instead of text
  --quiet        Print a single summary line per file
  -h, --help     Show this help

Exit codes:
  0  no errors
  1  at least one file reported an error
  2  invalid usage / no input
`;

export function parseArgs(argv: string[]): Options {
  const opts: Options = { json: false, quiet: false, dir: null, help: false, files: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--quiet") {
      opts.quiet = true;
    } else if (arg === "--dir") {
      const next = argv[++i];
      if (next === undefined) {
        throw new Error("--dir requires a path argument");
      }
      opts.dir = next;
    } else if (arg === "-h" || arg === "--help") {
      opts.help = true;
    } else if (arg !== undefined && arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (arg !== undefined) {
      opts.files.push(arg);
    }
  }
  return opts;
}

function collectFiles(opts: Options): string[] {
  const files = [...opts.files];
  if (opts.dir !== null) {
    const entries = readdirSync(opts.dir)
      .filter((name) => name.toLowerCase().endsWith(".svg"))
      .sort();
    for (const name of entries) {
      files.push(join(opts.dir, name));
    }
  }
  return files;
}

export async function run(argv: string[]): Promise<number> {
  let opts: Options;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    console.error(USAGE);
    return 2;
  }

  if (opts.help) {
    console.log(USAGE);
    return 0;
  }

  const files = collectFiles(opts);
  if (files.length === 0) {
    console.error(USAGE);
    return 2;
  }

  let hadError = false;
  for (const file of files) {
    let text: string;
    try {
      text = await Bun.file(file).text();
    } catch (err) {
      console.error(`${file}: ${err instanceof Error ? err.message : String(err)}`);
      hadError = true;
      continue;
    }
    const result = auditSvg(text, basename(file));
    if (result.counts.error > 0) {
      hadError = true;
    }
    if (opts.quiet) {
      console.log(
        `${basename(file)}: ${result.counts.error} error(s), ${result.counts.warning} warning(s), ${result.counts.info} info`,
      );
    } else if (opts.json) {
      console.log(formatJson(result));
    } else {
      console.log(formatText(result));
    }
  }

  return hadError ? 1 : 0;
}

if (import.meta.main) {
  const code = await run(process.argv.slice(2));
  process.exit(code);
}
