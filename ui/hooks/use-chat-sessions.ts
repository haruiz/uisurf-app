"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createChatSession, deleteChatSession, getChatSessions } from "@/lib/api";
import { useChatStore } from "@/store/chat-store";

export function useChatSessions(token?: string) {
  return useQuery({
    queryKey: ["chat-sessions"],
    queryFn: () => getChatSessions(token),
    enabled: Boolean(token),
    refetchInterval: (query) =>
      query.state.data?.items.some((session) => session.vnc_pending) ? 2000 : false,
  });
}

export function useCreateChatSession(token?: string) {
  const queryClient = useQueryClient();
  const setSelectedChatId = useChatStore((state) => state.setSelectedChatId);
  const setViewerLoading = useChatStore((state) => state.setViewerLoading);

  return useMutation({
    mutationFn: (payload: { title: string; control_mode?: "agent" | "manual" | null }) =>
      createChatSession(payload, token),
    onSuccess: (session) => {
      setSelectedChatId(session.id);
      if (session.vnc_url || session.vnc_pending) {
        setViewerLoading(session.id, true);
      }
      void queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
    },
  });
}

export function useDeleteChatSession(token?: string) {
  const queryClient = useQueryClient();
  const selectedChatId = useChatStore((state) => state.selectedChatId);
  const setSelectedChatId = useChatStore((state) => state.setSelectedChatId);
  const clearViewerLoading = useChatStore((state) => state.clearViewerLoading);
  const clearChatDraft = useChatStore((state) => state.clearChatDraft);
  const clearSessionAgentState = useChatStore((state) => state.clearSessionAgentState);
  const clearResolvedApprovalKey = useChatStore((state) => state.clearResolvedApprovalKey);

  return useMutation({
    mutationFn: (chatId: string) => deleteChatSession(chatId, token),
    onSuccess: (_, chatId) => {
      if (selectedChatId === chatId) {
        setSelectedChatId(null);
      }
      clearViewerLoading(chatId);
      clearChatDraft(chatId);
      clearSessionAgentState(chatId);
      clearResolvedApprovalKey(chatId);
      void queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}
