import { XMLParser } from "fast-xml-parser";

export interface ParsedSvg {
  raw: string;
  root: any | undefined;
  idMap: Map<string, any>;
  duplicates: string[];
}

export type NameSource = "aria-labelledby" | "aria-label" | "title" | "none";

const ATTR_PREFIX = "@_";
const TEXT_KEY = "#text";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: ATTR_PREFIX,
  parseTagValue: false,
  trimValues: false,
  preserveOrder: false,
  textNodeName: TEXT_KEY,
});

function isObject(value: any): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findRoot(document: any): any | undefined {
  if (!isObject(document)) return undefined;

  if ("svg" in document && isObject(document["svg"])) {
    return document["svg"];
  }

  const keys = Object.keys(document);
  for (const key of keys) {
    if (key.startsWith("?")) continue;
    const value = document[key];
    if (
      isObject(value) &&
      Object.keys(value).some(
        (attr) => attr === `${ATTR_PREFIX}xmlns` || attr.startsWith(`${ATTR_PREFIX}xmlns:`),
      )
    ) {
      return value;
    }
  }

  for (const key of keys) {
    if (key.startsWith("?")) continue;
    const value = document[key];
    if (isObject(value)) return value;
  }

  return undefined;
}

function collectIds(node: any, idMap: Map<string, any>, duplicates: string[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectIds(item, idMap, duplicates);
    return;
  }
  if (!isObject(node)) return;

  const id = node[`${ATTR_PREFIX}id`];
  if (typeof id === "string" && id.length > 0) {
    if (idMap.has(id)) {
      if (!duplicates.includes(id)) duplicates.push(id);
    } else {
      idMap.set(id, node);
    }
  }

  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith(ATTR_PREFIX) || key === TEXT_KEY) continue;
    collectIds(value, idMap, duplicates);
  }
}

export function parseSvg(source: string): ParsedSvg {
  const raw = source;
  let document: any;
  try {
    document = parser.parse(source);
  } catch {
    return { raw, root: undefined, idMap: new Map(), duplicates: [] };
  }

  const root = findRoot(document);
  const idMap = new Map<string, any>();
  const duplicates: string[] = [];
  try {
    if (root !== undefined) collectIds(root, idMap, duplicates);
  } catch {
    void 0;
  }

  return { raw, root, idMap, duplicates };
}

export function nodeText(node: any): string {
  const parts: string[] = [];

  const visit = (value: any): void => {
    if (value === null || value === undefined) return;
    if (typeof value === "string") {
      parts.push(value);
      return;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      parts.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (isObject(value)) {
      for (const [key, child] of Object.entries(value)) {
        if (key.startsWith(ATTR_PREFIX)) continue;
        visit(child);
      }
    }
  };

  visit(node);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function children(node: any): Array<[string, any]> {
  const result: Array<[string, any]> = [];
  if (!isObject(node)) return result;

  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith(ATTR_PREFIX) || key === TEXT_KEY) continue;
    if (key.startsWith("?")) continue;
    result.push([key, value]);
  }
  return result;
}

export function accessibleName(parsed: ParsedSvg): { name: string; source: NameSource } {
  const root = parsed.root;
  if (!isObject(root)) return { name: "", source: "none" };

  const labelledby = root[`${ATTR_PREFIX}aria-labelledby`];
  if (typeof labelledby === "string" && labelledby.trim().length > 0) {
    const texts = labelledby
      .trim()
      .split(/\s+/)
      .map((id) => {
        const node = parsed.idMap.get(id);
        return node === undefined ? "" : nodeText(node);
      })
      .filter((text) => text.length > 0);
    const name = texts.join(" ").trim();
    if (name.length > 0) return { name, source: "aria-labelledby" };
  }

  const label = root[`${ATTR_PREFIX}aria-label`];
  if (typeof label === "string" && label.trim().length > 0) {
    return { name: label.replace(/\s+/g, " ").trim(), source: "aria-label" };
  }

  const first = children(root)[0];
  if (first !== undefined && first[0] === "title") {
    const name = nodeText(first[1]);
    if (name.length > 0) return { name, source: "title" };
  }

  return { name: "", source: "none" };
}
