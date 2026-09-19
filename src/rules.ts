import type { Issue } from "./types";
import { accessibleName, children, type ParsedSvg } from "./svg";

const ATTR_PREFIX = "@_";

function isObject(value: any): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function attr(node: any, name: string): string | undefined {
  if (!isObject(node)) return undefined;
  const value = node[`${ATTR_PREFIX}${name}`];
  return typeof value === "string" ? value : undefined;
}

function safeName(parsed: ParsedSvg): { name: string; source: string } {
  try {
    return accessibleName(parsed);
  } catch {
    return { name: "", source: "none" };
  }
}

function walkElements(node: any, visit: (tag: string, value: any) => void): void {
  if (Array.isArray(node)) {
    for (const item of node) walkElements(item, visit);
    return;
  }
  if (!isObject(node)) return;

  for (const [tag, value] of children(node)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isObject(item)) {
          visit(tag, item);
          walkElements(item, visit);
        }
      }
    } else if (isObject(value)) {
      visit(tag, value);
      walkElements(value, visit);
    }
  }
}

const FOCUSABLE_ROLES = ["button", "link", "checkbox", "radio", "tab", "menuitem"];

export function runRules(parsed: ParsedSvg, location: string): Issue[] {
  const issues: Issue[] = [];
  const root = parsed.root;

  try {
    if (isObject(root)) {
      const role = attr(root, "role");
      if ((role === "img" || role === "graphics-document") && safeName(parsed).name === "") {
        issues.push({
          code: "SVG-NAME-001",
          severity: "error",
          message:
            'Root svg has role="img" but no accessible name; add aria-labelledby, aria-label, or a first-child <title>.',
          location,
          wcag: "4.1.2",
        });
      }
    }
  } catch {
    void 0;
  }

  try {
    if (isObject(root)) {
      const labelledby = attr(root, "aria-labelledby");
      if (labelledby !== undefined && labelledby.trim().length > 0) {
        const missing = labelledby
          .trim()
          .split(/\s+/)
          .filter((id) => id.length > 0 && !parsed.idMap.has(id));
        if (missing.length > 0) {
          issues.push({
            code: "SVG-NAME-002",
            severity: "error",
            message: `aria-labelledby references missing id(s): ${missing.join(", ")}.`,
            location,
            wcag: "4.1.2",
          });
        }
      }
    }
  } catch {
    void 0;
  }

  try {
    if (isObject(root)) {
      const hasRole = attr(root, "role") !== undefined;
      const hasHidden = attr(root, "aria-hidden") !== undefined;
      if (!hasRole && !hasHidden && safeName(parsed).name === "") {
        issues.push({
          code: "SVG-DECOR-003",
          severity: "warning",
          message:
            'Root svg has no role, no accessible name, and no aria-hidden; add role="img" plus a name, or mark it decorative with aria-hidden="true".',
          location,
          wcag: "1.1.1",
        });
      }
    }
  } catch {
    void 0;
  }

  try {
    if (isObject(root)) {
      const kids = children(root);
      const hasTitle = kids.some(([tag]) => tag === "title");
      const firstTag = kids.length > 0 ? kids[0]![0] : undefined;
      if (hasTitle && firstTag !== "title") {
        issues.push({
          code: "SVG-TITLE-004",
          severity: "warning",
          message: "A <title> exists but is not the first child element of the root svg.",
          location,
          wcag: "1.3.1",
        });
      }
    }
  } catch {
    void 0;
  }

  try {
    if (isObject(root)) {
      const hasName = safeName(parsed).name !== "";
      const hasDesc = children(root).some(([tag]) => tag === "desc");
      if (hasName && !hasDesc) {
        issues.push({
          code: "SVG-DESC-005",
          severity: "info",
          message: "Root svg has an accessible name but no <desc>; complex graphics benefit from a description.",
          location,
          wcag: "1.1.1",
        });
      }
    }
  } catch {
    void 0;
  }

  try {
    for (const id of parsed.duplicates) {
      issues.push({
        code: "SVG-ID-006",
        severity: "error",
        message: `Duplicate id "${id}"; ids must be unique.`,
        location: `${location} [id="${id}"]`,
      });
    }
  } catch {
    void 0;
  }

  try {
    walkElements(root, (tag, node) => {
      if (tag !== "use") return;
      const href = attr(node, "href") ?? attr(node, "xlink:href");
      if (href === undefined || !href.startsWith("#")) return;
      const id = href.slice(1);
      if (id.length > 0 && !parsed.idMap.has(id)) {
        issues.push({
          code: "SVG-USE-007",
          severity: "warning",
          message: `<use> references missing target "${href}".`,
          location: `${location} [use href="${href}"]`,
        });
      }
    });
  } catch {
    void 0;
  }

  try {
    walkElements(root, (tag, node) => {
      const tabindex = attr(node, "tabindex");
      if (tabindex === undefined) return;
      const role = attr(node, "role");
      const nativeFocusable = tag === "a" || tag === "button";
      const roleFocusable = role !== undefined && FOCUSABLE_ROLES.includes(role);
      if (!nativeFocusable && !roleFocusable) {
        issues.push({
          code: "SVG-FOCUS-008",
          severity: "warning",
          message: `tabindex="${tabindex}" on <${tag}>; only interactive elements/roles should be focusable.`,
          location: `${location} [${tag} tabindex="${tabindex}"]`,
          wcag: "2.4.3",
        });
      }
    });
  } catch {
    void 0;
  }

  issues.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  return issues;
}
