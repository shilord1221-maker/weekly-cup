'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore, isOrganizerOrAbove } from '@/store/auth';

interface GfcMap { key: string; name: string; imageUrl: string; }

export default function CreateGfcPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [team1Name, setTeam1Name] = useState('Team 1');
  const [team2Name, setTeam2Name] = useState('Team 2');
  const [password, setPassword] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [selectedMaps, setSelectedMaps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: maps } = useQuery<GfcMap[]>({
    queryKey: ['gfc-maps'],
    queryFn: () => api.get('/gfc/maps', { auth: false }),
  });

  if (!user || !isOrganizerOrAbove(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <p style={{ color: 'var(--muted)' }}>Доступно только организаторам.</p>
      </div>
    );
  }

  const toggleMap = (key: string) => {
    setSelectedMaps((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (selectedMaps.length < 3) { setError('Выберите минимум 3 карты для пула'); return; }
    setLoading(true);
    try {
      const lobby = await api.post<{ id: string }>('/gfc', {
        team1Name: team1Name.trim(),
        team2Name: team2Name.trim(),
        mapPool: selectedMaps,
        password: (!isOpen && password.trim()) ? password.trim() : undefined,
      });
      router.push(`/gfc/${lobby.id}`);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Ошибка создания лобби');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-20" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-lg">
        <div className="mb-8">
          <Link href="/gfc" className="text-sm" style={{ color: 'var(--muted)' }}>← GFC Лобби</Link>
          <h1 className="font-display font-bold uppercase mt-3" style={{ fontSize: 'clamp(24px,4vw,36px)', letterSpacing: '-0.01em' }}>
            Создать GFC Лобби
          </h1>
        </div>

        <form onSubmit={handleCreate} className="card flex flex-col gap-5">
          {error && <div className="text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>{error}</div>}

          {/* Названия команд */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">⚔️ Команда 1 (атака 1-2)</label>
              <input value={team1Name} onChange={(e) => setTeam1Name(e.target.value)} className="input-field" maxLength={64} />
            </div>
            <div>
              <label className="label-field">🛡️ Команда 2</label>
              <input value={team2Name} onChange={(e) => setTeam2Name(e.target.value)} className="input-field" maxLength={64} />
            </div>
          </div>

          {/* Тип лобби */}
          <div>
            <label className="label-field">Тип лобби</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setIsOpen(true)} className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all" style={{ border: `1px solid ${isOpen ? 'rgba(79,127,255,.4)' : 'var(--border2)'}`, background: isOpen ? 'rgba(79,127,255,.08)' : 'transparent', color: isOpen ? 'var(--a)' : 'var(--muted)' }}>
                🔓 Открытое
              </button>
              <button type="button" onClick={() => setIsOpen(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all" style={{ border: `1px solid ${!isOpen ? 'rgba(79,127,255,.4)' : 'var(--border2)'}`, background: !isOpen ? 'rgba(79,127,255,.08)' : 'transparent', color: !isOpen ? 'var(--a)' : 'var(--muted)' }}>
                🔒 С паролем
              </button>
            </div>
            {!isOpen && (
              <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Введите пароль" className="input-field mt-2" maxLength={64} />
            )}
          </div>

          {/* Пул карт */}
          <div>
            <label className="label-field">Пул карт (мин. 3, макс. 6) — {selectedMaps.length} выбрано</label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {maps?.map((m) => {
                const selected = selectedMaps.includes(m.key);
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => toggleMap(m.key)}
                    className="relative rounded-xl overflow-hidden transition-all text-left"
                    style={{ border: `2px solid ${selected ? 'var(--a)' : 'var(--border)'}`, opacity: !selected && selectedMaps.length >= 6 ? 0.4 : 1 }}
                  >
                    <div className="aspect-video bg-black">
                      <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover opacity-80" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                    <div className="flex items-center justify-between px-3 py-2" style={{ background: selected ? 'rgba(79,127,255,.12)' : 'var(--surface)' }}>
                      <span className="text-sm font-medium">{m.name}</span>
                      {selected && <span className="font-mono text-[10px]" style={{ color: 'var(--a)' }}>✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
              Бан-пик: каждая команда банит 2 карты. Из оставшихся играется матч.
            </p>
          </div>

          <button type="submit" disabled={loading} className="btn-main justify-center">
            {loading ? 'Создаём...' : 'Создать лобби'}
          </button>
        </form>
      </div>
    </div>
  );
}
