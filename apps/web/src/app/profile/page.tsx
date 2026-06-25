'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore, roleLabel, type Role } from '@/store/auth';
import { ImageUploadField } from '@/components/ImageUploadField';

interface ProfileData {
  id: string;
  username: string;
  email: string;
  role: Role;
  staticId: { value: string } | null;
  discordId: string | null;
  discordUsername: string | null;
  discordAvatar: string | null;
  discordLinkedAt: string | null;
  referralCode: string | null;
  referralCount: number;
  avatarUrl: string | null;
  pendingAvatarUrl: string | null;
  avatarStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  avatarRejectedReason: string | null;
  achievements: { id: string; title: string; earnedAt: string }[];
  wins: { id: string; createdAt: string; match: { map: { name: string } } }[];
}

const DISCORD_ERROR_MESSAGES: Record<string, string> = {
  missing_params: 'Авторизация Discord прервалась — попробуйте снова.',
  invalid_state: 'Ссылка авторизации устарела — попробуйте привязать Discord ещё раз.',
  already_linked: 'Этот Discord аккаунт уже привязан к другому профилю на сайте.',
  exchange_failed: 'Не удалось получить данные от Discord — попробуйте снова.',
};

// useSearchParams() требует Suspense-границу в Next.js App Router при статической генерации —
// без этого сборка падает с ошибкой "useSearchParams() should be wrapped in a suspense boundary".
export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
          <p style={{ color: 'var(--muted)' }}>Загрузка профиля...</p>
        </div>
      }
    >
      <ProfilePageContent />
    </Suspense>
  );
}

