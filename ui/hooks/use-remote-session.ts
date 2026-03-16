"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { connectRemoteSession, disconnectRemoteSession } from "@/lib/api";

export function useConnectRemoteSession(token?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { host: string; port: number; password?: string; label: string }) =>
      connectRemoteSession(payload, token),
    onSuccess: (session) => {
      void queryClient.invalidateQueries({ queryKey: ["agent-actions", session.id] });
    },
  });
}

export function useDisconnectRemoteSession(token?: string) {
  return useMutation({
    mutationFn: (sessionId: string) => disconnectRemoteSession(sessionId, token),
  });
}
