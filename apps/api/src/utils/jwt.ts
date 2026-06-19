import jwt from 'jsonwebtoken';
import { env } from '@/env.js';
import type { Role } from '@prisma/client';

export interface AccessTokenPayload {
  sub: string; // userId
  role: Role;
  username: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: jwt.SignOptions = { expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function signRefreshToken(userId: string): string {
  const options: jwt.SignOptions = { expiresIn: env.JWT_REFRESH_TTL as jwt.SignOptions['expiresIn'] };
  return jwt.sign({ sub: userId }, env.JWT_REFRESH_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string };
}

export function refreshTokenExpiryDate(): Date {
  // 30 дней по умолчанию, синхронизировано с JWT_REFRESH_TTL=30d
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}
