"use client";

import type { ChatMessage } from "@/types/api";

export type SpeechMode = "narration" | "conversation";

export type LiveSessionMessageType =
  | "error"
  | "info"
  | "debug"
  | "warning"
  | "turn_start"
  | "turn_complete"
  | "interrupted"
  | "function_call"
  | "function_response"
  | "function_progress"
  | "log"
  | "audio"
  | "text"
  | "image";

export type LiveSessionMessageSender = "system" | "model" | "user";

export type FunctionCallData = {
  name: string;
  arguments: Record<string, unknown>;
  tool_result?: Record<string, unknown> | string | null;
};

export type FunctionResponseData = {
  name: string;
  response?: Record<string, unknown> | string | null;
};

export type FunctionProgressData = {
  name: string;
  message: string;
  progress: number;
  total: number;
  percentage: number;
};

export type SpeechData = {
  audio: string;
  words: Record<string, unknown>;
};

export type MessageData = {
  content: string;
  mime_type?: string;
};

export type AudioData = MessageData & {
  speech_mode?: SpeechMode;
  speech_data?: SpeechData | null;
};

export type LiveSessionMessagePayload =
  | FunctionCallData
  | FunctionResponseData
  | FunctionProgressData
  | AudioData
  | MessageData
  | Record<string, unknown>
  | string
  | null;

export type LiveSessionEnvelope = {
  type: LiveSessionMessageType;
  data?: LiveSessionMessagePayload;
  sender?: LiveSessionMessageSender;
  timestamp?: number | null;
};

export type LiveChatMessage = {
  id: string;
  chatId: string;
  type: LiveSessionMessageType;
  sender: LiveSessionMessageSender;
  data: LiveSessionMessagePayload;
  createdAt: string;
};

export function createLiveMessageId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createLiveChatMessage(
  chatId: string,
  message: LiveSessionEnvelope,
  id = createLiveMessageId(message.type),
): LiveChatMessage {
  const createdAt = message.timestamp ? new Date(message.timestamp).toISOString() : new Date().toISOString();
  return {
    id,
    chatId,
    type: message.type,
    sender: message.sender ?? "system",
    data: message.data ?? null,
    createdAt,
  };
}

export function isLiveSessionEnvelope(value: unknown): value is LiveSessionEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { type?: unknown };
  return typeof candidate.type === "string";
}

export function normalizeHistoryMessage(chatId: string, message: ChatMessage): LiveChatMessage {
  const sender: LiveSessionMessageSender =
    message.role === "assistant" ? "model" : message.role === "user" ? "user" : "system";

  return {
    id: message.id,
    chatId,
    type: "text",
    sender,
    data: {
      content: message.content,
      mime_type: "text/plain",
    },
    createdAt: message.created_at,
  };
}

export function getLiveMessageText(message: LiveChatMessage): string | null {
  const { data } = message;

  if (typeof data === "string") {
    return data;
  }

  if (data && typeof data === "object" && "content" in data && typeof data.content === "string") {
    return data.content;
  }

  return null;
}

