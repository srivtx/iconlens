import { XMLParser, XMLValidator } from "fast-xml-parser";

export interface ParsedSvg {
  raw: string;
  root: any | undefined;
  rootTag: string | null;
  idMap: Map<string, any>;
  duplicates: string[];
  error: string | null;
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

function localName(tag: string): string {
  const parts = tag.split(":");
  return parts[parts.length - 1] ?? tag;
}

function firstValue(value: any): any {
  return Array.isArray(value) ? value[0] : value;
}

function findRoot(document: any): { tag: string; node: any } | undefined {
  if (!isObject(document)) return undefined;

  if ("svg" in document) {
    const node = firstValue(document["svg"]);
    if (isObject(node)) return { tag: "svg", node };
  }

  const keys = Object.keys(document);
  for (const key of keys) {
    if (key.startsWith("?")) continue;
    const node = firstValue(document[key]);
    if (
      isObject(node) &&
      Object.keys(node).some(
        (attr) => attr === `${ATTR_PREFIX}xmlns` || attr.startsWith(`${ATTR_PREFIX}xmlns:`),
      )
    ) {
      return { tag: key, node };
    }
  }

  for (const key of keys) {
    if (key.startsWith("?")) continue;
    const node = firstValue(document[key]);
    if (isObject(node)) return { tag: key, node };
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
  const text = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  const idMap = new Map<string, any>();
  const duplicates: string[] = [];
  const failed = (error: string): ParsedSvg => ({
    raw,
    root: undefined,
    rootTag: null,
    idMap,
    duplicates,
    error,
  });

  const validation = XMLValidator.validate(text);
  if (validation !== true) {
    const detail =
      validation && typeof validation === "object" && validation.err
        ? `${validation.err.msg} (line ${validation.err.line}, col ${validation.err.col})`
        : "not well-formed XML";
    return failed(`Not a well-formed XML document: ${detail}`);
  }

  let document: any;
  try {
    document = parser.parse(text);
  } catch (err) {
    return failed(`XML parse failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const found = findRoot(document);
  if (found === undefined || !isObject(found.node)) {
    return failed("No root element found; expected a single <svg> element.");
  }
  if (localName(found.tag) !== "svg") {
    return failed(`Root element is <${found.tag}>, not <svg>; not a standalone SVG document.`);
  }

  const root = found.node;
  try {
    collectIds(root, idMap, duplicates);
  } catch {
    void 0;
  }

  return { raw, root, rootTag: found.tag, idMap, duplicates, error: null };
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
