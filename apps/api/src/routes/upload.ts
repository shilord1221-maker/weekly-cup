import type { FastifyInstance } from 'fastify';
import { requireAuth } from '@/middleware/auth.js';
import { uploadImage, UploadError, isStorageConfigured } from '@/services/storage.js';

const ALLOWED_FOLDERS = new Set(['media-thumbs', 'static-id-proofs', 'news-covers', 'map-images']);

export async function uploadRoutes(app: FastifyInstance) {
  app.get('/api/upload/status', async (req, reply) => {
    reply.send({ enabled: isStorageConfigured() });
  });

  app.post(
    '/api/upload',
    { config: { rateLimit: { max: 20, timeWindow: '5 minutes' } } },
    async (req, reply) => {
      const data = await req.file();
      if (!data) {
        return reply.code(400).send({ error: 'NO_FILE', message: 'Файл не передан' });
      }

      const folderRaw = (data.fields.folder as any)?.value;
      const folder = typeof folderRaw === 'string' && ALLOWED_FOLDERS.has(folderRaw) ? folderRaw : 'misc';

      // static-id-proofs доступны без авторизации — загружаются при регистрации до создания аккаунта.
      // Все остальные папки требуют авторизации.
      if (folder !== 'static-id-proofs') {
        const header = req.headers.authorization;
        const token = header?.startsWith('Bearer ') ? header.slice(7) : (req as any).cookies?.access_token;
        if (!token) {
          return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Требуется авторизация' });
        }
      }

      const buffer = await data.toBuffer();

      try {
        const url = await uploadImage(buffer, data.mimetype, folder);
        reply.send({ url });
      } catch (e) {
        if (e instanceof UploadError) {
          return reply.code(400).send({ error: e.code, message: e.message });
        }
        req.log.error(e, 'Upload failed');
        return reply.code(500).send({ error: 'UPLOAD_FAILED', message: 'Не удалось загрузить файл' });
      }
    }
  );
}
