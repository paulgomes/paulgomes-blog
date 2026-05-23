import type { Env } from './_utils/db';
import { requireAuth } from './_utils/require-auth';
import { generateId } from './_utils/crypto';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) return Response.json({ error: 'Sem arquivo' }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json({ error: 'Tipo de arquivo não permitido (use jpeg, png, webp ou gif)' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return Response.json({ error: 'Arquivo muito grande (máx 10MB)' }, { status: 400 });
  }

  // Gera nome único: YYYY/MM/uuid.ext
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const filename = `${yyyy}/${mm}/${generateId()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  await env.MEDIA.put(filename, arrayBuffer, {
    httpMetadata: { contentType: file.type },
  });

  const url = `${env.PUBLIC_R2_DOMAIN}/${filename}`;
  return Response.json({ url, filename, size: file.size, type: file.type });
};
