'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/auth';
import { ApiClientError } from '@/lib/api';

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

export default function RegisterPage() {
  const router = useRouter();
  const register_ = useAuthStore((s) => s.register);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);
    try {
      await register_(data);
      router.push('/profile');
    } catch (e) {
      if (e instanceof ApiClientError) {
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
              Static ID <span style={{ color: 'var(--a)' }}>*</span>
            </label>
            <input
              {...register('staticId')}
              type="text"
              placeholder="например: 7741209"
              autoComplete="off"
              className={`input-field ${errors.staticId ? 'error' : ''}`}
            />
            {errors.staticId && <p className="error-text">{errors.staticId.message}</p>}
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              Обязательное поле. Уникальный игровой идентификатор — используется для подтверждения участия в матчах.
            </p>
          </div>

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
