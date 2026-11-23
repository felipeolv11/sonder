import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { hasLocale, type Locale } from "./config";
import { getDictionary } from "./dictionaries";

/** The current route's locale, read from the [lang] root segment. */
export async function getLocale(): Promise<Locale> {
  const value = await lang();
  if (!hasLocale(value)) notFound();
  return value;
}

export async function getDict() {
  return getDictionary(await getLocale());
}
