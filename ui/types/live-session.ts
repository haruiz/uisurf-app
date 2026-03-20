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
  status?: AgentActivityStatus | null;
};

export type AgentActivityStatus = "running" | "completed" | "failed";

export type AgentActivityKind =
  | "function_call"
  | "function_response"
  | "message"
  | "thought"
  | "progress"
  | "task_update"
  | "unknown";

export type AgentActivityModel = {
  sourceType: LiveSessionMessageType;
  kind: AgentActivityKind;
  status: AgentActivityStatus;
  title: string;
  summary: string;
  agentName: string | null;
  functionName: string | null;
  taskId: string | null;
  contextId: string | null;
  details: unknown;
  raw: unknown;
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
    status: message.type === "function_call" ? "running" : null,
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
    status: null,
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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function tryParseJsonValue(value: unknown): unknown | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function toStructuredValue(value: unknown): unknown {
  return tryParseJsonValue(value) ?? value;
}

function humanizeIdentifier(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function truncateText(value: string, maxLength = 220): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

function extractTextValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const directTextKeys = ["text", "message", "detail", "response", "result", "error", "error_message"];
  for (const key of directTextKeys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  if (Array.isArray(record.parts)) {
    const textParts = record.parts
      .map((part) => extractTextValue(part))
      .filter((part): part is string => Boolean(part));
    if (textParts.length > 0) {
      return textParts.join(" ");
    }
  }

  return null;
}

function getStringField(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function normalizeAgentName(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return value;
  }

  if (normalized.includes("browser")) {
    return "Browser agent";
  }
  if (normalized.includes("desktop")) {
    return "Desktop agent";
  }
  if (normalized.includes("automation")) {
    return "Automation agent";
  }
  if (normalized.includes("planning")) {
    return "Planning agent";
  }
  if (normalized.includes("summary")) {
    return "Summarization agent";
  }

  return humanizeIdentifier(value);
}

function inferAgentNameFromFunction(
  functionName: string | null,
  details: Record<string, unknown> | null,
): string | null {
  const normalizedName = functionName?.trim().toLowerCase() ?? "";
  if (normalizedName.includes("browser")) {
    return "Browser agent";
  }
  if (normalizedName.includes("desktop")) {
    return "Desktop agent";
  }

  if (details) {
    if (
      typeof details.desktop_state === "string" ||
      typeof details.current_state === "string" ||
      typeof details.window_title === "string"
    ) {
      return "Desktop agent";
    }
    if (
      typeof details.url === "string" ||
      typeof details.current_url === "string" ||
      typeof details.page_url === "string"
    ) {
      return "Browser agent";
    }

    const args = asRecord(details.args) ?? asRecord(details.arguments);
    if (args) {
      if (typeof args.url === "string" || typeof args.selector === "string") {
        return "Browser agent";
      }
      if (
        typeof args.path === "string" ||
        typeof args.file_path === "string" ||
        typeof args.app_name === "string" ||
        typeof args.window === "string"
      ) {
        return "Desktop agent";
      }
    }
  }

  return null;
}

function guessAgentName(value: unknown, fallbackFunctionName: string | null = null): string | null {
  const record = asRecord(value);
  if (!record) {
    return inferAgentNameFromFunction(fallbackFunctionName, null);
  }

  const directAgentName = getStringField(record, [
    "agentName",
    "agent_name",
    "agent",
    "author",
    "source_agent",
    "sourceAgent",
    "target_agent",
    "targetAgent",
  ]);
  if (directAgentName) {
    return normalizeAgentName(directAgentName);
  }

  const payload = asRecord(record.payload);
  if (payload) {
    const payloadAgentName = guessAgentName(payload, fallbackFunctionName);
    if (payloadAgentName) {
      return payloadAgentName;
    }
  }

  const inferredFromFunction = inferAgentNameFromFunction(fallbackFunctionName, record);
  if (inferredFromFunction) {
    return inferredFromFunction;
  }

  const nameField = getStringField(record, ["name"]);
  if (nameField && nameField.toLowerCase().includes("agent")) {
    return normalizeAgentName(nameField);
  }

  return null;
}

function getStatusFromLabel(value: string | null): AgentActivityStatus | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (
    normalized.includes("fail") ||
    normalized.includes("error") ||
    normalized.includes("cancel") ||
    normalized.includes("denied")
  ) {
    return "failed";
  }

  if (
    normalized.includes("complete") ||
    normalized.includes("done") ||
    normalized.includes("success") ||
    normalized.includes("finished") ||
    normalized.includes("final")
  ) {
    return "completed";
  }

  if (
    normalized.includes("working") ||
    normalized.includes("running") ||
    normalized.includes("submitted") ||
    normalized.includes("pending") ||
    normalized.includes("progress") ||
    normalized.includes("starting")
  ) {
    return "running";
  }

  return null;
}

function isA2ALikeRecord(value: unknown): value is Record<string, unknown> {
  const record = asRecord(value);
  if (!record) {
    return false;
  }

  const status = asRecord(record.status);
  return (
    typeof record.eventType === "string" ||
    typeof record.isFinal === "boolean" ||
    typeof record.taskId === "string" ||
    typeof record.task_id === "string" ||
    (status !== null && typeof status.state === "string")
  );
}

function extractA2ARecord(value: unknown): Record<string, unknown> | null {
  const structured = toStructuredValue(value);
  if (isA2ALikeRecord(structured)) {
    return structured;
  }

  const record = asRecord(structured);
  if (!record) {
    return null;
  }

  for (const key of ["response", "payload", "result", "data", "content"]) {
    const nested = extractA2ARecord(record[key]);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function buildSummaryFromA2ARecord(record: Record<string, unknown>, functionName: string | null): string {
  const payload = asRecord(record.payload);
  const eventType = typeof record.eventType === "string" ? record.eventType : "";
  const statusRecord = asRecord(record.status);
  const statusState = getStringField(statusRecord ?? {}, ["state"]);
  const payloadText =
    extractTextValue(payload) ??
    extractTextValue(statusRecord?.message) ??
    extractTextValue(record.message) ??
    extractTextValue(record.result);

  if (eventType === "function_call") {
    return functionName
      ? `Calling ${humanizeIdentifier(functionName)}.`
      : "Calling a remote function.";
  }

  if (eventType === "function_response") {
    if (payloadText) {
      return truncateText(payloadText);
    }
    return functionName
      ? `${humanizeIdentifier(functionName)} returned a response.`
      : "Received a function response.";
  }

  if (eventType === "thought" && payloadText) {
    return truncateText(payloadText);
  }

  if (eventType === "message" && payloadText) {
    return truncateText(payloadText);
  }

  if (statusState) {
    return `Task state changed to ${humanizeIdentifier(statusState)}.`;
  }

  if (payloadText) {
    return truncateText(payloadText);
  }

  return "Structured agent activity.";
}

function buildActivityFromA2ARecord(
  record: Record<string, unknown>,
  sourceType: LiveSessionMessageType,
  fallbackStatus: AgentActivityStatus = "running",
): AgentActivityModel {
  const payload = asRecord(record.payload);
  const statusRecord = asRecord(record.status);
  const eventType = typeof record.eventType === "string" ? record.eventType : null;
  const functionName =
    getStringField(payload ?? {}, ["name"]) ??
    getStringField(record, ["name"]);
  const agentName =
    guessAgentName(record, functionName) ??
    guessAgentName(payload, functionName);
  const taskId =
    getStringField(record, ["taskId", "task_id"]) ??
    (statusRecord ? getStringField(statusRecord, ["taskId", "task_id"]) : null) ??
    (statusRecord ? getStringField(record, ["id"]) : null);
  const contextId =
    getStringField(record, ["contextId", "context_id"]) ??
    (statusRecord ? getStringField(statusRecord, ["contextId", "context_id"]) : null);
  const statusState = statusRecord ? getStringField(statusRecord, ["state"]) : null;
  const payloadText = extractTextValue(payload);
  const status =
    eventType === "function_call"
      ? "running"
      : eventType === "function_response"
        ? getStatusFromLabel(payloadText) ?? "completed"
        : getStatusFromLabel(statusState) ??
          getStatusFromLabel(payloadText) ??
          (typeof record.isFinal === "boolean" ? (record.isFinal ? "completed" : "running") : null) ??
          fallbackStatus;

  return {
    sourceType,
    kind:
      eventType === "function_call" ||
      eventType === "function_response" ||
      eventType === "message" ||
      eventType === "thought"
        ? eventType
        : statusState
          ? "task_update"
          : "unknown",
    status,
    title: eventType ? humanizeIdentifier(eventType) : statusState ? "Task update" : "Agent activity",
    summary: buildSummaryFromA2ARecord(record, functionName),
    agentName,
    functionName,
    taskId,
    contextId,
    details: record,
    raw: record,
  };
}

export function isStructuredActivityPayload(value: unknown): boolean {
  return extractA2ARecord(value) !== null;
}

export function getAgentActivityModel(
  message: LiveChatMessage,
  functionCallStatus: AgentActivityStatus = "running",
): AgentActivityModel | null {
  if (message.sender === "user") {
    return null;
  }

  if (message.type === "function_call" && message.data && typeof message.data === "object") {
    const data = message.data as FunctionCallData;
    const details = {
      name: data.name,
      arguments: data.arguments,
      tool_result: data.tool_result ?? null,
    };
    return {
      sourceType: message.type,
      kind: "function_call",
      status: message.status ?? functionCallStatus,
      title: "Function call",
      summary: `Calling ${humanizeIdentifier(data.name)}.`,
      agentName: inferAgentNameFromFunction(data.name, asRecord(details)),
      functionName: data.name,
      taskId: null,
      contextId: null,
      details,
      raw: message.data,
    };
  }

  if (message.type === "function_response" && message.data && typeof message.data === "object") {
    const data = message.data as FunctionResponseData;
    const nestedA2ARecord = extractA2ARecord(data.response);
    if (nestedA2ARecord) {
      const model = buildActivityFromA2ARecord(nestedA2ARecord, message.type, "completed");
      return {
        ...model,
        agentName: model.agentName ?? inferAgentNameFromFunction(data.name, asRecord(data.response)),
        functionName: model.functionName ?? data.name,
      };
    }

    const responseValue = toStructuredValue(data.response);
    const summaryText =
      extractTextValue(responseValue) ??
      `${humanizeIdentifier(data.name)} returned a response.`;
    const status =
      getStatusFromLabel(summaryText) ??
      getStatusFromLabel(extractTextValue(responseValue)) ??
      "completed";

    return {
      sourceType: message.type,
      kind: "function_response",
      status,
      title: "Function response",
      summary: truncateText(summaryText),
      agentName: inferAgentNameFromFunction(data.name, asRecord(responseValue)),
      functionName: data.name,
      taskId: null,
      contextId: null,
      details: {
        name: data.name,
        response: responseValue,
      },
      raw: message.data,
    };
  }

  if (message.type === "function_progress" && message.data && typeof message.data === "object") {
    const data = message.data as FunctionProgressData;
    return {
      sourceType: message.type,
      kind: "progress",
      status: "running",
      title: "Function progress",
      summary: `${data.message} (${data.percentage}%)`,
      agentName: inferAgentNameFromFunction(data.name, asRecord(data as unknown)),
      functionName: data.name,
      taskId: null,
      contextId: null,
      details: data,
      raw: data,
    };
  }

  const text = getLiveMessageText(message);
  if (text) {
    const nestedA2ARecord = extractA2ARecord(text);
    if (nestedA2ARecord) {
      const activity = buildActivityFromA2ARecord(nestedA2ARecord, message.type);
      if (activity.kind === "function_call" && message.status) {
        return {
          ...activity,
          status: message.status,
        };
      }
      return activity;
    }
  }

  const directA2ARecord = extractA2ARecord(message.data);
  if (directA2ARecord) {
    const activity = buildActivityFromA2ARecord(directA2ARecord, message.type);
    if (activity.kind === "function_call" && message.status) {
      return {
        ...activity,
        status: message.status,
      };
    }
    return activity;
  }

  return null;
}
