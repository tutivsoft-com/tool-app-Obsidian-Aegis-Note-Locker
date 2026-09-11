import { parseYaml, stringifyYaml } from "obsidian";

export interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  body: string;
  hasFrontmatter: boolean;
}

export const AEGIS_KEY = "aegis";

export function parseMarkdown(content: string): ParsedMarkdown {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: {}, body: content, hasFrontmatter: false };
  const parsed = parseYaml(match[1]);
  return {
    frontmatter: parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {},
    body: content.slice(match[0].length),
    hasFrontmatter: true,
  };
}

export function serializeMarkdown(frontmatter: Record<string, unknown>, body: string): string {
  if (Object.keys(frontmatter).length === 0) return body;
  const yaml = stringifyYaml(frontmatter).trimEnd();
  return `---\n${yaml}\n---\n${body}`;
}

export function topLevelPropertyNames(frontmatter: Record<string, unknown>): string[] {
  return Object.keys(frontmatter).filter((key) => key !== AEGIS_KEY && !key.startsWith("aegis-"));
}

export function displayValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.length} item(s)]`;
  if (value && typeof value === "object") return "{object}";
  return String(value ?? "");
}
