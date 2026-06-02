import type { Env } from './_utils/db';

// POST /api/contact
// Body: { name, email, subject?, message, company? }
// Envia a mensagem do formulário de contato pro inbox do Paul usando o
// Cloudflare Email Service (Email Sending — public beta) via API REST.
// (O binding send_email só existe em Workers; em Pages usamos a API REST.)
//
// Camadas de segurança:
//  1. Honeypot (`company`): se vier preenchido, é bot -> finge sucesso, não envia.
//  2. Sanitização: remove caracteres de controle (\n, \r, NUL...) dos campos de 1
//     linha -> impede injeção de cabeçalho / display-name no e-mail.
//  3. Escape de HTML na renderização -> <script>/inject viram texto literal (anti-XSS).
//  4. Validação de formato e tamanho (min/max) server-side.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HAS_LETTER = /\p{L}/u; // exige ao menos uma letra (bloqueia "123" / "!!!" como nome)

// Construídos via new RegExp pra usar só ASCII no código-fonte (sem chars de controle literais).
// Controles C0 (0x00-0x1F) + DEL (0x7F).
const CONTROL_ALL = new RegExp('[\\x00-\\x1F\\x7F]+', 'g');
// Idem, mas preservando a quebra de linha \n (0x0A).
const CONTROL_KEEP_LF = new RegExp('[\\x00-\\x09\\x0B\\x0C\\x0E-\\x1F\\x7F]+', 'g');

const TO = 'paulgomes@wys.com.br';
const FROM = { email: 'contato@paulgomes.com.br', name: 'Site Paul Gomes' };

const LIMITS = {
  name: { min: 2, max: 100 },
  email: { max: 254 },
  subject: { max: 150 },
  message: { min: 10, max: 5000 },
} as const;

// Escapa HTML pra neutralizar qualquer <script>/inject ao renderizar o e-mail.
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Campo de 1 linha (nome, e-mail, assunto): remove TODO caractere de controle
// — incluindo \n e \r — e colapsa espaços. Impede injeção de cabeçalho.
function cleanLine(s: string): string {
  return s.replace(CONTROL_ALL, ' ').replace(/\s+/g, ' ').trim();
}

// Corpo da mensagem: preserva \n (parágrafos), remove os demais controles invisíveis.
function cleanText(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(CONTROL_KEEP_LF, '').trim();
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!/application\/json/i.test(request.headers.get('content-type') || '')) {
      return Response.json({ error: 'Formato inválido.' }, { status: 415 });
    }

    const body = (await request.json().catch(() => null)) as any;
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Requisição inválida.' }, { status: 400 });
    }

    // Honeypot: bot preencheu campo oculto -> responde OK sem enviar nada.
    if (String(body.company || '').trim()) {
      return Response.json({ message: 'Mensagem enviada ✓' });
    }

    const name = cleanLine(String(body.name || ''));
    const email = cleanLine(String(body.email || '')).toLowerCase();
    const subject = cleanLine(String(body.subject || ''));
    const message = cleanText(String(body.message || ''));

    // Nome: 2–100 chars e ao menos uma letra de verdade.
    if (name.length < LIMITS.name.min || name.length > LIMITS.name.max || !HAS_LETTER.test(name)) {
      return Response.json({ error: 'Informe um nome válido.' }, { status: 400 });
    }
    // E-mail: formato + comprimento.
    if (email.length > LIMITS.email.max || !EMAIL_REGEX.test(email)) {
      return Response.json({ error: 'E-mail inválido.' }, { status: 400 });
    }
    // Assunto: opcional, só limite de tamanho.
    if (subject.length > LIMITS.subject.max) {
      return Response.json({ error: 'Assunto muito longo.' }, { status: 400 });
    }
    // Mensagem: 10–5000 chars.
    if (message.length < LIMITS.message.min) {
      return Response.json({ error: 'Escreva uma mensagem com mais detalhes.' }, { status: 400 });
    }
    if (message.length > LIMITS.message.max) {
      return Response.json({ error: 'Mensagem muito longa.' }, { status: 400 });
    }

    const ip = request.headers.get('CF-Connecting-IP') || '';
    const subjectLine = subject ? `Contato: ${subject}` : `Novo contato de ${name}`;

    const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 16px;color:#1a1a1a;">
        <h1 style="font-size:18px;margin:0 0 20px;">Nova mensagem pelo formulário de contato</h1>
        <table style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.6;">
          <tr><td style="padding:6px 0;color:#666;width:90px;vertical-align:top;">Nome</td><td style="padding:6px 0;">${esc(name)}</td></tr>
          <tr><td style="padding:6px 0;color:#666;vertical-align:top;">Email</td><td style="padding:6px 0;"><a href="mailto:${esc(email)}" style="color:#0103F9;">${esc(email)}</a></td></tr>
          ${subject ? `<tr><td style="padding:6px 0;color:#666;vertical-align:top;">Assunto</td><td style="padding:6px 0;">${esc(subject)}</td></tr>` : ''}
        </table>
        <div style="margin:20px 0 0;padding:16px;background:#f5f5f5;border-radius:6px;white-space:pre-wrap;font-size:14px;line-height:1.6;">${esc(message)}</div>
        <p style="font-size:12px;color:#999;margin:24px 0 0;">Responda este email para falar direto com ${esc(name)}.${ip ? ` · IP: ${esc(ip)}` : ''}</p>
      </div>`;

    const text =
      `Nova mensagem pelo formulário de contato\n\n` +
      `Nome: ${name}\nEmail: ${email}\n${subject ? `Assunto: ${subject}\n` : ''}\n${message}\n`;

    // Cloudflare Email Service — API REST (binding send_email não existe em Pages).
    if (!env.EMAIL_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) {
      console.error('Contact: EMAIL_API_TOKEN/CLOUDFLARE_ACCOUNT_ID ausente.');
      return Response.json({ error: 'Envio temporariamente indisponível.' }, { status: 503 });
    }

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/email/sending/send`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.EMAIL_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: TO,
        from: FROM,
        replyTo: { email, name },
        subject: subjectLine,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`Email Service ${res.status}:`, detail.slice(0, 500));
      // DIAGNÓSTICO TEMPORÁRIO: expõe o erro real da API (status 200 pra não ser mascarado).
      return Response.json({ error: 'Não consegui enviar agora. Tente novamente em instantes.', _debug: { upstreamStatus: res.status, upstreamBody: detail.slice(0, 500) } }, { status: 200 });
    }

    return Response.json({ message: 'Mensagem enviada ✓ Em breve retorno o contato.' });
  } catch (err: any) {
    console.error('Contact form error:', err?.code, err?.message || err);
    return Response.json({ error: 'Não consegui enviar agora. Tente novamente em instantes.' }, { status: 500 });
  }
};
