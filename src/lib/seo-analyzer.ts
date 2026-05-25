// SEO analyzer puro client-side. Zero LLM, zero custo.
// Usado pelo editor de posts em /painel/posts/editor.

// Stopwords PT-BR pra TF-IDF
const STOPWORDS = new Set([
  'a','o','as','os','um','uma','uns','umas','de','do','da','dos','das',
  'em','no','na','nos','nas','para','pra','por','pelo','pela','pelos','pelas',
  'com','sem','sobre','sob','entre','ate','desde',
  'e','ou','mas','porem','contudo','que','se','como','quando','onde','porque',
  'eu','tu','ele','ela','nos','vos','eles','elas','meu','minha','seu','sua',
  'isso','isto','aquilo','este','esta','esse','essa','aquele','aquela',
  'eh','foi','ser','esta','sao','estao','seja','sendo','tem','tinha','teve',
  'tambem','muito','pouco','mais','menos','ja','ainda','sim','nao','quase',
  'aqui','ali','la','agora','depois','antes','sempre','nunca','hoje','ontem',
  'todo','toda','todos','todas','outro','outra','outros','outras',
  'qualquer','quais','qual','quem','cujo','cuja',
  'assim','entao','pois','enquanto',
  'fazer','feito','fez','faz','fazendo','dizer','disse',
  'ter','tido','ir','vir','ver','dar','dado',
]);

