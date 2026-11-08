/** `https://example.com/path?x=1` -> `https://example.com`; anything else is left for the server to reject. */
export function toOrigin(line: string): string {
  try {
    const url = new URL(line);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : line;
  } catch {
    return line;
  }
}
