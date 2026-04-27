import sanitizeHtml from "sanitize-html";

/** Sanitiza markdown/HTML. NO permite <script> ni <style>. */
export function sanitizeSafe(input: string): string {
  return sanitizeHtml(input, {
    // usar allowlist por defecto (seguro)
    allowedTags: false,
    allowedAttributes: false,
    disallowedTagsMode: "recursiveEscape",
    // ⚠️ NO pongas allowVulnerableTags ni agregues 'style'/'script'
  });
}
