'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from '@/lib/api';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

let sharedSocket: Socket | null = null;

export function useSocket(): Socket {
  const ref = useRef<Socket | null>(null);

  if (!sharedSocket) {
    sharedSocket = io(SOCKET_URL, {
      autoConnect: true,
      transports: ['websocket'],
      auth: { token: getAccessToken() },
    });
  }
  ref.current = sharedSocket;

  useEffect(() => {
    // Обновляем токен при каждом монтировании на случай, если он сменился (refresh)
    if (sharedSocket) {
      sharedSocket.auth = { token: getAccessToken() };
    }
  }, []);

  return ref.current;
}
