/** Escapes text for safe use inside the HTML strings that react-globe.gl renders as tooltips. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
