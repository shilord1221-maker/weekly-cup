'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { ColoredUsername, getUsernameStyle, type CosmeticItem } from '@/components/ColoredUsername';
import Link from 'next/link';

interface MyShop {
  tokenBalance: number;
  activeUsernameEffect: string | null;
  cosmetics: { cosmeticKey: string; purchasedAt: string }[];
}

function PreviewSwatch({ item }: { item: CosmeticItem }) {
  const style = getUsernameStyle(item.key);
  return (
    <span className="font-display font-bold text-lg" style={style}>
      PlayerName
    </span>
  );
}

export default function ShopPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [buying, setBuying] = useState<string | null>(null);
  const [buyErr, setBuyErr] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);

  const { data: catalog } = useQuery<CosmeticItem[]>({
    queryKey: ['shop-catalog'],
    queryFn: () => api.get('/shop/catalog', { auth: false }),
  });

  const { data: myShop, refetch: refetchMy } = useQuery<MyShop>({
    queryKey: ['shop-my'],
    queryFn: () => api.get('/shop/my'),
    enabled: !!user,
  });

  const ownedKeys = new Set(myShop?.cosmetics.map((c) => c.cosmeticKey) ?? []);

  const handleBuy = async (key: string) => {
    setBuyErr(null);
    setBuying(key);
    try {
      await api.post('/shop/buy', { cosmeticKey: key });
      await refetchMy();
      qc.invalidateQueries({ queryKey: ['profile'] });
    } catch (e) {
      setBuyErr(e instanceof ApiClientError ? e.message : 'Ошибка покупки');
    } finally {
      setBuying(null);
    }
  };

  const handleActivate = async (key: string | null) => {
    setActivating(key ?? 'none');
    try {
      await api.patch('/shop/active-effect', { cosmeticKey: key });
      await refetchMy();
      qc.invalidateQueries({ queryKey: ['profile'] });
    } catch { /* ignore */ }
    finally { setActivating(null); }
  };

  const colors = catalog?.filter((c) => c.color) ?? [];
  const gradients = catalog?.filter((c) => c.gradient) ?? [];

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-5xl mx-auto" style={{ background: 'var(--bg)' }}>

      {/* HEADER */}
      <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
        <div>
          <div className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--gold)' }}>
            <TokenIcon size={20} />
            Weekly Pracs Token
          </div>
          <h1 className="font-display font-bold uppercase" style={{ fontSize: 'clamp(28px,4vw,44px)', letterSpacing: '-0.01em' }}>
            Магазин
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Трать токены на эффекты для своего ника</p>
        </div>

        {user ? (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2 px-5 py-3 rounded-2xl" style={{ background: 'rgba(201,149,74,.08)', border: '1px solid rgba(201,149,74,.25)' }}>
              <TokenIcon size={28} />
              <span className="font-display font-bold text-2xl" style={{ color: 'var(--gold)' }}>
                {myShop?.tokenBalance ?? 0}
              </span>
              <span className="text-sm" style={{ color: 'var(--muted)' }}>токенов</span>
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>+50 токенов за каждую победу</p>
          </div>
        ) : (
          <Link href="/login" className="btn-main">Войти чтобы покупать</Link>
        )}
      </div>

      {/* АКТИВНЫЙ ЭФФЕКТ */}
      {user && myShop && (
        <div className="card mb-8">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="font-mono text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>Активный эффект ника</div>
              <div className="text-xl font-display font-bold">
                <ColoredUsername username={user.username} effectKey={myShop.activeUsernameEffect} />
              </div>
            </div>
            {myShop.activeUsernameEffect && (
              <button
                onClick={() => handleActivate(null)}
                disabled={activating === 'none'}
                className="text-xs font-medium px-3 py-2 rounded-lg"
                style={{ color: 'var(--muted)', background: 'rgba(255,255,255,.04)', border: '1px solid var(--border2)' }}
              >
                Убрать эффект
              </button>
            )}
          </div>
        </div>
      )}

      {buyErr && (
        <div className="mb-6 text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          {buyErr}
        </div>
      )}

      {/* ЦВЕТНЫЕ НИКИ */}
      <div className="mb-10">
        <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
          Цветные ники
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {colors.map((item) => {
            const owned = ownedKeys.has(item.key);
            const isActive = myShop?.activeUsernameEffect === item.key;
            return (
              <div
                key={item.key}
                className="flex flex-col gap-3 p-4 rounded-2xl"
                style={{
                  border: isActive ? `1px solid ${item.color}55` : '1px solid var(--border)',
                  background: isActive ? `${item.color}08` : 'var(--surface)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-base" style={{ color: item.color }}>{user?.username ?? 'PlayerName'}</span>
                  {isActive && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: item.color, background: `${item.color}18` }}>АКТИВЕН</span>}
                </div>
                <div className="text-xs font-medium" style={{ color: 'var(--text)' }}>{item.name}</div>
                <div className="flex items-center gap-2 mt-auto">
                  <span className="font-mono text-xs flex items-center gap-1.5" style={{ color: 'var(--gold)' }}>
                    <TokenIcon size={14} />
                    {item.price}
                  </span>
                  {!user ? null : owned ? (
                    <button
                      onClick={() => handleActivate(isActive ? null : item.key)}
                      disabled={!!activating}
                      className="ml-auto text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                      style={{ color: isActive ? 'var(--muted)' : 'var(--green)', background: isActive ? 'rgba(255,255,255,.04)' : 'rgba(34,197,94,.06)', border: `1px solid ${isActive ? 'var(--border2)' : 'rgba(34,197,94,.2)'}` }}
                    >
                      {isActive ? 'Снять' : 'Надеть'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleBuy(item.key)}
                      disabled={buying === item.key || (myShop?.tokenBalance ?? 0) < item.price}
                      className="ml-auto text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                      style={{ color: 'var(--a)', background: 'rgba(79,127,255,.06)', border: '1px solid rgba(79,127,255,.2)', opacity: (myShop?.tokenBalance ?? 0) < item.price ? 0.5 : 1 }}
                    >
                      {buying === item.key ? '...' : 'Купить'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ГРАДИЕНТНЫЕ НИКИ */}
      <div>
        <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
          Градиентные ники
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {gradients.map((item) => {
            const owned = ownedKeys.has(item.key);
            const isActive = myShop?.activeUsernameEffect === item.key;
            const previewStyle = getUsernameStyle(item.key);
            return (
              <div
                key={item.key}
                className="flex flex-col gap-3 p-4 rounded-2xl"
                style={{
                  border: isActive ? '1px solid rgba(255,255,255,.15)' : '1px solid var(--border)',
                  background: isActive ? 'rgba(255,255,255,.03)' : 'var(--surface)',
                }}
              >
                {/* Превью полосой */}
                <div className="h-2 rounded-full" style={{ background: item.gradient }} />
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-base" style={previewStyle}>{user?.username ?? 'PlayerName'}</span>
                  {isActive && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: 'rgba(255,255,255,.6)', background: 'rgba(255,255,255,.08)' }}>АКТИВЕН</span>}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium" style={{ color: 'var(--text)' }}>{item.name}</div>
                    <span className="font-mono text-xs flex items-center gap-1.5 mt-0.5" style={{ color: 'var(--gold)' }}><TokenIcon size={14} />{item.price}</span>
                  </div>
                  {!user ? null : owned ? (
                    <button
                      onClick={() => handleActivate(isActive ? null : item.key)}
                      disabled={!!activating}
                      className="text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                      style={{ color: isActive ? 'var(--muted)' : 'var(--green)', background: isActive ? 'rgba(255,255,255,.04)' : 'rgba(34,197,94,.06)', border: `1px solid ${isActive ? 'var(--border2)' : 'rgba(34,197,94,.2)'}` }}
                    >
                      {isActive ? 'Снять' : 'Надеть'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleBuy(item.key)}
                      disabled={buying === item.key || (myShop?.tokenBalance ?? 0) < item.price}
                      className="text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                      style={{ color: 'var(--a)', background: 'rgba(79,127,255,.06)', border: '1px solid rgba(79,127,255,.2)', opacity: (myShop?.tokenBalance ?? 0) < item.price ? 0.5 : 1 }}
                    >
                      {buying === item.key ? '...' : 'Купить'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* КАК ЗАРАБАТЫВАТЬ */}
      <div className="mt-12 rounded-2xl px-6 py-6" style={{ background: 'rgba(201,149,74,.05)', border: '1px solid rgba(201,149,74,.15)' }}>
        <h3 className="font-display font-semibold uppercase text-sm tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--gold)' }}>
          <TokenIcon size={16} />
          Как зарабатывать токены
        </h3>
        <div className="flex flex-col gap-2 text-sm" style={{ color: 'var(--muted)' }}>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ color: 'var(--gold)', background: 'rgba(201,149,74,.1)' }}>+50</span>
            <span>Победа в матче</span>
          </div>
        </div>
      </div>
    </div>
  );
}
