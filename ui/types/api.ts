export type ChatSession = {
  id: string;
  owner_id: string;
  title: string;
  vnc_url: string | null;
  vnc_pending: boolean;
  created_at: string;
  updated_at: string;
  selected: boolean;
};

export type ChatAttachment = {
  type: "audio" | "video" | "screen" | "image";
  name: string;
  status: "pending" | "ready";
};

export type ChatMessage = {
  id: string;
  chat_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments: ChatAttachment[];
  created_at: string;
};

export type MultimodalSession = {
  id: string;
  chat_id: string;
  owner_id: string;
  status: "pending" | "ready";
  transport: "websocket" | "webrtc" | "unknown";
  created_at: string;
};

export type RemoteSession = {
  id: string;
  owner_id: string;
  label: string;
  host: string;
  port: number;
  status: "disconnected" | "connecting" | "connected" | "error";
  viewer_url: string | null;
  connected_at: string;
  last_error: string | null;
};

export type AgentAction = {
  id: string;
  session_id: string;
  action: string;
  timestamp: string;
};

export type WebSocketTicket = {
  ticket: string;
  user_id: string;
  session_id: string;
  expires_at: string;
};
