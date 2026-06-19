'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface MediaItem {
  id: string;
  title: string;
  type: string;
  url: string;
  thumbUrl: string | null;
}

export default function MediaPage() {
  const { data: media, isLoading } = useQuery<MediaItem[]>({
    queryKey: ['media'],
    queryFn: () => api.get('/media', { auth: false }),
  });

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-5xl mx-auto" style={{ background: 'var(--bg)' }}>
      <h1 className="font-display font-bold uppercase mb-10" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
        Медиа
      </h1>

      {isLoading && <p style={{ color: 'var(--muted)' }}>Загрузка...</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {media?.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl overflow-hidden transition-transform hover:-translate-y-1"
            style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            <div className="aspect-video w-full flex items-center justify-center" style={{ background: 'var(--surface2)' }}>
              {item.thumbUrl ? (
                <img src={item.thumbUrl} alt={item.title} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl">▶️</span>
              )}
            </div>
            <div className="p-4">
              <div className="font-medium text-sm mb-1">{item.title}</div>
              <span className="font-mono text-[10px] uppercase" style={{ color: 'var(--muted)' }}>
                {item.type}
              </span>
            </div>
          </a>
        ))}
      </div>

      {!isLoading && (!media || media.length === 0) && <p style={{ color: 'var(--muted)' }}>Медиа пока не загружено.</p>}
    </div>
  );
}