// Power words PT-BR (boost CTR)
const POWER_WORDS = [
  'descubra','aprenda','domine','conheca','revele','desvende',
  'guia','tutorial','passo','checklist','dicas','segredos',
  'completo','definitivo','essencial','fundamental','melhor','top',
  'novo','novos','novidade','novidades','atualizado','2026',
  'gratuito','gratis','agora','hoje','rapido','simples','facil',
  'comprovado','testado','garantido','exclusivo',
  'evite','pare','nunca','sempre',
  'aumente','melhore','transforme','revolucione','impulsione',
  'erros','mitos','verdades','realidade',
  'como','por que','o que','quanto',
];

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// === 1. Strip markdown/HTML
export function stripMarkdown(text: string): string {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[*_~]+/g, '')
    .replace(/^\s*>\s+/gm, '')
    .replace(/^---+$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

// === 2. Detectar focus keyword via TF-IDF simplificado
export function detectFocusKeyword(title: string, content: string): string {
  const cleanContent = stripMarkdown(content);
  const tokens = tokenize(cleanContent);
  const titleTokens = new Set(tokenize(title));
  if (tokens.length === 0) return '';

  const freq: Record<string, number> = {};
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1;

  const bigrams: Record<string, number> = {};
  for (let i = 0; i < tokens.length - 1; i++) {
    // Rejeita bigram com palavra repetida (ex: "paulgomes paulgomes" de alt-text duplicado)
    if (tokens[i] === tokens[i + 1]) continue;
    const bg = `${tokens[i]} ${tokens[i + 1]}`;
    bigrams[bg] = (bigrams[bg] || 0) + 1;
  }

  const candidates: Array<{ term: string; score: number }> = [];

  for (const [term, count] of Object.entries(freq)) {
    if (count < 2) continue;
    const titleBoost = titleTokens.has(term) ? 3 : 1;
    candidates.push({ term, score: count * titleBoost });
  }

  for (const [term, count] of Object.entries(bigrams)) {
    if (count < 2) continue;
    const [w1, w2] = term.split(' ');
    const titleBoost = (titleTokens.has(w1) && titleTokens.has(w2)) ? 5 : 2;
    candidates.push({ term, score: count * titleBoost * 1.5 });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.term || '';
}

// === 3. Gerar meta title (<= 60 chars)
export function generateMetaTitle(title: string, _focusKeyword: string): string {
  const result = String(title || '').trim();
  if (result.length <= 60) return result;
  const truncated = result.slice(0, 57);
  const lastSpace = truncated.lastIndexOf(' ');
  return truncated.slice(0, lastSpace > 30 ? lastSpace : 57) + '...';
}

// === 4. Gerar meta description (~150-160 chars), prefere paragrafo com focus keyword
export function generateMetaDescription(content: string, focusKeyword: string): string {
  const clean = stripMarkdown(content);
  if (clean.length === 0) return '';

  const paragraphs = clean.split(/(?<=[.!?])\s+/);
  let target: string | null = null;

  if (focusKeyword) {
    const kwLower = focusKeyword.toLowerCase();
    target = paragraphs.find((p) => p.toLowerCase().includes(kwLower)) || null;
  }
  target = target || paragraphs[0] || clean;

  if (target.length <= 160) return target;
  const truncated = target.slice(0, 155);
  const lastSpace = truncated.lastIndexOf(' ');
  return truncated.slice(0, lastSpace > 100 ? lastSpace : 155) + '...';
}

// === 5. Score SEO
export interface SEOCheck {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

export interface SEOAnalysis {
  score: number;
  grade: 'green' | 'yellow' | 'red';
  checks: SEOCheck[];
  powerWordsFound: string[];
}

export function analyzeSEO(params: {
  title: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  content: string;
}): SEOAnalysis {
  const { metaTitle, metaDescription, focusKeyword, content } = params;
  const checks: SEOCheck[] = [];
  const cleanContent = stripMarkdown(content);
  const kw = String(focusKeyword || '').toLowerCase().trim();

  // Meta title length
  const mtLen = metaTitle.length;
  if (mtLen === 0) checks.push({ id: 'mt-empty', label: 'Meta título', status: 'fail', message: 'Meta título vazio' });
  else if (mtLen < 30) checks.push({ id: 'mt-short', label: 'Meta título', status: 'warn', message: `Curto (${mtLen}/60). Ideal 50-60.` });
  else if (mtLen > 60) checks.push({ id: 'mt-long', label: 'Meta título', status: 'fail', message: `Longo (${mtLen}/60). Google trunca acima de 60.` });
  else checks.push({ id: 'mt-ok', label: 'Meta título', status: 'pass', message: `Tamanho ideal (${mtLen}/60)` });

  // Meta description length
  const mdLen = metaDescription.length;
  if (mdLen === 0) checks.push({ id: 'md-empty', label: 'Meta descrição', status: 'fail', message: 'Meta descrição vazia' });
  else if (mdLen < 120) checks.push({ id: 'md-short', label: 'Meta descrição', status: 'warn', message: `Curta (${mdLen}/160). Ideal 150-160.` });
  else if (mdLen > 160) checks.push({ id: 'md-long', label: 'Meta descrição', status: 'fail', message: `Longa (${mdLen}/160). Google trunca.` });
  else checks.push({ id: 'md-ok', label: 'Meta descrição', status: 'pass', message: `Tamanho ideal (${mdLen}/160)` });

  // Focus keyword
  if (!kw) {
    checks.push({ id: 'kw-empty', label: 'Palavra-chave', status: 'warn', message: 'Sem palavra-chave foco definida' });
  } else {
    if (metaTitle.toLowerCase().includes(kw)) {
      checks.push({ id: 'kw-mt', label: 'Keyword no meta título', status: 'pass', message: 'Aparece no meta título ✓' });
    } else {
      checks.push({ id: 'kw-mt-miss', label: 'Keyword no meta título', status: 'fail', message: 'Adicione a palavra-chave ao meta título' });
    }

    if (metaDescription.toLowerCase().includes(kw)) {
      checks.push({ id: 'kw-md', label: 'Keyword na meta descrição', status: 'pass', message: 'Aparece na meta descrição ✓' });
    } else {
      checks.push({ id: 'kw-md-miss', label: 'Keyword na meta descrição', status: 'fail', message: 'Adicione a palavra-chave à descrição' });
    }

    if (cleanContent && kw) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const occurrences = (cleanContent.toLowerCase().match(new RegExp(`\\b${escaped}\\b`, 'g')) || []).length;
      const wordCount = cleanContent.split(/\s+/).filter(Boolean).length;
      const density = wordCount > 0 ? (occurrences * 100) / wordCount : 0;

      if (occurrences === 0) {
        checks.push({ id: 'kw-content', label: 'Keyword no conteúdo', status: 'fail', message: 'Palavra-chave não aparece no conteúdo' });
      } else if (density < 0.3) {
        checks.push({ id: 'kw-density-low', label: 'Densidade da keyword', status: 'warn', message: `Baixa (${density.toFixed(1)}%). Ideal 0.5%-2.5%.` });
      } else if (density > 3) {
        checks.push({ id: 'kw-density-high', label: 'Densidade da keyword', status: 'warn', message: `Alta (${density.toFixed(1)}%). Risco de keyword stuffing.` });
      } else {
        checks.push({ id: 'kw-density-ok', label: 'Densidade da keyword', status: 'pass', message: `${occurrences} ocorrências (${density.toFixed(1)}%) ✓` });
      }
    }
  }

  // Keyword no inicio do meta title (boost SEO)
  if (kw && metaTitle.toLowerCase().startsWith(kw)) {
    checks.push({ id: 'kw-start', label: 'Keyword no início', status: 'pass', message: 'Meta título começa com keyword ✓' });
  }

  // Power words
  const found: string[] = [];
  const combined = normalize(`${metaTitle} ${metaDescription}`);
  for (const pw of POWER_WORDS) {
    const pwNorm = normalize(pw);
    if (combined.includes(pwNorm)) found.push(pw);
  }
  if (found.length === 0) {
    checks.push({ id: 'pw-empty', label: 'Power words', status: 'warn', message: 'Sem palavras de impacto' });
  } else if (found.length >= 2) {
    checks.push({ id: 'pw-good', label: 'Power words', status: 'pass', message: `${found.length} palavras de impacto ✓` });
  } else {
    checks.push({ id: 'pw-one', label: 'Power words', status: 'pass', message: '1 palavra de impacto' });
  }

  // Conteudo minimo
  const wordCount = cleanContent.split(/\s+/).filter((w) => w.length > 0).length;
  if (wordCount < 300) {
    checks.push({ id: 'content-short', label: 'Conteúdo', status: 'warn', message: `${wordCount} palavras. Mínimo recomendado: 300.` });
  } else {
    checks.push({ id: 'content-ok', label: 'Conteúdo', status: 'pass', message: `${wordCount} palavras ✓` });
  }

  // Score
  const passCount = checks.filter((c) => c.status === 'pass').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;
  const failCount = checks.filter((c) => c.status === 'fail').length;
  const total = checks.length;
  const rawScore = (passCount + warnCount * 0.5) / total * 100;
  const score = Math.round(rawScore);

  let grade: 'green' | 'yellow' | 'red';
  if (failCount === 0 && score >= 80) grade = 'green';
  else if (score >= 50) grade = 'yellow';
  else grade = 'red';

  return { score, grade, checks, powerWordsFound: found };
}
