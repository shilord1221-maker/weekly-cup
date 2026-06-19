'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';

interface NewsArticle {
  id: string;
  title: string;
  body: string;
  coverUrl: string | null;
  createdAt: string;
}

export default function NewsArticlePage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: article, isLoading } = useQuery<NewsArticle>({
    queryKey: ['news', slug],
    queryFn: () => api.get(`/news/${slug}`, { auth: false }),
    enabled: !!slug,
  });

  if (isLoading || !article) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <p style={{ color: 'var(--muted)' }}>Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-2xl mx-auto" style={{ background: 'var(--bg)' }}>
      <Link href="/news" className="text-sm inline-block mb-6" style={{ color: 'var(--a)' }}>
        ← Все новости
      </Link>
      <div className="font-mono text-xs mb-4" style={{ color: 'var(--muted)' }}>
        {new Date(article.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}
      </div>
      <h1 className="font-display font-bold uppercase mb-8" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
        {article.title}
      </h1>
      <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>
        {article.body}
      </div>
    </div>
  );
}
