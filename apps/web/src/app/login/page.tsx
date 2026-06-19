'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/auth';
import { ApiClientError } from '@/lib/api';

const LoginSchema = z.object({
  email: z.string().min(1, 'Укажите email').email('Некорректный email'),
  password: z.string().min(1, 'Укажите пароль'),
});

type LoginForm = z.infer<typeof LoginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(LoginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setServerError(null);
    setSubmitting(true);
    try {
      await login(data);
      router.push('/profile');
    } catch (e) {
      setServerError(e instanceof ApiClientError ? e.message : 'Не удалось войти');
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
            Войди, чтобы попасть в лобби
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="card flex flex-col gap-5">
          {serverError && (
            <div className="text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              {serverError}
            </div>
          )}

          <div>
            <label className="label-field">Email</label>
            <input {...register('email')} type="email" autoComplete="email" className={`input-field ${errors.email ? 'error' : ''}`} />
            {errors.email && <p className="error-text">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label-field">Пароль</label>
            <input {...register('password')} type="password" autoComplete="current-password" className={`input-field ${errors.password ? 'error' : ''}`} />
            {errors.password && <p className="error-text">{errors.password.message}</p>}
          </div>

          <button type="submit" disabled={submitting} className="btn-main justify-center mt-2">
            {submitting ? 'Входим...' : 'Войти'}
          </button>

          <p className="text-center text-sm" style={{ color: 'var(--muted)' }}>
            Нет аккаунта?{' '}
            <Link href="/register" style={{ color: 'var(--a)' }}>
              Зарегистрироваться
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
