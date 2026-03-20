"use client";

import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import SupportAgentRoundedIcon from "@mui/icons-material/SupportAgentRounded";
import { Avatar, Box, Chip, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import { alpha, type Theme } from "@mui/material/styles";

import type {
  AgentActivityStatus,
  AudioData,
  LiveChatMessage,
} from "@/types/live-session";
import { getAgentActivityModel, getLiveMessageText } from "@/types/live-session";

import { AgentActivityCard } from "./agent-activity-card";
import { MarkdownMessage } from "./markdown-message";

type ChatMessageProps = {
  message: LiveChatMessage;
  canResend?: boolean;
  onResend?: () => void;
  functionCallStatus?: AgentActivityStatus;
};

function getMessagePresentation(sender: LiveChatMessage["sender"]) {
  switch (sender) {
    case "model":
      return {
        label: "Model",
        icon: <SmartToyRoundedIcon fontSize="small" />,
        avatarColor: "primary.main",
        backgroundColor: (theme: Theme) =>
          alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.03 : 0.04),
      };
    case "user":
      return {
        label: "You",
        icon: <PersonRoundedIcon fontSize="small" />,
        avatarColor: "secondary.main",
        backgroundColor: (theme: Theme) => alpha(theme.palette.primary.main, 0.1),
      };
    default:
      return {
        label: "System",
        icon: <SupportAgentRoundedIcon fontSize="small" />,
        avatarColor: "warning.main",
        backgroundColor: (theme: Theme) => alpha(theme.palette.warning.main, 0.1),
      };
  }
}

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function renderMessageBody(
  message: LiveChatMessage,
  functionCallStatus: AgentActivityStatus,
) {
  const activity = getAgentActivityModel(message, functionCallStatus);
  if (activity) {
    return <AgentActivityCard activity={activity} />;
  }

  const text = getLiveMessageText(message);
  if (text) {
    if (message.sender === "model" && message.type === "text") {
      return <MarkdownMessage content={text} />;
    }

    return (
      <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
        {text}
      </Typography>
    );
  }

  if (message.type === "audio" && message.data && typeof message.data === "object") {
    const data = message.data as AudioData;
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <GraphicEqRoundedIcon fontSize="small" />
        <Typography variant="body2">
          {data.speech_mode === "narration" ? "Narration audio received" : "Conversation audio received"}
        </Typography>
      </Stack>
    );
  }

  if (message.type === "turn_complete") {
    return (
      <Typography variant="body2" color="text.secondary">
        Turn complete.
      </Typography>
    );
  }

  return (
    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
      {formatJson(message.data)}
    </Typography>
  );
}

export function ChatMessage({
  message,
  canResend = false,
  onResend,
  functionCallStatus = "running",
}: ChatMessageProps) {
  const presentation = getMessagePresentation(message.sender);
  const messageText = getLiveMessageText(message);
  const activity = getAgentActivityModel(message, functionCallStatus);
  const copyValue =
    messageText ?? (activity && message.sender === "model" ? formatJson(activity.raw) : null);

  async function handleCopy() {
    if (!copyValue) {
      return;
    }
    await navigator.clipboard.writeText(copyValue);
  }

  return (
    <Paper
      elevation={0}
      variant="outlined"
      sx={{
        borderRadius: 1.5,
        p: 2.5,
        bgcolor: presentation.backgroundColor,
      }}
    >
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <Avatar
          sx={(theme) => ({
            bgcolor: presentation.avatarColor,
            color: theme.palette.getContrastText(
              presentation.avatarColor === "warning.main"
                ? theme.palette.warning.main
                : presentation.avatarColor === "secondary.main"
                  ? theme.palette.secondary.main
                  : theme.palette.primary.main,
            ),
          })}
        >
          {presentation.icon}
        </Avatar>
        <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2">{presentation.label}</Typography>
            <Chip label={message.type.replaceAll("_", " ")} size="small" variant="outlined" />
          </Stack>
          {renderMessageBody(message, functionCallStatus)}
          {message.sender === "user" && canResend && onResend ? (
            <Stack direction="row" justifyContent="flex-end">
              <Tooltip title="Resend message">
                <IconButton
                  size="small"
                  color="inherit"
                  onClick={onResend}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <ReplayRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          ) : null}
          {message.sender === "model" && copyValue ? (
            <Stack direction="row" justifyContent="flex-end">
              <Tooltip title="Copy message">
                <IconButton
                  size="small"
                  color="inherit"
                  onClick={() => void handleCopy()}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <ContentCopyRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  );
}
