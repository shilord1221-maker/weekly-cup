'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface MapItem {
  id: string;
  name: string;
  imageUrl: string;
}

export default function MapsPage() {
  const { data: maps, isLoading } = useQuery<MapItem[]>({
    queryKey: ['maps'],
    queryFn: () => api.get('/maps', { auth: false }),
  });

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-5xl mx-auto" style={{ background: 'var(--bg)' }}>
      <h1 className="font-display font-bold uppercase mb-2" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
        Карты
      </h1>
      <p className="text-sm mb-10" style={{ color: 'var(--muted)' }}>
        Зоны на каждой карте связаны графом соседства — нажмите на карту, чтобы посмотреть зоны.
      </p>

      {isLoading && <p style={{ color: 'var(--muted)' }}>Загрузка...</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {maps?.map((map) => (
          <Link
            key={map.id}
            href={`/maps/${map.id}`}
            className="rounded-2xl overflow-hidden transition-transform hover:-translate-y-1"
            style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            <div className="aspect-square w-full" style={{ background: 'var(--surface2)' }}>
              <img src={map.imageUrl} alt={map.name} className="w-full h-full object-cover" />
            </div>
            <div className="p-4">
              <div className="font-display font-semibold uppercase" style={{ fontSize: '16px', letterSpacing: '0.04em' }}>
                {map.name}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {!isLoading && (!maps || maps.length === 0) && (
        <p style={{ color: 'var(--muted)' }}>Карты пока не загружены.</p>
      )}
    </div>
  );
}
