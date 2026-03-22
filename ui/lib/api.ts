import { clientEnv } from "@/lib/env.client";
import { signOut } from "next-auth/react";
import type {
  AgentAction,
  ChatMessage,
  ChatSession,
  MultimodalSession,
  RemoteSession,
  WebSocketTicket,
} from "@/types/api";

type RequestOptions = RequestInit & {
  token?: string;
};

let authRedirectInFlight = false;

async function redirectToLogin() {
  if (typeof window === "undefined") {
    return;
  }
  if (authRedirectInFlight) {
    return;
  }
  authRedirectInFlight = true;

  const nextPath = `${window.location.pathname}${window.location.search}`;
  await signOut({
    redirect: true,
    callbackUrl: `/login?next=${encodeURIComponent(nextPath)}`,
  });
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${clientEnv.NEXT_PUBLIC_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 401) {
      void redirectToLogin();
    }
    throw new Error(`Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function getChatSessions(token?: string) {
  return request<{ items: ChatSession[] }>("/chats", { token });
}

export async function createChatSession(
  payload: { title: string; control_mode?: "agent" | "manual" | null },
  token?: string,
) {
  return request<ChatSession>("/chats", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function deleteChatSession(chatId: string, token?: string) {
  return request<void>(`/chats/${chatId}`, {
    method: "DELETE",
    token,
  });
}

export async function getChatMessages(chatId: string, token?: string) {
  return request<{ items: ChatMessage[] }>(`/messages/chat/${chatId}`, { token });
}

export async function createChatMessage(
  chatId: string,
  payload: Pick<ChatMessage, "content" | "role" | "attachments">,
  token?: string,
) {
  return request<ChatMessage>(`/messages/chat/${chatId}`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function refinePrompt(prompt: string, token?: string) {
  return request<{ refined_prompt: string }>("/prompts/refine", {
    method: "POST",
    token,
    body: JSON.stringify({ prompt }),
  });
}

export async function clearChatMessages(chatId: string, token?: string) {
  return request<void>(`/messages/chat/${chatId}`, {
    method: "DELETE",
    token,
  });
}

export async function createMultimodalSession(
  chatId: string,
  capabilities: Array<{ kind: string; enabled: boolean }>,
  token?: string,
) {
  return request<MultimodalSession>("/multimodal/sessions", {
    method: "POST",
    token,
    body: JSON.stringify({ chat_id: chatId, capabilities: capabilities }),
  });
}

export async function connectRemoteSession(
  payload: { host: string; port: number; password?: string; label: string },
  token?: string,
) {
  return request<RemoteSession>("/remote-sessions/connect", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function disconnectRemoteSession(sessionId: string, token?: string) {
  return request<RemoteSession>("/remote-sessions/disconnect", {
    method: "POST",
    token,
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export async function getAgentActions(sessionId: string, token?: string) {
  return request<{ items: AgentAction[] }>(`/remote-sessions/${sessionId}/actions`, { token });
}

export async function createWebSocketTicket(sessionId: string, token?: string) {
  return request<WebSocketTicket>("/ws/tickets", {
    method: "POST",
    token,
    body: JSON.stringify({ session_id: sessionId }),
  });
}
