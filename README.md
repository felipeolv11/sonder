# Sonder

Um app de descoberta musical. Busque uma música para ver a capa, a história documentada por trás dela e do álbum, e dez músicas que você talvez goste em seguida. Não há reprodução de áudio.

**No ar:** https://sonder-zeta-khaki.vercel.app

## Como rodar

```bash
npm install
cp .env.example .env.local   # depois preencha WIKIMEDIA_CONTACT
npm run dev                  # http://localhost:3000
```

`WIKIMEDIA_CONTACT` deve ser um e-mail ou uma URL sobre o app. A Wikimedia permite cerca de 10 requisições por minuto a clientes que não se identificam, e 200 por minuto aos que se identificam ([limites de uso](https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits)). Sem essa variável, as histórias ainda carregam, mas devagar.

## De onde vêm os dados

| O quê | Fonte | Observações |
| --- | --- | --- |
| Busca, capa, álbum, duração, andamento, gravadora | [API do Deezer](https://developers.deezer.com/api) | Não precisa de chave. As requisições são espaçadas para respeitar o limite de 50 a cada 5 segundos. |
| História da música e do álbum | Wikipedia (Action API, extratos em texto puro) | Exibida como citação, com links para as seções e atribuição CC BY-SA. Nada é gerado nem reescrito; a única transformação é a tradução automática, sempre sinalizada (veja Idiomas). |
| Créditos (compositores, produtores, estúdio, data de lançamento, gêneros) | Wikidata | Lidos do item do Wikidata ligado ao artigo da música na Wikipedia. |
| Recomendações | Artistas relacionados do Deezer, mais gêneros, datas e BPM dos álbuns | Veja abaixo. |

### Separando fatos de interpretação

Cada seção da história recebe um rótulo de acordo com o título dela na Wikipedia:

- **História documentada**: contexto, composição da letra, gravação, lançamento.
- **Interpretação**: análise musical, letra, temas.
- **Opinião da crítica**: recepção, legado.

As seções de interpretação e de opinião também ficam marcadas com um filete na lateral. Quando a Wikipedia não tem artigo sobre a música, a página avisa e conta a história do álbum, ou do artista.

### Como funcionam as recomendações

1. Busca até 14 artistas que o Deezer lista como relacionados ao artista da música.
2. Pega uma música popular de cada um, ignorando versões ao vivo, remixes, demos e a própria música buscada.
3. Se a faixa vier de uma coletânea ou relançamento, tenta encontrar a mesma gravação num lançamento original do artista.
4. Ordena pela proximidade que o Deezer dá ao artista e, depois, por gênero em comum, proximidade do ano de lançamento e andamento.
5. Escreve o motivo de cada recomendação só a partir desses dados (por exemplo, "Do álbum *Grace* (1994), três anos antes de 'No Surprises'"). Nada é inventado.

## Idiomas

A interface está em inglês, português (Brasil) e espanhol, em `/en`, `/pt` e `/es`.

- `src/proxy.ts` redireciona endereços sem idioma (`/`, `/song/123`). Usa o idioma escolhido antes pelo visitante (o cookie `NEXT_LOCALE`, salvo pelo menu de idioma); senão, o `Accept-Language` do navegador; senão, inglês.
- Os textos da interface ficam em `src/i18n/dictionaries.ts`. Para adicionar um idioma, inclua-o em `locales` no `src/i18n/config.ts` e crie o dicionário dele.
- A história vem da Wikipedia no idioma do leitor quando essa edição tem um artigo substancial, encontrado pelos sitelinks do Wikidata. Caso contrário, o artigo em inglês é traduzido automaticamente pelo [MinT](https://www.mediawiki.org/wiki/MinT), o serviço de tradução aberto da Wikimedia, e o trecho recebe o aviso "tradução automática". Títulos de seção comuns ("Background", "Recording"…) usam um glossário próprio (`src/lib/headings.ts`), porque a tradução automática erra rótulos curtos sem contexto. Se a tradução falhar, o texto aparece em inglês com um aviso e o resultado fica pouco tempo em cache. Créditos e gêneros usam os nomes do Wikidata e do Deezer no mesmo idioma. A camada de dados devolve fatos e motivos de recomendação como dados estruturados, e a interface monta as frases.

## Estrutura

```
src/lib/deezer.ts      Cliente do Deezer (com limite de requisições)
src/lib/wiki.ts        Consultas à Wikipedia e ao Wikidata, identificação de artigos, limite de requisições da Wikimedia
src/lib/music.ts       Ordenação da busca, montagem da música, história e recomendações ("use cache")
src/i18n/              Idiomas, dicionários e formatação de datas, listas e motivos
src/app/[lang]/        Páginas: início, /search, /song/[id], /history
src/app/api/suggest/   Sugestões da busca
src/components/        Barra superior, busca com sugestões, fundo a partir da capa, história, recomendações
```

Os resultados ficam em cache com os Cache Components do Next.js (`"use cache"`). Músicas, histórias e recomendações ficam guardadas por dias. Resultados sem os dados da Wikipedia por causa de alguma falha ficam só alguns minutos, e erros não entram no cache. O histórico fica salvo no localStorage do navegador.
