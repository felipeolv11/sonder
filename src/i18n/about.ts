import type { Locale } from "./config";

/** The About page: how Sonder works and where its data comes from, per language. */
export type AboutContent = {
  title: string;
  intro: string;
  sections: { heading: string; paragraphs?: string[]; items?: { term?: string; text: string }[] }[];
  code: { text: string; link: string };
};

const REPO = "https://github.com/felipeolv11/sonder";

const en: AboutContent = {
  title: "About Sonder",
  intro:
    "Sonder is a music discovery app. Search for a song to read the documented story behind it, its album and its artist, and find songs to listen to next. There is no audio playback: Sonder points the way, and you listen wherever you like.",
  sections: [
    {
      heading: "Where the information comes from",
      items: [
        { term: "Deezer", text: "search, artwork, track lists, discographies, length, tempo and related artists." },
        {
          term: "Wikipedia",
          text: "the stories of songs, albums and artists. Passages are quoted as written, with a link to the section they come from, under the CC BY-SA license.",
        },
        { term: "Wikidata", text: "credits such as songwriters, producers and studios, release dates, and milestones like a band forming or an artist being born." },
        {
          term: "MinT",
          text: "Wikimedia’s open translation service. When Wikipedia has no full article in your language, the English text is translated automatically and marked as a machine translation.",
        },
      ],
    },
    {
      heading: "Facts and interpretation",
      paragraphs: [
        "Each part of a story is marked by its Wikipedia heading: documented history (background, recording, release), interpretation (lyrics, themes, musical analysis) or critical opinion (reception, legacy). Interpretation and opinion also carry a thin line along the side, so they read as views rather than facts.",
      ],
    },
    {
      heading: "How recommendations are chosen",
      items: [
        { text: "Sonder starts from the artists Deezer relates most closely to the song’s artist." },
        { text: "It takes a popular song from each, leaving out live versions, remixes and demos." },
        { text: "Songs are ranked by how closely Deezer relates their artist, then by shared genre, era and tempo." },
        { text: "Every reason shown under a song restates one of those data points. None is made up." },
      ],
      paragraphs: ["The filters (same era, lesser known, another genre) choose from the same data, out of a pool larger than the ten shown at first."],
    },
    {
      heading: "What stays in your browser",
      paragraphs: [
        "Your history, favorites, lists and discovery path are kept in this browser only. Sonder has no accounts and doesn’t send them anywhere. Clearing this site’s data in your browser removes them.",
      ],
    },
  ],
  code: { text: "Sonder’s code is open source.", link: "See it on GitHub" },
};

const pt: AboutContent = {
  title: "Sobre o Sonder",
  intro:
    "O Sonder é um app de descoberta musical. Busque uma música para ler a história documentada por trás dela, do álbum e do artista, e encontrar outras músicas para ouvir em seguida. Não há reprodução de áudio: o Sonder aponta o caminho, e você escuta onde preferir.",
  sections: [
    {
      heading: "De onde vêm as informações",
      items: [
        { term: "Deezer", text: "busca, capas, faixas, discografias, duração, andamento e artistas relacionados." },
        {
          term: "Wikipedia",
          text: "as histórias das músicas, dos álbuns e dos artistas. Os trechos são citados como estão escritos, com link para a seção de origem, sob a licença CC BY-SA.",
        },
        { term: "Wikidata", text: "créditos como compositores, produtores e estúdios, datas de lançamento e marcos como a formação de uma banda ou o nascimento de um artista." },
        {
          term: "MinT",
          text: "o serviço de tradução aberto da Wikimedia. Quando a Wikipedia não tem um artigo completo no seu idioma, o texto em inglês é traduzido automaticamente e marcado como tradução automática.",
        },
      ],
    },
    {
      heading: "Fatos e interpretação",
      paragraphs: [
        "Cada parte de uma história recebe um marcador conforme o título dela na Wikipedia: história documentada (contexto, gravação, lançamento), interpretação (letra, temas, análise musical) ou opinião da crítica (recepção, legado). Interpretação e opinião também levam um filete na lateral, para serem lidas como pontos de vista, e não como fatos.",
      ],
    },
    {
      heading: "Como as recomendações são escolhidas",
      items: [
        { text: "O Sonder parte dos artistas que o Deezer mais relaciona ao artista da música." },
        { text: "Pega uma música popular de cada um, deixando de fora versões ao vivo, remixes e demos." },
        { text: "Ordena as músicas pela proximidade que o Deezer dá ao artista e, depois, por gênero, época e andamento em comum." },
        { text: "Cada motivo mostrado embaixo de uma música repete um desses dados. Nenhum é inventado." },
      ],
      paragraphs: ["Os filtros (mesma época, menos conhecidas, outro gênero) usam os mesmos dados, escolhendo entre um grupo maior do que as dez mostradas no início."],
    },
    {
      heading: "O que fica no seu navegador",
      paragraphs: [
        "Seu histórico, suas favoritas, suas listas e o caminho de descoberta ficam guardados só neste navegador. O Sonder não tem contas e não envia esses dados a lugar nenhum. Limpar os dados deste site no navegador apaga tudo.",
      ],
    },
  ],
  code: { text: "O código do Sonder é aberto.", link: "Ver no GitHub" },
};