function ProfilePageContent() {
  const { user, isInitialized } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const [discordBanner, setDiscordBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [discordActionError, setDiscordActionError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const [avatarSubmitError, setAvatarSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (isInitialized && !user) router.push('/login');
  }, [isInitialized, user, router]);

  const { data: profile } = useQuery<ProfileData>({
    queryKey: ['profile'],
    queryFn: () => api.get('/profile'),
    enabled: !!user,
  });

  // Discord OAuth callback возвращает сюда с ?discord=success или ?discord=error&reason=...
  useEffect(() => {
    const discordStatus = searchParams.get('discord');
    if (!discordStatus) return;

    if (discordStatus === 'success') {
      setDiscordBanner({ type: 'success', text: 'Discord успешно привязан.' });
      qc.invalidateQueries({ queryKey: ['profile'] });
    } else if (discordStatus === 'error') {
      const reason = searchParams.get('reason') ?? '';
      setDiscordBanner({ type: 'error', text: DISCORD_ERROR_MESSAGES[reason] ?? 'Не удалось привязать Discord — попробуйте снова.' });
    }

    // Убираем query-параметры из адресной строки, чтобы баннер не показывался повторно при обновлении страницы
    router.replace('/profile');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleLinkDiscord = async () => {
    setDiscordActionError(null);
    setLinking(true);
    try {
      const { url } = await api.get<{ url: string }>('/discord/link');
      window.location.href = url;
    } catch (e) {
      setDiscordActionError(e instanceof ApiClientError ? e.message : 'Не удалось начать привязку Discord');
      setLinking(false);
    }
  };

  const handleUnlinkDiscord = async () => {
    if (!confirm('Отвязать Discord? Вы не сможете участвовать в лобби, пока не привяжете аккаунт заново.')) return;
    setDiscordActionError(null);
    setUnlinking(true);
    try {
      await api.post('/discord/unlink');
      qc.invalidateQueries({ queryKey: ['profile'] });
    } catch (e) {
      setDiscordActionError(e instanceof ApiClientError ? e.message : 'Не удалось отвязать Discord');
    } finally {
      setUnlinking(false);
    }
  };

  const handleSubmitAvatar = async (uploadedUrl: string) => {
    if (!uploadedUrl) return;
    setAvatarSubmitError(null);
    try {
      await api.post('/profile/avatar', { avatarUrl: uploadedUrl });
      qc.invalidateQueries({ queryKey: ['profile'] });
    } catch (e) {
      setAvatarSubmitError(e instanceof ApiClientError ? e.message : 'Не удалось отправить аватарку на проверку');
    }
  };

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <p style={{ color: 'var(--muted)' }}>Загрузка профиля...</p>
      </div>
    );
  }

  const referralLink = profile.referralCode
    ? typeof window !== 'undefined'
      ? `${window.location.origin}/register?ref=${profile.referralCode}`
      : `/register?ref=${profile.referralCode}`
    : null;

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-3xl mx-auto" style={{ background: 'var(--bg)' }}>
      <div className="flex items-center gap-4 mb-12">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,var(--a),var(--a2))' }}
        >
          {profile.username.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h1 className="font-display font-bold uppercase" style={{ fontSize: '28px', letterSpacing: '0.02em' }}>
            {profile.username}
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {profile.email} · {roleLabel(profile.role)}
          </p>
        </div>
      </div>

      {discordBanner && (
        <div
          className="mb-6 text-sm rounded-lg px-4 py-3"
          style={
            discordBanner.type === 'success'
              ? { background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }
              : { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }
          }
        >
          {discordBanner.text}
        </div>
      )}

      {/* DISCORD */}
      <div className="card mb-6">
        <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
          Discord
        </h2>

        {profile.discordId ? (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {profile.discordAvatar ? (
                <img src={profile.discordAvatar} alt="" className="w-10 h-10 rounded-full" />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(88,101,242,.15)', color: '#5865F2' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 0 1 .077-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.1.246.198.373.292a.077.077 0 0 1-.006.128 12.299 12.299 0 0 1-1.873.892.076.076 0 0 0-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.876 19.876 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.029z" />
                  </svg>
                </div>
              )}
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                  {profile.discordUsername}
                </div>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full inline-block mt-0.5" style={{ color: 'var(--green)', background: 'rgba(34,197,94,.08)' }}>
                  Привязан
                </span>
              </div>
            </div>
            <button onClick={handleUnlinkDiscord} disabled={unlinking} className="btn-out" style={{ padding: '8px 16px', fontSize: '13px' }}>
              {unlinking ? 'Отвязываем...' : 'Отвязать'}
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
              Для участия в лобби необходимо привязать Discord аккаунт и находиться на официальном Discord сервере.
            </p>
            <button onClick={handleLinkDiscord} disabled={linking} className="btn-main" style={{ padding: '10px 20px', fontSize: '13px' }}>
              {linking ? 'Переходим в Discord...' : 'Привязать Discord'}
            </button>
          </div>
        )}

        {discordActionError && <p className="error-text mt-3">{discordActionError}</p>}
      </div>

      {/* AVATAR — загрузка проходит модерацию, видимая аватарка не меняется до одобрения */}
      <div className="card mb-6">
        <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
          Аватарка
        </h2>
        <div className="flex items-center gap-4 mb-3">
          <div
            className="w-16 h-16 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-lg font-bold text-white"
            style={{ background: 'linear-gradient(135deg,var(--a),var(--a2))' }}
          >
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" /> : profile.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1">
            <ImageUploadField label="" value="" onChange={handleSubmitAvatar} folder="media-thumbs" helperText="Новая аватарка появится на сайте только после одобрения админом или овнером." />
          </div>
        </div>
        {profile.avatarStatus === 'PENDING' && (
          <div className="flex items-center gap-3 text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(201,149,74,.08)', color: 'var(--gold)' }}>
            {profile.pendingAvatarUrl && <img src={profile.pendingAvatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />}
            На рассмотрении у модераторов
          </div>
        )}
        {profile.avatarStatus === 'REJECTED' && (
          <div className="text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,.08)', color: '#f87171' }}>
            Аватарка отклонена{profile.avatarRejectedReason ? `: ${profile.avatarRejectedReason}` : ''}
          </div>
        )}
        {avatarSubmitError && <p className="error-text mt-2">{avatarSubmitError}</p>}
      </div>

      {/* REFERRAL */}
      <div className="card mb-6">
        <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
          Реферальная ссылка
        </h2>
        <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
          Приведено игроков: <strong style={{ color: 'var(--text)' }}>{profile.referralCount}</strong>
        </p>
        {referralLink ? (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              readOnly
              value={referralLink}
              onFocus={(e) => e.target.select()}
              className="input-field flex-1"
              style={{ minWidth: '220px' }}
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(referralLink).then(() => {
                  setReferralCopied(true);
                  setTimeout(() => setReferralCopied(false), 2000);
                });
              }}
              className="btn-out flex-shrink-0"
              style={{ padding: '10px 18px', fontSize: '13px' }}
            >
              {referralCopied ? 'Скопировано ✓' : 'Скопировать'}
            </button>
          </div>
        ) : (
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Ссылка появится через несколько минут — обновите страницу.
          </p>
        )}
      </div>

      {/* STATIC ID */}
      <div className="card mb-6">
        <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
          Static ID
        </h2>
        <p className="font-mono text-lg mb-2">{profile.staticId?.value ?? '— не привязан —'}</p>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Static ID закреплён за аккаунтом и не может быть изменён самостоятельно. Если он указан неверно, обратитесь в{' '}
          <Link href="/social" style={{ color: 'var(--a)' }}>
            поддержку
          </Link>
          .
        </p>
      </div>

      {/* SUPPORT */}
      <a
        href="https://t.me/Weeklycupsupport"
        target="_blank"
        rel="noopener noreferrer"
        className="card mb-6 flex items-center justify-between gap-4 transition-all hover:translate-x-1"
        style={{ textDecoration: 'none' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(41,169,235,.1)', color: '#29a9eb' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.568 8.16c-.169 1.858-.896 6.728-1.267 8.93-.156.93-.474 1.243-.748 1.27-.638.06-1.122-.422-1.74-.832-.964-.633-1.51-1.026-2.448-1.644-1.084-.717-.38-1.11.235-1.756.165-.17 3.026-2.78 3.082-3.012.007-.03.013-.14-.05-.197-.064-.06-.158-.038-.226-.022-.097.022-1.629 1.034-4.596 3.038-.434.299-.83.444-1.183.436-.39-.008-1.14-.222-1.698-.405-.685-.226-1.228-.346-1.182-.73.024-.2.297-.404.823-.612 3.232-1.408 5.387-2.336 6.464-2.785 3.078-1.274 3.717-1.494 4.135-1.502.092-.002.298.022.43.135.11.094.14.222.156.314.014.083.034.27.018.418z" />
            </svg>
          </div>
          <div>
            <div className="font-display font-semibold uppercase tracking-wider mb-0.5" style={{ fontSize: '14px', color: 'var(--text)' }}>
              Поддержка
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Вопросы по аккаунту, смена ника, Static ID, спорные ситуации
            </p>
          </div>
        </div>
        <span style={{ color: 'var(--muted)' }}>→</span>
      </a>

      {/* ACHIEVEMENTS */}
      <div className="card mb-6">
        <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
          Достижения
        </h2>
        {profile.achievements.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Пока нет достижений — сыграйте первый матч.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {profile.achievements.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <span>🏆 {a.title}</span>
                <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
                  {new Date(a.earnedAt).toLocaleDateString('ru-RU')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MATCH HISTORY */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold uppercase text-sm tracking-wider" style={{ color: 'var(--muted)' }}>
            История побед
          </h2>
          <Link href="/matches" className="text-xs font-medium" style={{ color: 'var(--a)' }}>
            Все матчи →
          </Link>
        </div>
        {profile.wins.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Пока нет побед в истории.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {profile.wins.map((w) => (
              <div key={w.id} className="flex items-center justify-between text-sm py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <span>🏆 Победа · {w.match.map.name}</span>
                <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
                  {new Date(w.createdAt).toLocaleDateString('ru-RU')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
