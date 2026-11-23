import type { WikiLang } from "./wiki";

/*
 * Common English Wikipedia section headings for songs and albums, translated by hand.
 * Machine translation does badly on these short, context-free labels ("Background" -> "El pasado"),
 * so known headings use this glossary and only unknown ones go to MinT.
 */
const GLOSSARY: Record<string, { pt: string; es: string }> = {
  background: { pt: "Contexto", es: "Antecedentes" },
  history: { pt: "História", es: "Historia" },
  origins: { pt: "Origens", es: "Orígenes" },
  origin: { pt: "Origem", es: "Origen" },
  conception: { pt: "Concepção", es: "Concepción" },
  development: { pt: "Desenvolvimento", es: "Desarrollo" },
  inspiration: { pt: "Inspiração", es: "Inspiración" },
  writing: { pt: "Criação", es: "Creación" },
  songwriting: { pt: "Composição", es: "Composición" },
  recording: { pt: "Gravação", es: "Grabación" },
  production: { pt: "Produção", es: "Producción" },
  composition: { pt: "Composição", es: "Composición" },
  music: { pt: "Música", es: "Música" },
  lyrics: { pt: "Letra", es: "Letra" },
  "lyrical content": { pt: "Conteúdo da letra", es: "Contenido lírico" },
  themes: { pt: "Temas", es: "Temas" },
  style: { pt: "Estilo", es: "Estilo" },
  "musical style": { pt: "Estilo musical", es: "Estilo musical" },
  sound: { pt: "Sonoridade", es: "Sonido" },
  title: { pt: "Título", es: "Título" },
  artwork: { pt: "Capa", es: "Portada" },
  packaging: { pt: "Embalagem", es: "Presentación" },
  release: { pt: "Lançamento", es: "Lanzamiento" },
  promotion: { pt: "Divulgação", es: "Promoción" },
  marketing: { pt: "Divulgação", es: "Promoción" },
  reception: { pt: "Recepção", es: "Recepción" },
  "critical reception": { pt: "Recepção da crítica", es: "Recepción crítica" },
  "critical response": { pt: "Resposta da crítica", es: "Respuesta crítica" },
  "commercial performance": { pt: "Desempenho comercial", es: "Desempeño comercial" },
  legacy: { pt: "Legado", es: "Legado" },
  impact: { pt: "Impacto", es: "Impacto" },
  influence: { pt: "Influência", es: "Influencia" },
  aftermath: { pt: "Repercussão", es: "Repercusión" },
  "music video": { pt: "Videoclipe", es: "Videoclip" },
  "music videos": { pt: "Videoclipes", es: "Videoclips" },
  "artwork and packaging": { pt: "Capa e embalagem", es: "Portada y presentación" },
};

const AND = { pt: " e ", es: " y " };

/** The heading in `lang` if every part of it ("Background and composition") is in the glossary. */
export function translateHeading(heading: string, lang: WikiLang): string | undefined {
  if (lang === "en") return heading;
  const key = heading.trim().toLowerCase();
  if (GLOSSARY[key]) return GLOSSARY[key][lang];

  const parts = key.split(/\s*,\s*|\s+and\s+/).filter(Boolean);
  if (parts.length < 2) return undefined;
  const translated = parts.map((p) => GLOSSARY[p]?.[lang]);
  if (translated.some((t) => !t)) return undefined;

  const words = translated.map((t, i) => (i === 0 ? t! : t!.charAt(0).toLowerCase() + t!.slice(1)));
  return words.length === 2 ? words.join(AND[lang]) : `${words.slice(0, -1).join(", ")}${AND[lang]}${words[words.length - 1]}`;
}
