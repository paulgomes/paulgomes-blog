// JSON-LD reutilizavel (GEO/AEO). Grafo base (WebSite + Organization + Person) com
// @id cruzados, injetado globalmente via BaseHead, + helpers de BreadcrumbList e FAQPage.
// FASE 1: dominio e identidade vem de src/config/site.ts (fonte unica), nao mais hardcoded.
import { SITE_CONFIG } from '../config/site';

const SITE = SITE_CONFIG.url;

export const SCHEMA_ID = {
  website: `${SITE}/#website`,
  organization: `${SITE}/#organization`,
  person: `${SITE}/#person`,
} as const;

/** Entidades raiz do site (mesmo em toda pagina) — autoridade de marca/autor pra Google e LLMs. */
export function siteGraph() {
  const { author, organization } = SITE_CONFIG;
  return [
    {
      '@type': 'WebSite',
      '@id': SCHEMA_ID.website,
      url: `${SITE}/`,
      name: SITE_CONFIG.title,
      description: SITE_CONFIG.description,
      inLanguage: SITE_CONFIG.locale,
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
      name: organization.name,
      url: organization.url,
      description: 'Agência de marketing e inovação criativa.',
      logo: organization.logo,
      founder: { '@id': SCHEMA_ID.person },
      sameAs: organization.sameAs,
    },
    {
      '@type': 'Person',
      '@id': SCHEMA_ID.person,
      name: author.name,
      url: author.url,
      description: author.bio,
      jobTitle: author.jobTitle,
      worksFor: { '@id': SCHEMA_ID.organization },
      knowsAbout: author.knowsAbout,
      sameAs: author.sameAs,
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
