/** Strips version suffixes like "(Remastered 2009)" or " - Live at …" from a track title. */
export function baseTitle(title: string): string {
  return title
    .replace(/\s*[([][^)\]]*(remaster|version|edit|mix|mono|stereo|live|demo|deluxe|feat\.?|ft\.|with |anniversary|bonus|from |take \d|session|outtake|rough|alternate|early|instrumental)[^)\]]*[)\]]/gi, "")
    .replace(/\s+-\s+.*(remaster|version|edit|mix|mono|stereo|live|demo|single|acoustic).*$/i, "")
    .trim();
}

/** Lowercase, accent-free, punctuation-free key used to compare titles and names. */
export function norm(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function sameTitle(a: string, b: string): boolean {
  return norm(baseTitle(a)) === norm(baseTitle(b));
}

export function yearOf(date?: string | null): number | undefined {
  if (!date) return undefined;
  const m = /(\d{4})/.exec(date);
  const y = m ? Number(m[1]) : NaN;
  return Number.isFinite(y) && y > 1800 ? y : undefined;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function listJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function numberWord(n: number): string {
  const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  return words[n] ?? String(n);
}
