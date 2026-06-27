'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore, isAdminOrOwner } from '@/store/auth';
import { ColoredUsername, getUsernameStyle, getGradientClass, isGradientEffect, type CosmeticItem } from '@/components/ColoredUsername';
import { TokenIcon } from '@/components/TokenIcon';
import { ImageUploadField } from '@/components/ImageUploadField';
import Link from 'next/link';

interface MyShop {
  tokenBalance: number;
  activeUsernameEffect: string | null;
  activeFrameEffect: string | null;
  profileBgStatus: string | null;
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
  const canGrant = isAdminOrOwner(user?.role);
  const isOwner = user?.role === 'OWNER';
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [priceSaving, setPriceSaving] = useState(false);
  const [priceSuccess, setPriceSuccess] = useState(false);

  const [buying, setBuying] = useState<string | null>(null);
  const [buyErr, setBuyErr] = useState<string | null>(null);

  // Выдача токенов (Admin/Owner)
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantSearch, setGrantSearch] = useState('');
  const [grantAmount, setGrantAmount] = useState('');
  const [grantUserId, setGrantUserId] = useState('');
  const [grantUsername, setGrantUsername] = useState('');
  const [grantErr, setGrantErr] = useState<string | null>(null);
  const [grantSuccess, setGrantSuccess] = useState<string | null>(null);
  const [grantLoading, setGrantLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<{ id: string; username: string; tokenBalance: number }[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!grantSearch.trim()) return;
    setSearching(true);
    try {
      const users = await api.get<{ id: string; username: string; tokenBalance: number }[]>(`/users?q=${encodeURIComponent(grantSearch)}`);
      setSearchResults(users.slice(0, 5));
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  };

  const openPriceModal = () => {
    const initial: Record<string, string> = {};
    catalog?.forEach((item) => { initial[item.key] = String(item.price); });
    setPrices(initial); setPriceSuccess(false); setShowPriceModal(true);
  };

  const handleSavePrices = async () => {
    setPriceSaving(true); setPriceSuccess(false);
    try {
      const body: Record<string, number> = {};
      Object.entries(prices).forEach(([k, v]) => { if (v) body[k] = Number(v); });
      await api.patch('/shop/prices', body);
      qc.invalidateQueries({ queryKey: ['shop-catalog'] });
      setPriceSuccess(true);
      setTimeout(() => setShowPriceModal(false), 1000);
    } catch { /* ignore */ }
    finally { setPriceSaving(false); }
  };

  const handleGrant = async () => {
    if (!grantUserId || !grantAmount) return;
    setGrantErr(null); setGrantSuccess(null); setGrantLoading(true);
    try {
      await api.post('/shop/grant', { userId: grantUserId, amount: Number(grantAmount) });
      setGrantSuccess(`Выдано ${grantAmount} токенов игроку ${grantUsername}`);
      setGrantAmount(''); setGrantSearch(''); setGrantUserId(''); setGrantUsername(''); setSearchResults([]);
    } catch (e) {
      setGrantErr(e instanceof ApiClientError ? e.message : 'Ошибка');
    } finally { setGrantLoading(false); }
  };
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

  const handleActivate = async (key: string | null, type?: string) => {
    setActivating(key ?? 'none');
    try {
      await api.patch('/shop/active-effect', { cosmeticKey: key, type });
      await refetchMy();
      qc.invalidateQueries({ queryKey: ['profile'] });
    } catch { /* ignore */ }
    finally { setActivating(null); }
  };

  const colors = catalog?.filter((c) => c.type === 'username' && c.color) ?? [];
  const gradients = catalog?.filter((c) => c.type === 'username' && c.gradient) ?? [];
  const frames = catalog?.filter((c) => c.type === 'frame') ?? [];
  const profileBgItem = catalog?.find((c) => c.key === 'PROFILE_BG');

  // Состояние покупки фона прямо из магазина
  const [bgUploadUrl, setBgUploadUrl] = useState('');
  const [bgBuying, setBgBuying] = useState(false);
  const [bgBuyErr, setBgBuyErr] = useState<string | null>(null);
  const [bgBuyOk, setBgBuyOk] = useState(false);

  const handleBuyBg = async () => {
    if (!bgUploadUrl) { setBgBuyErr('Загрузите изображение'); return; }
    setBgBuyErr(null); setBgBuying(true); setBgBuyOk(false);
    try {
      await api.post('/shop/buy-profile-bg', { imageUrl: bgUploadUrl });
      setBgBuyOk(true); setBgUploadUrl('');
      refetchMy();
    } catch (e) { setBgBuyErr(e instanceof ApiClientError ? e.message : 'Ошибка'); }
    finally { setBgBuying(false); }
  };

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

        <div className="flex gap-2 flex-wrap">
          {isOwner && (
            <button
              onClick={openPriceModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: 'rgba(79,127,255,.08)', border: '1px solid rgba(79,127,255,.2)', color: 'var(--a)' }}
            >
              ✏️ Цены
            </button>
          )}
          {canGrant && (
            <button
              onClick={() => { setShowGrantModal(true); setGrantErr(null); setGrantSuccess(null); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: 'rgba(201,149,74,.1)', border: '1px solid rgba(201,149,74,.3)', color: 'var(--gold)' }}
            >
              <TokenIcon size={18} />
              Выдать токены
            </button>
          )}
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
                  <span className={`font-display font-bold text-base ${getGradientClass(item.key)}`} style={getUsernameStyle(item.key)}>{user?.username ?? 'PlayerName'}</span>
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

      {/* ФОН ПРОФИЛЯ */}
      {profileBgItem && (
        <div className="mt-10 rounded-2xl p-6" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
            <div>
              <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-1" style={{ color: 'var(--muted)' }}>
                Фон профиля 🖼️
              </h2>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Загрузи своё изображение — оно появится на твоём профиле после модерации
              </p>
            </div>
            <span className="font-mono text-sm flex items-center gap-1.5" style={{ color: 'var(--gold)' }}>
              <TokenIcon size={16} /> {profileBgItem.price} токенов
            </span>
          </div>

          {myShop?.profileBgStatus === 'PENDING' ? (
            <div className="text-sm rounded-xl px-4 py-3" style={{ background: 'rgba(201,149,74,.06)', border: '1px solid rgba(201,149,74,.2)', color: 'var(--gold)' }}>
              ⏳ Фон на модерации — появится после одобрения
            </div>
          ) : user ? (
            <>
              {bgBuyErr && <div className="text-sm rounded-xl px-4 py-3 mb-3" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171' }}>{bgBuyErr}</div>}
              {bgBuyOk && <div className="text-sm rounded-xl px-4 py-3 mb-3" style={{ background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)', color: 'var(--green)' }}>✓ Отправлено на модерацию!</div>}
              <ImageUploadField label="Изображение для фона" value={bgUploadUrl} onChange={setBgUploadUrl} folder="media-thumbs" />
              <button
                onClick={handleBuyBg}
                disabled={bgBuying || !bgUploadUrl || (myShop?.tokenBalance ?? 0) < profileBgItem.price}
                className="btn-main justify-center mt-3"
                style={{ opacity: (myShop?.tokenBalance ?? 0) < profileBgItem.price ? 0.5 : 1 }}
              >
                {bgBuying ? 'Отправляем...' : `Купить и отправить на модерацию`}
              </button>
              {(myShop?.tokenBalance ?? 0) < profileBgItem.price && (
                <p className="text-xs text-center mt-2" style={{ color: 'var(--muted)' }}>
                  Нужно ещё {profileBgItem.price - (myShop?.tokenBalance ?? 0)} токенов
                </p>
              )}
            </>
          ) : (
            <Link href="/login" className="btn-out">Войти чтобы купить</Link>
          )}
        </div>
      )}

      {/* PRICE MODAL (Owner only) */}
      {showPriceModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,.75)' }} onClick={() => setShowPriceModal(false)}>
          <div className="card max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
              ✏️ Управление ценами
            </h2>
            {priceSuccess && <div className="text-sm rounded-lg px-3 py-2 mb-3" style={{ background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)', color: 'var(--green)' }}>Сохранено ✓</div>}
            <div className="flex flex-col gap-2 mb-4">
              {catalog?.map((item) => (
                <div key={item.key} className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="flex-1 text-sm">{item.name}</div>
                  <div className="flex items-center gap-1.5">
                    <TokenIcon size={14} />
                    <input
                      type="number"
                      value={prices[item.key] ?? item.price}
                      onChange={(e) => setPrices((p) => ({ ...p, [item.key]: e.target.value }))}
                      className="input-field text-right font-mono"
                      style={{ width: '90px', padding: '6px 10px', fontSize: '13px' }}
                      min={0}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowPriceModal(false)} className="btn-out flex-1" style={{ padding: '10px', fontSize: '13px' }}>Отмена</button>
              <button onClick={handleSavePrices} disabled={priceSaving} className="btn-main flex-1" style={{ padding: '10px', fontSize: '13px' }}>
                {priceSaving ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* РАМКИ АВАТАРА */}
      {frames.length > 0 && (
        <div className="mt-10">
          <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
            Рамки аватара
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {frames.map((item) => {
              const owned = ownedKeys.has(item.key);
              const isActive = myShop?.activeFrameEffect === item.key;
              return (
                <div key={item.key} className="flex flex-col gap-3 p-4 rounded-2xl" style={{ border: isActive ? '1px solid rgba(139,92,246,.4)' : '1px solid var(--border)', background: 'var(--surface)' }}>
                  {/* Превью — mix-blend-mode: screen убирает чёрный фон PNG */}
                  <div className="flex justify-center py-2">
                    <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
                      <div className="rounded-full" style={{ width: 56, height: 56, background: 'linear-gradient(135deg,var(--a),var(--a2))' }} />
                      {item.frameUrl && (
                        <img
                          src={item.frameUrl}
                          alt=""
                          style={{ position: 'absolute', width: 140, height: 140, top: -30, left: -30, pointerEvents: 'none', mixBlendMode: 'screen' }}
                        />
                      )}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-center">{item.name}</div>
                  <div className="text-xs text-center" style={{ color: 'var(--muted)' }}>{item.description}</div>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="font-mono text-xs flex items-center gap-1.5" style={{ color: 'var(--gold)' }}>
                      <TokenIcon size={14} /> {item.price}
                    </span>
                    {!user ? null : owned ? (
                      <button
                        onClick={() => handleActivate(isActive ? null : item.key, 'frame')}
                        disabled={!!activating}
                        className="text-xs font-medium px-2.5 py-1.5 rounded-lg"
                        style={{ color: isActive ? 'var(--muted)' : 'var(--green)', background: isActive ? 'rgba(255,255,255,.04)' : 'rgba(34,197,94,.06)', border: `1px solid ${isActive ? 'var(--border2)' : 'rgba(34,197,94,.2)'}` }}
                      >
                        {isActive ? 'Снять' : 'Надеть'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBuy(item.key)}
                        disabled={buying === item.key || (myShop?.tokenBalance ?? 0) < item.price}
                        className="text-xs font-medium px-2.5 py-1.5 rounded-lg"
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
      )}

      {/* GRANT MODAL */}
      {showGrantModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,.75)' }} onClick={() => setShowGrantModal(false)}>
          <div className="card max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <TokenIcon size={22} />
              <h2 className="font-display font-semibold uppercase text-sm tracking-wider" style={{ color: 'var(--gold)' }}>
                Выдать токены игроку
              </h2>
            </div>

            {grantErr && <div className="text-sm rounded-lg px-3 py-2 mb-3" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171' }}>{grantErr}</div>}
            {grantSuccess && <div className="text-sm rounded-lg px-3 py-2 mb-3" style={{ background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)', color: 'var(--green)' }}>✓ {grantSuccess}</div>}

            {/* Поиск игрока */}
            <label className="label-field">Найти игрока</label>
            <div className="flex gap-2 mb-2">
              <input
                value={grantSearch}
                onChange={(e) => setGrantSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Ник или Static ID..."
                className="input-field flex-1"
                autoFocus
              />
              <button onClick={handleSearch} disabled={searching} className="btn-out flex-shrink-0" style={{ padding: '10px 14px', fontSize: '13px' }}>
                {searching ? '...' : '🔍'}
              </button>
            </div>

            {/* Результаты поиска */}
            {searchResults.length > 0 && (
              <div className="flex flex-col gap-1 mb-3 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border2)' }}>
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => { setGrantUserId(u.id); setGrantUsername(u.username); setSearchResults([]); setGrantSearch(u.username); }}
                    className="flex items-center justify-between px-3 py-2 text-sm text-left transition-colors hover:bg-white/[0.03]"
                    style={{ background: grantUserId === u.id ? 'rgba(201,149,74,.08)' : 'transparent', borderBottom: '1px solid var(--border)' }}
                  >
                    <span style={{ color: grantUserId === u.id ? 'var(--gold)' : 'var(--text)' }}>{u.username}</span>
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--gold)' }}>
                      <TokenIcon size={12} /> {u.tokenBalance ?? 0}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {grantUserId && (
              <div className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(201,149,74,.06)', border: '1px solid rgba(201,149,74,.2)', color: 'var(--gold)' }}>
                Выбран: <strong>{grantUsername}</strong>
              </div>
            )}

            {/* Количество */}
            <label className="label-field">Количество токенов</label>
            <input
              value={grantAmount}
              onChange={(e) => setGrantAmount(e.target.value.replace(/\D/g, ''))}
              placeholder="например: 100"
              inputMode="numeric"
              className="input-field mb-2"
            />
            <div className="flex gap-1.5 mb-4 flex-wrap">
              {[50, 100, 200, 500, 1000].map((n) => (
                <button key={n} onClick={() => setGrantAmount(String(n))} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: 'var(--gold)', background: 'rgba(201,149,74,.08)', border: '1px solid rgba(201,149,74,.2)' }}>
                  +{n}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowGrantModal(false)} className="btn-out flex-1" style={{ padding: '10px', fontSize: '13px' }}>Закрыть</button>
              <button
                onClick={handleGrant}
                disabled={!grantUserId || !grantAmount || grantLoading}
                className="btn-main flex-1"
                style={{ padding: '10px', fontSize: '13px' }}
              >
                {grantLoading ? 'Выдаём...' : 'Выдать'}
              </button>
            </div>
          </div>
        </div>
      )}

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
