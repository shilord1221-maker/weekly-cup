'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/auth';
import { ApiClientError } from '@/lib/api';
import { ImageUploadField } from '@/components/ImageUploadField';

// Ник и Static ID — обязательные поля. Без них форма не отправится.
const RegisterSchema = z.object({
  username: z
    .string()
    .min(3, 'Ник должен быть не короче 3 символов')
    .max(32, 'Ник должен быть не длиннее 32 символов')
    .regex(/^[a-zA-Z0-9_ ]+$/, 'Только буквы, цифры, пробел и подчёркивание'),
  email: z.string().min(1, 'Укажите email').email('Некорректный email'),
  password: z.string().min(8, 'Пароль должен быть не короче 8 символов'),
  staticId: z
    .string()
    .regex(/^\d{2,}$/, 'Static ID должен состоять минимум из 2 цифр'),
});

type RegisterForm = z.infer<typeof RegisterSchema>;

// useSearchParams() требует Suspense-границу в Next.js App Router при статической генерации.
export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
          <p style={{ color: 'var(--muted)' }}>Загрузка...</p>
        </div>
      }
    >
      <RegisterFormContent />
    </Suspense>
  );
}

function RegisterFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const register_ = useAuthStore((s) => s.register);
  const [serverError, setServerError] = useState<string | null>(null);
  const [proofMismatchError, setProofMismatchError] = useState<string | null>(null);
  const [proofRequiredError, setProofRequiredError] = useState<string | null>(null);
  const [staticIdProofUrl, setStaticIdProofUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Реферальный код из ссылки вида /register?ref=ABCD1234 — передаём его на сервер при регистрации.
  const referralCode = searchParams.get('ref') ?? undefined;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(RegisterSchema),
    mode: 'onBlur',
  });

  const onSubmit = async (data: RegisterForm) => {
    setServerError(null);
    setProofMismatchError(null);
    setProofRequiredError(null);

    // Скрин-пруф обязателен — проверяем на клиенте до отправки, чтобы не ждать round-trip к серверу.
    if (!staticIdProofUrl.optional()) {
      setProofRequiredError('Загрузите скриншот-пруф Static ID — без него регистрация невозможна');
      return;
    }

    setSubmitting(true);
    try {
      await register_({ ...data, staticIdProofUrl: staticIdProofUrl.trim(), referralCode });
      router.push('/profile');
    } catch (e) {
      if (e instanceof ApiClientError) {
        const amnestyId = e.body?.amnestyRequestId;
        if (e.code === 'STATIC_ID_TAKEN' && typeof amnestyId === 'string') {
          router.push(`/amnesty/${amnestyId}`);
          return;
        }
        // Несовпадение Static ID со скрином — показываем прямо под полем Static ID,
        // а не общим сообщением сверху формы, чтобы было сразу видно, что не так.
        if (e.code === 'PROOF_MISMATCH') {
          setProofMismatchError(e.message);
          return;
        }
        setServerError(e.message);
      } else {
        setServerError('Не удалось создать аккаунт. Попробуйте снова.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-20" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Link href="/" className="font-display font-bold text-2xl uppercase tracking-wider inline-flex items-center gap-2">
            <span style={{ color: 'var(--text)' }}>WEEKLY</span> <span style={{ color: 'var(--a)' }}>CUP</span>
          </Link>
          <p className="text-sm mt-3" style={{ color: 'var(--muted)' }}>
            Создай аккаунт и присоединяйся к турнирам
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="card flex flex-col gap-5">
          {serverError && (
            <div className="text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              {serverError}
            </div>
          )}

          <div>
            <label className="label-field">
              Ник <span style={{ color: 'var(--a)' }}>*</span>
            </label>
            <input
              {...register('username')}
              type="text"
              placeholder="Ghost_UA"
              autoComplete="username"
              className={`input-field ${errors.username ? 'error' : ''}`}
            />
            {errors.username && <p className="error-text">{errors.username.message}</p>}
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              Обязательное поле. Будет видно другим игрокам в лобби и чате.
            </p>
          </div>

          <div>
            <label className="label-field">Email</label>
            <input
              {...register('email')}
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              className={`input-field ${errors.email ? 'error' : ''}`}
            />
            {errors.email && <p className="error-text">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label-field">Пароль</label>
            <input
              {...register('password')}
              type="password"
              placeholder="Минимум 8 символов"
              autoComplete="new-password"
              className={`input-field ${errors.password ? 'error' : ''}`}
            />
            {errors.password && <p className="error-text">{errors.password.message}</p>}
          </div>

          <div>
            <label className="label-field">
              Static ID на сервере MCL <span style={{ color: 'var(--a)' }}>*</span>
            </label>
            <input
              {...register('staticId')}
              type="text"
              placeholder="например: 7741209"
              autoComplete="off"
              onChange={(e) => {
                setProofMismatchError(null);
                register('staticId').onChange(e);
              }}
              className={`input-field ${errors.staticId || proofMismatchError ? 'error' : ''}`}
            />
            {errors.staticId && <p className="error-text">{errors.staticId.message}</p>}
            {proofMismatchError && <p className="error-text">{proofMismatchError}</p>}
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              Обязательное поле. Уникальный игровой идентификатор — используется для подтверждения участия в матчах.
              {' '}Если указан скрин-пруф, этот номер должен совпадать с тем, что видно на скрине.
            </p>
          </div>

          <ImageUploadField
            label="Скриншот-пруф Static ID"
            value={staticIdProofUrl}
            onChange={(url) => {
              setStaticIdProofUrl(url);
              setProofRequiredError(null);
            }}
            folder="static-id-proofs"
            required
            helperText="Загрузите скрин с вашим Static ID — без него зарегистрироваться нельзя."
          />
          {proofRequiredError && <p className="error-text">{proofRequiredError}</p>}

          <button type="submit" disabled={submitting} className="btn-main justify-center mt-2">
            {submitting ? 'Создаём аккаунт...' : 'Создать аккаунт'}
          </button>

          <p className="text-center text-sm" style={{ color: 'var(--muted)' }}>
            Уже есть аккаунт?{' '}
            <Link href="/login" style={{ color: 'var(--a)' }}>
              Войти
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
