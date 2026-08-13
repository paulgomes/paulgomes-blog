// FONTE ÚNICA de configuração do site/tenant (FASE 1 do ROADMAP).
// Hoje 1 tenant; a estrutura já é multi-tenant para não exigir reescrita depois.
// Objetivo: eliminar os literais de domínio/identidade espalhados em ~19 arquivos.
// REGRA: mudar de tenant = trocar este objeto. Nenhum domínio hardcoded fora daqui.

export interface TenantConfig {
  /** URL canônica base, SEM barra final (ex.: https://exemplo.com). */
  url: string;
  title: string;
  tagline: string;
  description: string;
  /** BCP-47, ex.: pt-BR. */
  locale: string;
  author: {
    name: string;
    url: string;
    jobTitle: string;
    bio: string;
    knowsAbout: string[];
    sameAs: string[];
  };
  organization: {
    name: string;
    url: string;
    /** URL absoluta ou path do logo. */
    logo: string;
    sameAs: string[];
  };
}

export const SITE_CONFIG: TenantConfig = {
  url: 'https://paulgomes.com.br',
  title: 'Paul Gomes — Thinking Forward',
  tagline: 'Branding · Tecnologia · Negócios',
  description:
    'Branding, tecnologia e o futuro dos negócios. Ensaios de Paul Gomes sobre IA, GEO, SEO e arquitetura digital.',
  locale: 'pt-BR',
  author: {
    name: 'Paul Gomes',
    url: 'https://paulgomes.com.br/sobre',
    jobTitle: 'Fundador e CEO',
    bio: 'Fundador e CEO do Grupo WYS. Escreve sobre inteligência artificial, GEO, SEO, branding e o futuro dos negócios.',
    knowsAbout: [
      'Inteligência Artificial',
      'GEO',
      'SEO',
      'Branding',
      'Marketing Digital',
      'Tecnologia',
      'Negócios',
    ],
    // `sameAs` é o que permite ao buscador consolidar perfis espalhados numa
    // única entidade. Numa busca por nome disputada com homônimos, cada perfil
    // confirmado aqui ajuda a separar esta pessoa das outras — então a lista
    // deve conter TODO perfil oficial, não só as redes principais.
    sameAs: [
      'https://www.linkedin.com/in/inpaulgomes/',
      'https://www.instagram.com/paulgomes/',
      'https://www.youtube.com/@paulgomesx',
      'https://x.com/paullgomes',
      // TODO: incluir a URL real do app na App Store. Ela aparece na busca por
      // "paul gomes", mas o endereço da App Store carrega um ID numérico
      // (…/app/paul-gomes/id000000000) que precisa ser copiado da loja. Um
      // sameAs que aponta para o lugar errado enfraquece a entidade em vez de
      // reforçá-la, então fica de fora até termos o endereço correto.
    ],
  },
  organization: {
    name: 'Grupo WYS',
    url: 'https://agenciawys.com.br',
    logo: 'https://paulgomes.com.br/logo-wys.webp',
    sameAs: ['https://agenciawys.com.br'],
  },
};

/** Monta URL absoluta a partir de um path, usando o domínio do tenant. */
export function absoluteUrl(path = '/'): string {
  return new URL(path, SITE_CONFIG.url + '/').href;
}
