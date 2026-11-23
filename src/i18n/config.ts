export const locales = ["en", "pt", "es"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

/** Cookie that remembers a language the visitor picked explicitly. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function hasLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** Names shown in the language menu, each in its own language. */
export const localeNames: Record<Locale, string> = {
  en: "English",
  pt: "Português",
  es: "Español",
};

/** BCP 47 tags for <html lang>, Intl formatting and Deezer's Accept-Language. */
export const localeTags: Record<Locale, string> = {
  en: "en",
  pt: "pt-BR",
  es: "es",
};

/** Prefixes a path with the locale: href("pt", "/song/1") -> "/pt/song/1". */
export function href(locale: Locale, path = "/") {
  return path === "/" ? `/${locale}` : `/${locale}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Swaps the locale segment of a pathname, keeping the rest. */
export function switchLocalePath(pathname: string, next: Locale) {
  const parts = pathname.split("/");
  if (hasLocale(parts[1])) parts[1] = next;
  else parts.splice(1, 0, next);
  return parts.join("/").replace(/\/$/, "") || `/${next}`;
}
