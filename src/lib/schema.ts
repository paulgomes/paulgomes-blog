// JSON-LD reutilizavel (GEO/AEO). Grafo base (WebSite + Organization + Person) com
// @id cruzados, injetado globalmente via BaseHead, + helpers de BreadcrumbList e FAQPage.
const SITE = 'https://paulgomes.com.br';

export const SCHEMA_ID = {
  website: `${SITE}/#website`,
  organization: `${SITE}/#organization`,
  person: `${SITE}/#person`,
} as const;

/** Entidades raiz do site (mesmo em toda pagina) — autoridade de marca/autor pra Google e LLMs. */
export function siteGraph() {
  return [
    {
      '@type': 'WebSite',
      '@id': SCHEMA_ID.website,
      url: `${SITE}/`,
      name: 'Paul Gomes — Thinking Forward',
      description:
        'Branding, tecnologia e o futuro dos negócios. Ensaios de Paul Gomes sobre IA, GEO, SEO e arquitetura digital.',
      inLanguage: 'pt-BR',
      publisher: { '@id': SCHEMA_ID.organization },
      creator: { '@id': SCHEMA_ID.person },
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${SITE}/blog?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'Organization',
      '@id': SCHEMA_ID.organization,
      name: 'Grupo WYS',
      url: 'https://agenciawys.com.br',
      description: 'Agência de marketing e inovação criativa.',
      logo: `${SITE}/logo-wys.webp`,
      founder: { '@id': SCHEMA_ID.person },
      sameAs: ['https://agenciawys.com.br'],
    },
    {
      '@type': 'Person',
      '@id': SCHEMA_ID.person,
      name: 'Paul Gomes',
      url: `${SITE}/sobre`,
      description:
        'Fundador e CEO do Grupo WYS. Escreve sobre inteligência artificial, GEO, SEO, branding e o futuro dos negócios.',
      jobTitle: 'Fundador e CEO',
      worksFor: { '@id': SCHEMA_ID.organization },
      knowsAbout: [
        'Inteligência Artificial',
        'GEO',
        'SEO',
        'Branding',
        'Marketing Digital',
        'Tecnologia',
        'Negócios',
      ],
      sameAs: [
        'https://www.linkedin.com/in/inpaulgomes/',
        'https://www.instagram.com/paulgomes/',
        'https://www.youtube.com/@paulgomesx',
        'https://x.com/paullgomes',
      ],
    },
  ];
}

/** Documento JSON-LD pronto pro <head> com @context + @graph base. */
export function baseSchemaDocument() {
  return { '@context': 'https://schema.org', '@graph': siteGraph() };
}

/** BreadcrumbList a partir de [{ name, item }]. */
export function breadcrumbList(items: { name: string; item: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.item,
    })),
  };
}

/** FAQPage a partir de [{ q, a }]. */
export function faqPage(faqs: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}
