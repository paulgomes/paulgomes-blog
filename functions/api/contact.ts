import type { Env } from './_utils/db';

// POST /api/contact
// Body: { name, email, subject?, message, company? }
// Envia a mensagem do formulário de contato pro inbox do Paul usando o
// Cloudflare Email Service (Email Sending — public beta) via env.EMAIL.send().
// `company` é honeypot anti-spam: se vier preenchido, fingimos sucesso e não enviamos.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TO = 'paulgomes@wys.com.br';
const FROM = { email: 'contato@paulgomes.com.br', name: 'Site Paul Gomes' };

const LIMITS = { name: 100, subject: 150, message: 5000 } as const;

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = (await request.json().catch(() => null)) as any;
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Requisição inválida' }, { status: 400 });
    }

    // Honeypot: bot preencheu campo oculto → responde OK sem enviar nada.
    if (String(body.company || '').trim()) {
      return Response.json({ message: 'Mensagem enviada ✓' });
    }

    const name = String(body.name || '').trim();
    const email = String(body.email || '').toLowerCase().trim();
    const subject = String(body.subject || '').trim();
    const message = String(body.message || '').trim();

    if (!name) return Response.json({ error: 'Informe seu nome.' }, { status: 400 });
    if (!email || !EMAIL_REGEX.test(email)) {
      return Response.json({ error: 'Email inválido.' }, { status: 400 });
    }
    if (!message) return Response.json({ error: 'Escreva sua mensagem.' }, { status: 400 });

    if (name.length > LIMITS.name || subject.length > LIMITS.subject || message.length > LIMITS.message) {
      return Response.json({ error: 'Conteúdo muito longo.' }, { status: 400 });
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

    await env.EMAIL.send({
      to: TO,
      from: FROM,
      replyTo: { email, name },
      subject: subjectLine,
      html,
      text,
    });

    return Response.json({ message: 'Mensagem enviada ✓ Em breve retorno o contato.' });
  } catch (err: any) {
    console.error('Contact form error:', err?.code, err?.message || err);
    return Response.json({ error: 'Não consegui enviar agora. Tente novamente em instantes.' }, { status: 500 });
  }
};
