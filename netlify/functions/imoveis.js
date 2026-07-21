// Esta função roda no servidor do Netlify (nunca no navegador do visitante).
// Ela usa o token secreto do Notion (guardado nas variáveis de ambiente do
// Netlify) para buscar os imóveis e devolve só os dados prontos pro site.

const DATABASE_ID = "3623f68dc75880a395c0f106153130e1";

exports.handler = async function () {
  const NOTION_TOKEN = process.env.NOTION_TOKEN;

  if (!NOTION_TOKEN) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error:
          "NOTION_TOKEN não configurado. Adicione o token nas variáveis de ambiente do Netlify.",
      }),
    };
  }

  try {
    let results = [];
    let cursor = undefined;

    do {
      const response = await fetch(
        `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${NOTION_TOKEN}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filter: {
              or: [
                {
                  property: "Situação do Anúncio",
                  status: { equals: "Anunciado" },
                },
                {
                  property: "Situação do Anúncio",
                  status: { equals: "Anúncio pausado" },
                },
              ],
            },
            start_cursor: cursor,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          statusCode: response.status,
          body: JSON.stringify({ error: data }),
        };
      }

      results = results.concat(data.results);
      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);

    const textOf = (prop) =>
      (prop?.rich_text || []).map((t) => t.plain_text).join("");

    const imoveis = results.map((page) => {
      const p = page.properties;
      return {
        id: page.id,
        status: p["Situação do Anúncio"]?.status?.name || "",
        contrato: textOf(p["Contrato/ID Imóvel"]),
        descricao: textOf(p["Descrição do Imóvel"]),
        area: p["Área"]?.number ?? null,
        cidade: p["Cidade"]?.select?.name || "",
        localizacao: textOf(p["Localização"]),
        tipo: p["Tipo de imóvel"]?.select?.name || "",
        documentado: p["Documentado?"]?.select?.name || "",
        valor: p["Valor anunciado"]?.number ?? null,
        negociacao: (p["Forma de Negociação"]?.multi_select || []).map(
          (o) => o.name
        ),
        dataAnuncio: p["Data do Anúncio"]?.date?.start || null,
        fotos: (p["Fotos do Imóvel"]?.files || []).map((f) =>
          f.type === "external" ? f.external.url : f.file.url
        ),
      };
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify(imoveis),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
