import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function makeGoodSvg(): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="t">',
    '<title id="t">A red circle</title>',
    '<desc>A red circle on white</desc>',
    '<circle cx="5" cy="5" r="5" fill="red"/>',
    "</svg>",
  ].join("");
}

export function makeBadSvg(): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="missing">',
    '<rect x="0" y="0" width="10" height="10" fill="blue"/>',
    "<title>Untitled</title>",
    '<g tabindex="0">',
    '<use href="#nope"/>',
    "</g>",
    '<circle id="a" cx="1" cy="1" r="1" fill="red"/>',
    '<path id="a" d="M0 0 L1 1"/>',
    "</svg>",
  ].join("");
}

export function writeFixturesTo(dir: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "good.svg"), makeGoodSvg());
  writeFileSync(join(dir, "bad.svg"), makeBadSvg());
}

if (import.meta.main) {
  writeFixturesTo("fixtures");
  console.log("Wrote fixtures/good.svg and fixtures/bad.svg");
}
