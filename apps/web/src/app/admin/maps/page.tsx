'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface MapItem {
  id: string;
  name: string;
  imageUrl: string;
  isActive: boolean;
}

export default function AdminMapsPage() {
  const { data: maps, isLoading } = useQuery<MapItem[]>({
    queryKey: ['admin-maps'],
    queryFn: () => api.get('/maps'),
  });

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-4xl mx-auto" style={{ background: 'var(--bg)' }}>
      <div className="flex items-center justify-between mb-10 flex-wrap gap-4">
        <h1 className="font-display font-bold uppercase" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
          Карты
        </h1>
        <Link href="/admin/maps/create" className="btn-main">
          + Добавить карту
        </Link>
      </div>

      {isLoading && <p style={{ color: 'var(--muted)' }}>Загрузка...</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {maps?.map((map) => (
          <div key={map.id} className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div className="aspect-square w-full" style={{ background: 'var(--surface2)' }}>
              <img src={map.imageUrl} alt={map.name} className="w-full h-full object-cover" />
            </div>
            <div className="p-4">
              <div className="font-display font-semibold uppercase mb-1" style={{ fontSize: '16px' }}>
                {map.name}
              </div>
              <span className="text-xs" style={{ color: map.isActive ? 'var(--green)' : 'var(--muted)' }}>
                {map.isActive ? 'Активна' : 'Скрыта'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {!isLoading && (!maps || maps.length === 0) && (
        <p style={{ color: 'var(--muted)' }}>
          Карты пока не загружены.{' '}
          <Link href="/admin/maps/create" style={{ color: 'var(--a)' }}>
            Добавить первую
          </Link>
        </p>
      )}
    </div>
  );
}