const es: AboutContent = {
  title: "Sobre Sonder",
  intro:
    "Sonder es una app de descubrimiento musical. Busca una canción para leer la historia documentada detrás de ella, de su álbum y de su artista, y encontrar otras canciones para escuchar después. No reproduce audio: Sonder señala el camino, y tú escuchas donde prefieras.",
  sections: [
    {
      heading: "De dónde viene la información",
      items: [
        { term: "Deezer", text: "búsqueda, portadas, pistas, discografías, duración, tempo y artistas relacionados." },
        {
          term: "Wikipedia",
          text: "las historias de las canciones, los álbumes y los artistas. Los fragmentos se citan tal como están escritos, con enlace a la sección de origen, bajo la licencia CC BY-SA.",
        },
        { term: "Wikidata", text: "créditos como compositores, productores y estudios, fechas de lanzamiento e hitos como la formación de una banda o el nacimiento de un artista." },
        {
          term: "MinT",
          text: "el servicio de traducción abierto de Wikimedia. Cuando Wikipedia no tiene un artículo completo en tu idioma, el texto en inglés se traduce automáticamente y se marca como traducción automática.",
        },
      ],
    },
    {
      heading: "Hechos e interpretación",
      paragraphs: [
        "Cada parte de una historia lleva un marcador según su título en Wikipedia: historia documentada (contexto, grabación, lanzamiento), interpretación (letra, temas, análisis musical) u opinión de la crítica (recepción, legado). La interpretación y la opinión llevan además una línea fina al costado, para leerse como puntos de vista y no como hechos.",
      ],
    },
    {
      heading: "Cómo se eligen las recomendaciones",
      items: [
        { text: "Sonder parte de los artistas que Deezer más relaciona con el artista de la canción." },
        { text: "Toma una canción popular de cada uno, dejando fuera versiones en vivo, remixes y demos." },
        { text: "Ordena las canciones por la cercanía que Deezer da al artista y, después, por género, época y tempo en común." },
        { text: "Cada motivo que aparece bajo una canción repite uno de esos datos. Ninguno es inventado." },
      ],
      paragraphs: ["Los filtros (misma época, menos conocidas, otro género) usan los mismos datos y eligen entre un grupo mayor que las diez que se muestran al principio."],
    },
    {
      heading: "Lo que queda en tu navegador",
      paragraphs: [
        "Tu historial, tus favoritas, tus listas y el camino de descubrimiento se guardan solo en este navegador. Sonder no tiene cuentas y no envía esos datos a ningún sitio. Borrar los datos de este sitio en el navegador los elimina.",
      ],
    },
  ],
  code: { text: "El código de Sonder es abierto.", link: "Verlo en GitHub" },
};

const content: Record<Locale, AboutContent> = { en, pt, es };

export function getAbout(locale: Locale) {
  return content[locale];
}

export const repoUrl = REPO;
