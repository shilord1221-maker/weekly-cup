'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore, isAdminOrOwner } from '@/store/auth';
import { ColoredUsername, getUsernameStyle, getGradientClass, isGradientEffect, type CosmeticItem } from '@/components/ColoredUsername';
import { TokenIcon } from '@/components/TokenIcon';
import { ImageUploadField } from '@/components/ImageUploadField';
import { Avatar } from '@/components/Avatar';
import { BgPositionPicker } from '@/components/BgPositionPicker';
import Link from 'next/link';

interface MyShop {
  tokenBalance: number;
  activeUsernameEffect: string | null;
  activeFrameEffect: string | null;
  profileBgStatus: string | null;
  cosmetics: { cosmeticKey: string; purchasedAt: string }[];
}

export default function ShopPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const canGrant = isAdminOrOwner(user?.role);
  const isOwner = user?.role === 'OWNER';

  const [category, setCategory] = useState<'color' | 'gradient' | 'frame' | 'bg' | 'buy'>('gradient');
  const [buyingPkg, setBuyingPkg] = useState<string | null>(null);
  const [pkgErr, setPkgErr] = useState<string | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [buyErr, setBuyErr] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);

  // Grant modal
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

  // Price modal
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [priceSaving, setPriceSaving] = useState(false);

  // BG
  const [bgUploadUrl, setBgUploadUrl] = useState('');
  const [bgPosition, setBgPosition] = useState('50% 30%');
  const [bgBuying, setBgBuying] = useState(false);
  const [bgBuyErr, setBgBuyErr] = useState<string | null>(null);
  const [bgBuyOk, setBgBuyOk] = useState(false);

  const { data: catalog } = useQuery<CosmeticItem[]>({
    queryKey: ['shop-catalog'],
    queryFn: () => api.get('/shop/catalog', { auth: false }),
  });

  const { data: myShop, refetch: refetchMy } = useQuery<MyShop>({
    queryKey: ['shop-my'],
    queryFn: () => api.get('/shop/my'),
    enabled: !!user,
  });

  const profileBgItem = catalog?.find((c) => c.key === 'PROFILE_BG');
  const colors = catalog?.filter((c) => c.type === 'username' && c.color) ?? [];
  const gradients = catalog?.filter((c) => c.type === 'username' && c.gradient) ?? [];
  const frames = catalog?.filter((c) => c.type === 'frame') ?? [];
  const ownedKeys = new Set(myShop?.cosmetics.map((c) => c.cosmeticKey) ?? []);

  const handleBuy = async (key: string) => {
    setBuyErr(null); setBuying(key);
    try {
      await api.post('/shop/buy', { cosmeticKey: key });
      await refetchMy(); qc.invalidateQueries({ queryKey: ['profile'] });
    } catch (e) { setBuyErr(e instanceof ApiClientError ? e.message : 'Ошибка покупки'); }
    finally { setBuying(null); }
  };

  const handleActivate = async (key: string | null, type?: string) => {
    setActivating(key ?? 'none');
    try {
      await api.patch('/shop/active-effect', { cosmeticKey: key, type });
      await refetchMy(); qc.invalidateQueries({ queryKey: ['profile'] });
    } catch { }
    finally { setActivating(null); }
  };

  const handleSearch = async () => {
    if (!grantSearch.trim()) return;
    setSearching(true);
    try { const users = await api.get<{ id: string; username: string; tokenBalance: number }[]>(`/users?q=${encodeURIComponent(grantSearch)}`); setSearchResults(users.slice(0, 5)); }
    catch { setSearchResults([]); } finally { setSearching(false); }
  };

  const handleGrant = async () => {
    if (!grantUserId || !grantAmount) return;
    setGrantErr(null); setGrantSuccess(null); setGrantLoading(true);
    try { await api.post('/shop/grant', { userId: grantUserId, amount: Number(grantAmount) }); setGrantSuccess(`Выдано ${grantAmount} токенов: ${grantUsername}`); setGrantAmount(''); setGrantSearch(''); setGrantUserId(''); setGrantUsername(''); setSearchResults([]); }
    catch (e) { setGrantErr(e instanceof ApiClientError ? e.message : 'Ошибка'); } finally { setGrantLoading(false); }
  };

  const openPriceModal = () => { const init: Record<string, string> = {}; catalog?.forEach((i) => { init[i.key] = String(i.price); }); setPrices(init); setShowPriceModal(true); };

  const handleSavePrices = async () => {
    setPriceSaving(true);
    try { const body: Record<string, number> = {}; Object.entries(prices).forEach(([k, v]) => { if (v) body[k] = Number(v); }); await api.patch('/shop/prices', body); qc.invalidateQueries({ queryKey: ['shop-catalog'] }); setShowPriceModal(false); }
    catch { } finally { setPriceSaving(false); }
  };

  const handleBuyPackage = async (pkgId: string) => {
    setPkgErr(null); setBuyingPkg(pkgId);
    try {
      const res = await api.post<{ paymentUrl: string }>('/payments/create', { packageId: pkgId });
      window.location.href = res.paymentUrl;
    } catch (e) { setPkgErr(e instanceof ApiClientError ? e.message : 'Ошибка'); setBuyingPkg(null); }
  };

  const handleBuyBg = async () => {
    if (!bgUploadUrl) { setBgBuyErr('Загрузите изображение'); return; }
    setBgBuyErr(null); setBgBuying(true); setBgBuyOk(false);
    try { await api.post('/shop/buy-profile-bg', { imageUrl: bgUploadUrl, position: bgPosition }); setBgBuyOk(true); setBgUploadUrl(''); refetchMy(); }
    catch (e) { setBgBuyErr(e instanceof ApiClientError ? e.message : 'Ошибка'); } finally { setBgBuying(false); }
  };

  const balance = myShop?.tokenBalance ?? 0;

  const CATEGORIES = [
    { key: 'gradient', label: '✨ Градиенты', count: gradients.length },
    { key: 'color', label: '🎨 Цвет', count: colors.length },
    { key: 'frame', label: '🪽 Рамки', count: frames.length },
    { key: 'bg', label: '🖼️ Фон', count: 1 },
    { key: 'buy', label: '💳 Купить токены', count: null },
  ] as const;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* HERO HEADER */}
      <div className="relative overflow-hidden" style={{ paddingTop: '120px', paddingBottom: '60px' }}>
        {/* Фоновые градиенты */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(139,92,246,.12) 0%, transparent 70%)', filter: 'blur(60px)' }} />
          <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(201,149,74,.08) 0%, transparent 70%)', filter: 'blur(60px)' }} />
          <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(79,127,255,.02) 1px, transparent 1px), linear-gradient(90deg, rgba(79,127,255,.02) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 md:px-10">
          <div className="flex items-end justify-between flex-wrap gap-6">
            <div>
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--gold)' }}>
                <TokenIcon size={16} /> Weekly Pracs Token
              </div>
              <h1 className="font-display font-bold uppercase" style={{ fontSize: 'clamp(36px,6vw,64px)', letterSpacing: '-0.02em', lineHeight: 0.9 }}>
                Магазин
              </h1>
              <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>Трать токены на уникальные эффекты для ника и профиля</p>
            </div>

            {/* Баланс */}
            <div className="flex flex-col gap-2 items-end">
              {user ? (
                <>
                  <div className="flex items-center gap-3 px-6 py-4 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(201,149,74,.12), rgba(201,149,74,.06))', border: '1px solid rgba(201,149,74,.3)', boxShadow: '0 0 30px rgba(201,149,74,.08)' }}>
                    <TokenIcon size={28} />
                    <div>
                      <div className="font-display font-bold" style={{ fontSize: '28px', color: 'var(--gold)', lineHeight: 1 }}>{balance.toLocaleString('ru-RU')}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'rgba(201,149,74,.6)' }}>токенов</div>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>+50 за победу в матче</div>
                </>
              ) : (
                <Link href="/login" className="btn-main">Войти чтобы покупать</Link>
              )}
              <div className="flex gap-2">
                {isOwner && <button onClick={openPriceModal} className="text-xs px-3 py-2 rounded-lg" style={{ color: 'var(--a)', background: 'rgba(79,127,255,.08)', border: '1px solid rgba(79,127,255,.2)' }}>✏️ Цены</button>}
                {canGrant && <button onClick={() => { setShowGrantModal(true); setGrantErr(null); setGrantSuccess(null); }} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg" style={{ color: 'var(--gold)', background: 'rgba(201,149,74,.08)', border: '1px solid rgba(201,149,74,.25)' }}><TokenIcon size={14} /> Выдать</button>}
              </div>
            </div>
          </div>

          {/* Активный эффект */}
          {user && myShop && (myShop.activeUsernameEffect || myShop.activeFrameEffect) && (
            <div className="mt-8 flex items-center gap-4 px-5 py-4 rounded-2xl" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border2)' }}>
              <Avatar username={user.username} avatarUrl={null} size={44} frameKey={myShop.activeFrameEffect} />
              <div>
                <div className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>Активный вид</div>
                <div className="font-display font-bold text-xl">
                  <ColoredUsername username={user.username} effectKey={myShop.activeUsernameEffect} />
                </div>
              </div>
              {myShop.activeUsernameEffect && (
                <button onClick={() => handleActivate(null, 'username')} disabled={!!activating} className="ml-auto text-xs px-3 py-1.5 rounded-lg" style={{ color: 'var(--muted)', background: 'rgba(255,255,255,.04)', border: '1px solid var(--border2)' }}>Убрать эффект ника</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* КАТЕГОРИИ */}
      <div className="max-w-5xl mx-auto px-6 md:px-10 mb-8">
        <div className="flex gap-2 p-1 rounded-2xl w-fit" style={{ background: 'var(--surface)', border: '1px solid var(--border2)' }}>
          {CATEGORIES.map(({ key, label, count }) => (
            <button key={key} onClick={() => setCategory(key)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ color: category === key ? '#0a0d16' : 'var(--muted)', background: category === key ? '#fff' : 'transparent' }}>
              {label}
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: category === key ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.06)', color: category === key ? '#0a0d16' : 'var(--muted)' }}>
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {buyErr && (
        <div className="max-w-5xl mx-auto px-6 md:px-10 mb-4">
          <div className="text-sm rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171' }}>{buyErr}</div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 md:px-10 pb-20">

        {/* ГРАДИЕНТНЫЕ НИКИ */}
        {category === 'gradient' && (
          <div>
            <p className="text-xs font-mono uppercase tracking-wider mb-6" style={{ color: 'var(--muted)' }}>Анимированные переливающиеся градиенты — самые эффектные</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {gradients.map((item) => {
                const owned = ownedKeys.has(item.key);
                const isActive = myShop?.activeUsernameEffect === item.key;
                const gradClass = getGradientClass(item.key);
                const canAfford = (myShop?.tokenBalance ?? 0) >= item.price;
                return (
                  <div key={item.key} className="group relative rounded-2xl overflow-hidden transition-all hover:-translate-y-1 hover:shadow-2xl"
                    style={{ border: `1px solid ${isActive ? 'rgba(255,255,255,.2)' : 'var(--border)'}`, background: isActive ? 'rgba(255,255,255,.04)' : 'var(--surface)', boxShadow: isActive ? '0 0 20px rgba(255,255,255,.06)' : 'none' }}>
                    {/* Превью с градиентом */}
                    <div className="relative h-20 flex items-center justify-center overflow-hidden" style={{ background: 'rgba(0,0,0,.3)' }}>
                      <div className="absolute inset-0" style={{ background: item.gradient, opacity: 0.15 }} />
                      <span className={`font-display font-bold text-2xl ${gradClass}`} style={getUsernameStyle(item.key)}>
                        {user?.username ?? 'PlayerName'}
                      </span>
                      {isActive && <span className="absolute top-2 right-2 text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }}>АКТИВЕН</span>}
                    </div>
                    {/* Полоска градиента */}
                    <div className="h-0.5 w-full" style={{ background: item.gradient }} />
                    {/* Инфо */}
                    <div className="p-4">
                      <div className="font-medium text-sm mb-3">{item.name}</div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-mono text-xs" style={{ color: 'var(--gold)' }}>
                          <TokenIcon size={13} /> {item.price.toLocaleString('ru-RU')}
                        </div>
                        {!user ? null : owned ? (
                          <button onClick={() => handleActivate(isActive ? null : item.key, 'username')} disabled={!!activating} className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
                            style={{ color: isActive ? 'var(--muted)' : 'var(--green)', background: isActive ? 'rgba(255,255,255,.04)' : 'rgba(34,197,94,.08)', border: `1px solid ${isActive ? 'var(--border2)' : 'rgba(34,197,94,.2)'}` }}>
                            {isActive ? 'Снять' : 'Надеть'}
                          </button>
                        ) : (
                          <button onClick={() => handleBuy(item.key)} disabled={buying === item.key || !canAfford} className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
                            style={{ color: canAfford ? 'var(--a)' : 'var(--muted)', background: 'rgba(79,127,255,.08)', border: '1px solid rgba(79,127,255,.2)', opacity: canAfford ? 1 : 0.5 }}>
                            {buying === item.key ? '...' : 'Купить'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ЦВЕТНЫЕ НИКИ */}
        {category === 'color' && (
          <div>
            <p className="text-xs font-mono uppercase tracking-wider mb-6" style={{ color: 'var(--muted)' }}>Чистый цвет для ника — просто и элегантно</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {colors.map((item) => {
                const owned = ownedKeys.has(item.key);
                const isActive = myShop?.activeUsernameEffect === item.key;
                const canAfford = (myShop?.tokenBalance ?? 0) >= item.price;
                return (
                  <div key={item.key} className="group rounded-2xl overflow-hidden transition-all hover:-translate-y-1"
                    style={{ border: `1px solid ${isActive ? (item.color + '55') : 'var(--border)'}`, background: isActive ? `${item.color}08` : 'var(--surface)' }}>
                    <div className="h-16 flex items-center justify-center" style={{ background: `${item.color}10` }}>
                      <span className="font-display font-bold text-xl" style={{ color: item.color }}>{user?.username ?? 'PlayerName'}</span>
                    </div>
                    <div className="p-3">
                      <div className="text-xs font-medium mb-2">{item.name}</div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] flex items-center gap-1" style={{ color: 'var(--gold)' }}><TokenIcon size={11} />{item.price}</span>
                        {!user ? null : owned ? (
                          <button onClick={() => handleActivate(isActive ? null : item.key, 'username')} disabled={!!activating} className="text-[11px] font-medium px-2.5 py-1 rounded-lg"
                            style={{ color: isActive ? 'var(--muted)' : item.color, background: isActive ? 'rgba(255,255,255,.04)' : `${item.color}12`, border: `1px solid ${isActive ? 'var(--border2)' : item.color + '30'}` }}>
                            {isActive ? 'Снять' : 'Надеть'}
                          </button>
                        ) : (
                          <button onClick={() => handleBuy(item.key)} disabled={buying === item.key || !canAfford} className="text-[11px] font-medium px-2.5 py-1 rounded-lg"
                            style={{ color: 'var(--a)', background: 'rgba(79,127,255,.08)', border: '1px solid rgba(79,127,255,.2)', opacity: canAfford ? 1 : 0.5 }}>
                            {buying === item.key ? '...' : 'Купить'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* РАМКИ */}
        {category === 'frame' && (
          <div>
            <p className="text-xs font-mono uppercase tracking-wider mb-6" style={{ color: 'var(--muted)' }}>Декоративные рамки вокруг аватара</p>
            {frames.length === 0 ? (
              <div className="text-center py-20" style={{ color: 'var(--muted)' }}>Рамки появятся в ближайшее время</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {frames.map((item) => {
                  const owned = ownedKeys.has(item.key);
                  const isActive = myShop?.activeFrameEffect === item.key;
                  const canAfford = (myShop?.tokenBalance ?? 0) >= item.price;
                  return (
                    <div key={item.key} className="rounded-2xl overflow-hidden transition-all hover:-translate-y-1"
                      style={{ border: `1px solid ${isActive ? 'rgba(139,92,246,.4)' : 'var(--border)'}`, background: 'var(--surface)' }}>
                      <div className="flex justify-center py-8 relative" style={{ background: 'rgba(0,0,0,.2)' }}>
                        <Avatar username={user?.username ?? 'P'} avatarUrl={null} size={72} frameKey={item.frameUrl ? item.key : undefined} />
                        {isActive && <span className="absolute top-3 right-3 text-[9px] font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(139,92,246,.2)', color: '#c084fc' }}>АКТИВНА</span>}
                      </div>
                      <div className="p-4">
                        <div className="font-medium text-sm mb-1">{item.name}</div>
                        <div className="text-xs mb-3" style={{ color: 'var(--muted)' }}>{item.description}</div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs flex items-center gap-1.5" style={{ color: 'var(--gold)' }}><TokenIcon size={13} />{item.price.toLocaleString('ru-RU')}</span>
                          {!user ? null : owned ? (
                            <button onClick={() => handleActivate(isActive ? null : item.key, 'frame')} disabled={!!activating} className="text-xs font-medium px-3 py-1.5 rounded-lg"
                              style={{ color: isActive ? 'var(--muted)' : 'var(--green)', background: isActive ? 'rgba(255,255,255,.04)' : 'rgba(34,197,94,.08)', border: `1px solid ${isActive ? 'var(--border2)' : 'rgba(34,197,94,.2)'}` }}>
                              {isActive ? 'Снять' : 'Надеть'}
                            </button>
                          ) : (
                            <button onClick={() => handleBuy(item.key)} disabled={buying === item.key || !canAfford} className="text-xs font-medium px-3 py-1.5 rounded-lg"
                              style={{ color: 'var(--a)', background: 'rgba(79,127,255,.08)', border: '1px solid rgba(79,127,255,.2)', opacity: canAfford ? 1 : 0.5 }}>
                              {buying === item.key ? '...' : 'Купить'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* КУПИТЬ ТОКЕНЫ */}
        {category === 'buy' && (
          <div>
            <div className="mb-6 flex items-center gap-3 px-5 py-4 rounded-2xl" style={{ background: 'rgba(79,127,255,.04)', border: '1px solid rgba(79,127,255,.15)' }}>
              <span style={{ fontSize: '20px' }}>ℹ️</span>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Курс: <strong style={{ color: 'var(--text)' }}>2 токена = 1₽</strong> · Оплата через ЮКасса (карта, СБП, ЮМани)</p>
            </div>
            {pkgErr && <div className="text-sm rounded-xl px-4 py-3 mb-4" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171' }}>{pkgErr}</div>}

            {!process.env.NEXT_PUBLIC_PAYMENTS_ENABLED && (
              <div className="text-sm rounded-xl px-5 py-4 mb-6 flex items-center gap-3" style={{ background: 'rgba(201,149,74,.06)', border: '1px solid rgba(201,149,74,.2)', color: 'var(--gold)' }}>
                <span style={{ fontSize: '20px' }}>⚙️</span>
                <span>Платёжная система настраивается. Скоро будет доступна оплата токенов за рубли.</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { id: 'p100',  tokens: 100,  rubles: 50,   popular: false, bonus: '' },
                { id: 'p500',  tokens: 500,  rubles: 250,  popular: true,  bonus: '' },
                { id: 'p1000', tokens: 1000, rubles: 500,  popular: false, bonus: '+50 бонус' },
                { id: 'p2500', tokens: 2500, rubles: 1250, popular: false, bonus: '+200 бонус' },
                { id: 'p5000', tokens: 5000, rubles: 2500, popular: false, bonus: '+500 бонус' },
              ].map((pkg) => (
                <div key={pkg.id} className="relative rounded-2xl overflow-hidden transition-all hover:-translate-y-1"
                  style={{ border: pkg.popular ? '1px solid rgba(79,127,255,.4)' : '1px solid var(--border)', background: pkg.popular ? 'rgba(79,127,255,.06)' : 'var(--surface)', boxShadow: pkg.popular ? '0 0 20px rgba(79,127,255,.08)' : 'none' }}>
                  {pkg.popular && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg,var(--a),var(--a2))' }} />}
                  {pkg.popular && <div className="absolute top-3 right-3 font-mono text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'var(--a)', color: '#fff' }}>Популярный</div>}
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <TokenIcon size={24} />
                      <span className="font-display font-bold text-3xl" style={{ color: 'var(--gold)' }}>{pkg.tokens.toLocaleString('ru-RU')}</span>
                    </div>
                    {pkg.bonus && <div className="font-mono text-xs mb-3 px-2 py-1 rounded-lg w-fit" style={{ color: 'var(--green)', background: 'rgba(34,197,94,.08)' }}>{pkg.bonus}</div>}
                    <div className="font-display font-bold text-2xl mb-1">{pkg.rubles.toLocaleString('ru-RU')} ₽</div>
                    <div className="text-xs mb-4" style={{ color: 'var(--muted)' }}>{(pkg.rubles / pkg.tokens * 100).toFixed(1)}₽ за 100 токенов</div>
                    {user ? (
                      <button onClick={() => handleBuyPackage(pkg.id)} disabled={buyingPkg === pkg.id} className="btn-main justify-center w-full">
                        {buyingPkg === pkg.id ? 'Переходим...' : 'Купить'}
                      </button>
                    ) : (
                      <Link href="/login" className="btn-out justify-center w-full block text-center">Войти</Link>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl px-5 py-4 text-xs" style={{ background: 'rgba(255,255,255,.02)', border: '1px solid var(--border)' }}>
              <div className="font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Безопасность</div>
              <p style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
                Оплата проходит через <strong style={{ color: 'var(--text)' }}>ЮКасса</strong> — лицензированный платёжный сервис. Мы не храним данные карты. Токены зачисляются автоматически после подтверждения платежа.
              </p>
            </div>
          </div>
        )}

        {/* ФОН ПРОФИЛЯ */}
        {category === 'bg' && (
          <div className="max-w-lg">
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div className="h-32 relative" style={{ background: 'linear-gradient(135deg, rgba(79,127,255,.15), rgba(139,92,246,.1))' }}>
                <div className="absolute inset-0 flex items-end px-6 pb-5">
                  <div>
                    <div className="font-display font-bold text-2xl">🖼️ Фон профиля</div>
                    <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,.6)' }}>Виден всем кто заходит на твой профиль</div>
                  </div>
                  <div className="ml-auto flex items-center gap-2 font-mono text-lg font-bold" style={{ color: 'var(--gold)' }}>
                    <TokenIcon size={20} />{(profileBgItem?.price ?? 500).toLocaleString('ru-RU')}
                  </div>
                </div>
              </div>
              <div className="p-6">
                {myShop?.profileBgStatus === 'PENDING' ? (
                  <div className="text-sm rounded-xl px-4 py-3" style={{ background: 'rgba(201,149,74,.06)', border: '1px solid rgba(201,149,74,.2)', color: 'var(--gold)' }}>
                    ⏳ Фон на модерации — появится после одобрения
                  </div>
                ) : user ? (
                  <>
                    {bgBuyErr && <div className="text-sm rounded-xl px-4 py-3 mb-3" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171' }}>{bgBuyErr}</div>}
                    {bgBuyOk && <div className="text-sm rounded-xl px-4 py-3 mb-3" style={{ background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)', color: 'var(--green)' }}>✓ Отправлено на модерацию!</div>}
                    <ImageUploadField label="Загрузи изображение" value={bgUploadUrl} onChange={(url) => { setBgUploadUrl(url); setBgPosition('50% 30%'); }} folder="media-thumbs" />
                    {bgUploadUrl && <div className="mt-3"><BgPositionPicker imageUrl={bgUploadUrl} position={bgPosition} onChange={setBgPosition} /></div>}
                    <button onClick={handleBuyBg} disabled={bgBuying || !bgUploadUrl || (myShop?.tokenBalance ?? 0) < (profileBgItem?.price ?? 500)} className="btn-main justify-center w-full mt-4">
                      {bgBuying ? 'Отправляем...' : 'Купить и отправить на модерацию'}
                    </button>
                    {(myShop?.tokenBalance ?? 0) < (profileBgItem?.price ?? 500) && (
                      <p className="text-xs text-center mt-2" style={{ color: 'var(--muted)' }}>Нужно ещё {((profileBgItem?.price ?? 500) - (myShop?.tokenBalance ?? 0)).toLocaleString('ru-RU')} токенов</p>
                    )}
                  </>
                ) : <Link href="/login" className="btn-out">Войти чтобы купить</Link>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* GRANT MODAL */}
      {showGrantModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,.8)' }} onClick={() => setShowGrantModal(false)}>
          <div className="card max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4"><TokenIcon size={22} /><h2 className="font-display font-semibold uppercase text-sm tracking-wider" style={{ color: 'var(--gold)' }}>Выдать токены</h2></div>
            {grantErr && <div className="text-sm rounded-lg px-3 py-2 mb-3" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171' }}>{grantErr}</div>}
            {grantSuccess && <div className="text-sm rounded-lg px-3 py-2 mb-3" style={{ background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)', color: 'var(--green)' }}>✓ {grantSuccess}</div>}
            <div className="flex gap-2 mb-2">
              <input value={grantSearch} onChange={(e) => setGrantSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="Ник игрока..." className="input-field flex-1" autoFocus />
              <button onClick={handleSearch} disabled={searching} className="btn-out flex-shrink-0" style={{ padding: '10px 14px' }}>{searching ? '...' : '🔍'}</button>
            </div>
            {searchResults.length > 0 && (
              <div className="rounded-xl overflow-hidden mb-3" style={{ border: '1px solid var(--border2)' }}>
                {searchResults.map((u) => (
                  <button key={u.id} onClick={() => { setGrantUserId(u.id); setGrantUsername(u.username); setSearchResults([]); setGrantSearch(u.username); }} className="flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-white/[0.03] text-left" style={{ borderBottom: '1px solid var(--border)', color: grantUserId === u.id ? 'var(--gold)' : 'var(--text)' }}>
                    <span>{u.username}</span><span className="text-xs flex items-center gap-1" style={{ color: 'var(--gold)' }}><TokenIcon size={12} />{u.tokenBalance}</span>
                  </button>
                ))}
              </div>
            )}
            {grantUserId && <div className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(201,149,74,.06)', border: '1px solid rgba(201,149,74,.2)', color: 'var(--gold)' }}>Выбран: <strong>{grantUsername}</strong></div>}
            <label className="label-field">Количество</label>
            <input value={grantAmount} onChange={(e) => setGrantAmount(e.target.value.replace(/\D/g, ''))} placeholder="100" inputMode="numeric" className="input-field mb-2" />
            <div className="flex gap-1.5 mb-4 flex-wrap">{[50, 100, 200, 500, 1000].map((n) => (<button key={n} onClick={() => setGrantAmount(String(n))} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: 'var(--gold)', background: 'rgba(201,149,74,.08)', border: '1px solid rgba(201,149,74,.2)' }}>+{n}</button>))}</div>
            <div className="flex gap-2">
              <button onClick={() => setShowGrantModal(false)} className="btn-out flex-1" style={{ padding: '10px', fontSize: '13px' }}>Закрыть</button>
              <button onClick={handleGrant} disabled={!grantUserId || !grantAmount || grantLoading} className="btn-main flex-1" style={{ padding: '10px', fontSize: '13px' }}>{grantLoading ? 'Выдаём...' : 'Выдать'}</button>
            </div>
          </div>
        </div>
      )}

      {/* PRICE MODAL */}
      {showPriceModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,.8)' }} onClick={() => setShowPriceModal(false)}>
          <div className="card max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>Управление ценами</h2>
            <div className="flex flex-col gap-2 mb-4">
              {catalog?.map((item) => (
                <div key={item.key} className="flex items-center gap-3">
                  <span className="flex-1 text-sm truncate">{item.name}</span>
                  <input value={prices[item.key] ?? ''} onChange={(e) => setPrices((p) => ({ ...p, [item.key]: e.target.value.replace(/\D/g, '') }))} className="input-field w-24 text-right" style={{ padding: '6px 10px', fontSize: '13px' }} />
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>🪙</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowPriceModal(false)} className="btn-out flex-1" style={{ padding: '10px', fontSize: '13px' }}>Отмена</button>
              <button onClick={handleSavePrices} disabled={priceSaving} className="btn-main flex-1" style={{ padding: '10px', fontSize: '13px' }}>{priceSaving ? 'Сохраняем...' : 'Сохранить'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
