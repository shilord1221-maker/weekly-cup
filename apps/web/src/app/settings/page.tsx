'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import Link from 'next/link';

interface Settings {
  mouseDpi?: number | null;
  sensitivity?: number | null;
  aimSensitivity?: number | null;
  zoomSensitivity?: number | null;
  cpu?: string | null;
  gpu?: string | null;
  ram?: number | null;
  monitor?: string | null;
  mouse?: string | null;
  mousepad?: string | null;
  headset?: string | null;
  keyboard?: string | null;
  fov?: number | null;
  resolution?: string | null;
  graphicsPreset?: string | null;
  fps?: number | null;
}

const GRAPHICS_PRESETS = ['Низкое', 'Среднее', 'Высокое', 'Ультра', 'Кастом'];
const RESOLUTIONS = ['1280x720', '1366x768', '1600x900', '1920x1080', '2560x1440', '3840x2160'];

function Field({ label, value, onChange, type = 'text', placeholder, options }: {
  label: string; value: string | number; onChange: (v: string) => void;
  type?: string; placeholder?: string; options?: string[];
}) {
  return (
    <div>
      <label className="label-field">{label}</label>
      {options ? (
        <select value={value as string} onChange={(e) => onChange(e.target.value)} className="input-field">
          <option value="">— не указано —</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={value as string} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? ''} className="input-field" />
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Settings>({});

  const { data: settings } = useQuery<Settings | null>({
    queryKey: ['player-settings'],
    queryFn: () => api.get('/settings/my').catch(() => null),
    enabled: !!user,
  });

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <p style={{ color: 'var(--muted)' }}>Войдите чтобы настроить карточку.</p>
    </div>
  );

  const set = (key: keyof Settings) => (v: string) => setForm((f) => ({ ...f, [key]: v === '' ? null : (typeof form[key] === 'number' ? Number(v) : v) }));

  const handleSave = async () => {
    setError(null); setSaving(true); setSaved(false);
    try {
      await api.put('/settings/my', form);
      qc.invalidateQueries({ queryKey: ['player-settings'] });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { setError(e instanceof ApiClientError ? e.message : 'Ошибка'); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-4xl mx-auto" style={{ background: 'var(--bg)' }}>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
        <div>
          <div className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--a)' }}>
            <span className="block w-6 h-px" style={{ background: 'var(--a)' }} />
            Карточка игрока
          </div>
          <h1 className="font-display font-bold uppercase" style={{ fontSize: 'clamp(28px,4vw,44px)', letterSpacing: '-0.01em' }}>
            Мои настройки
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Видны всем кто смотрит твой профиль</p>
        </div>
        <Link href={`/users/${user.id}`} className="btn-out" style={{ fontSize: '13px' }}>Посмотреть карточку →</Link>
      </div>

      {error && <div className="mb-4 text-sm rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171' }}>{error}</div>}

      <div className="grid md:grid-cols-2 gap-6">
        {/* МЫШЬ */}
        <div className="card">
          <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4 flex items-center gap-2" style={{ color: 'var(--muted)' }}>
            🖱️ Мышь и чувствительность
          </h2>
          <div className="flex flex-col gap-3">
            <Field label="DPI мыши" value={form.mouseDpi ?? ''} onChange={set('mouseDpi')} type="number" placeholder="800" />
            <Field label="Чувствительность (общая)" value={form.sensitivity ?? ''} onChange={set('sensitivity')} type="number" placeholder="1.5" />
            <Field label="Прицеливание (ADS)" value={form.aimSensitivity ?? ''} onChange={set('aimSensitivity')} type="number" placeholder="0.8" />
            <Field label="Зум" value={form.zoomSensitivity ?? ''} onChange={set('zoomSensitivity')} type="number" placeholder="0.5" />
            <Field label="Мышь (модель)" value={form.mouse ?? ''} onChange={set('mouse')} placeholder="Logitech G Pro X Superlight" />
            <Field label="Коврик" value={form.mousepad ?? ''} onChange={set('mousepad')} placeholder="SteelSeries QcK+" />
          </div>
        </div>

        {/* ЖЕЛЕЗО */}
        <div className="card">
          <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4 flex items-center gap-2" style={{ color: 'var(--muted)' }}>
            💻 Железо
          </h2>
          <div className="flex flex-col gap-3">
            <Field label="Процессор (CPU)" value={form.cpu ?? ''} onChange={set('cpu')} placeholder="Intel Core i7-12700K" />
            <Field label="Видеокарта (GPU)" value={form.gpu ?? ''} onChange={set('gpu')} placeholder="NVIDIA RTX 3080" />
            <Field label="ОЗУ (GB)" value={form.ram ?? ''} onChange={set('ram')} type="number" placeholder="32" />
            <Field label="Монитор" value={form.monitor ?? ''} onChange={set('monitor')} placeholder="144Hz 1080p" />
            <Field label="Наушники" value={form.headset ?? ''} onChange={set('headset')} placeholder="HyperX Cloud II" />
            <Field label="Клавиатура" value={form.keyboard ?? ''} onChange={set('keyboard')} placeholder="Ducky One 2 Mini" />
          </div>
        </div>

        {/* НАСТРОЙКИ GTA */}
        <div className="card md:col-span-2">
          <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4 flex items-center gap-2" style={{ color: 'var(--muted)' }}>
            🎮 Настройки GTA / FiveM
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="FOV" value={form.fov ?? ''} onChange={set('fov')} type="number" placeholder="90" />
            <Field label="Разрешение" value={form.resolution ?? ''} onChange={set('resolution')} options={RESOLUTIONS} />
            <Field label="Графика" value={form.graphicsPreset ?? ''} onChange={set('graphicsPreset')} options={GRAPHICS_PRESETS} />
            <Field label="Лимит FPS" value={form.fps ?? ''} onChange={set('fps')} type="number" placeholder="144" />
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-4">
        <button onClick={handleSave} disabled={saving} className="btn-main" style={{ padding: '14px 40px', fontSize: '15px' }}>
          {saving ? 'Сохраняем...' : 'Сохранить настройки'}
        </button>
        {saved && <span style={{ color: 'var(--green)' }}>✓ Сохранено!</span>}
      </div>
    </div>
  );
}
