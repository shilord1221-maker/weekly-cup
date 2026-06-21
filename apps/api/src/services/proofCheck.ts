import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/env.js';

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

export type ProofCheckResult =
  | { ok: true; detectedStaticId: string }
  | { ok: false; reason: 'NO_API_KEY' | 'FETCH_FAILED' | 'NOT_AN_IMAGE' | 'NOT_DETECTED' | 'API_ERROR' };

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB — щедрый предел для скрина

/**
 * Скачивает картинку по ссылке (например, с yapix) и просит Claude найти Static ID
 * в формате "#число" — он всегда отображается в верхнем правом углу HUD игры (рядом
 * с "ID:" и "Online:"), это фиксированное расположение для конкретного сервера.
 */
export async function verifyStaticIdProof(proofUrl: string): Promise<ProofCheckResult> {
  const anthropic = getClient();
  if (!anthropic) return { ok: false, reason: 'NO_API_KEY' };

  let imageBytes: ArrayBuffer;
  let contentType: string;
  try {
    const res = await fetch(proofUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return { ok: false, reason: 'FETCH_FAILED' };
    contentType = res.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) return { ok: false, reason: 'NOT_AN_IMAGE' };
    imageBytes = await res.arrayBuffer();
    if (imageBytes.byteLength > MAX_IMAGE_BYTES) return { ok: false, reason: 'NOT_AN_IMAGE' };
  } catch {
    return { ok: false, reason: 'FETCH_FAILED' };
  }

  const base64 = Buffer.from(imageBytes).toString('base64');
  const mediaType = contentType.includes('png') ? 'image/png' : contentType.includes('webp') ? 'image/webp' : 'image/jpeg';

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType as any, data: base64 } },
            {
              type: 'text',
              text:
                'На этом скриншоте из игры в правом верхнем углу есть HUD-надпись вида "ID: 68 | #13148". ' +
                'Найди число после символа "#" — это Static ID игрока. ' +
                'Ответь СТРОГО в формате JSON без какого-либо другого текста: {"staticId": "число"} ' +
                'Если такой надписи на скрине нет или её не видно, ответь {"staticId": null}.',
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return { ok: false, reason: 'NOT_DETECTED' };

    const match = textBlock.text.match(/\{[^}]*\}/);
    if (!match) return { ok: false, reason: 'NOT_DETECTED' };

    const parsed = JSON.parse(match[0]) as { staticId: string | null };
    if (!parsed.staticId || !/^\d+$/.test(parsed.staticId)) {
      return { ok: false, reason: 'NOT_DETECTED' };
    }

    return { ok: true, detectedStaticId: parsed.staticId };
  } catch {
    return { ok: false, reason: 'API_ERROR' };
  }
}
