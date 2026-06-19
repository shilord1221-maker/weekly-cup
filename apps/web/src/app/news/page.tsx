'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface NewsItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  createdAt: string;
}

export default function NewsPage() {
  const { data: news, isLoading } = useQuery<NewsItem[]>({
    queryKey: ['news'],
    queryFn: () => api.get('/news', { auth: false }),
  });

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-3xl mx-auto" style={{ background: 'var(--bg)' }}>
      <h1 className="font-display font-bold uppercase mb-10" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
        Новости
      </h1>

      {isLoading && <p style={{ color: 'var(--muted)' }}>Загрузка...</p>}

      <div className="flex flex-col gap-4">
        {news?.map((item) => (
          <Link
            key={item.id}
            href={`/news/${item.slug}`}
            className="block rounded-2xl p-6 transition-transform hover:-translate-y-0.5"
            style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            <div className="font-mono text-[11px] mb-2" style={{ color: 'var(--muted)' }}>
              {new Date(item.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
            <h2 className="font-display font-semibold uppercase mb-2" style={{ fontSize: '20px', letterSpacing: '0.02em' }}>
              {item.title}
            </h2>
            {item.excerpt && (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                {item.excerpt}
              </p>
            )}
          </Link>
        ))}
      </div>

      {!isLoading && (!news || news.length === 0) && <p style={{ color: 'var(--muted)' }}>Новостей пока нет.</p>}
    </div>
  );
}
