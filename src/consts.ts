export const SITE_TITLE = 'Paul Gomes';
export const SITE_TAGLINE = 'Branding · Tecnologia · Negócios';
export const SITE_DESCRIPTION = 'Branding, tecnologia e o futuro dos negócios. Ensaios e ideias de Paul Gomes.';
export const SITE_AUTHOR = 'Paul Gomes';
export const SITE_AUTHOR_BIO = 'Fundador da WYS. Escrevo sobre marcas, tecnologia e o futuro dos negócios.';
export const SITE_SIGNATURE = 'Thinking Forward · Made by Human';
export const SITE_LANG = 'pt-BR';
export const SITE_LOCALE = 'pt_BR';

export const SOCIAL = {
  linkedin: 'https://www.linkedin.com/in/inpaulgomes/',
  instagram: 'https://www.instagram.com/paulgomes/',
  youtube: 'https://www.youtube.com/@paulgomesx',
  x: 'https://x.com/paullgomes',
  email: 'mailto:paulgomes@wys.com.br',
};

// Card do autor exibido ao lado do carrossel de destaques na home.
// PLACEHOLDER: troque `count` pelos números reais de seguidores quando tiver.
export const AUTHOR_CARD = {
  greeting: 'Bem-vindo ao blog',
  name: SITE_AUTHOR,
  location: 'Sorocaba · Brasil',
  bio: 'Fundador e CEO do Grupo WYS. Escrevo sobre IA, branding e o futuro dos negócios.',
  socials: [
    { platform: 'linkedin', url: SOCIAL.linkedin, count: '20k', label: 'Seguidores' },
    { platform: 'instagram', url: SOCIAL.instagram, count: '57,3k', label: 'Seguidores' },
    { platform: 'youtube', url: SOCIAL.youtube, count: '1,48k', label: 'Inscritos' },
    { platform: 'x', url: SOCIAL.x, count: '185', label: 'Seguidores' },
  ],
} as const;

export const FEATURED_THEME = {
  label: 'Tecnologia & IA',
  slug: 'tecnologia',
  description: 'Como a inteligência artificial está reescrevendo as regras dos negócios, do marketing e do trabalho criativo.',
  keywords: ['inteligencia artificial', 'tecnologia', 'ia', 'gpt', 'chatgpt', 'futuro', 'inovacao'],
};

// Marcas — gerenciadas via /painel/marcas, persistidas em src/data/brands.json
// (Removido daqui pra evitar duas fontes de verdade)
