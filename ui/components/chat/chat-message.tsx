"use client";

import { useState } from "react";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import SupportAgentRoundedIcon from "@mui/icons-material/SupportAgentRounded";
import Collapse from "@mui/material/Collapse";
import { Avatar, Box, Chip, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import { alpha, type Theme } from "@mui/material/styles";

import type {
  AudioData,
  FunctionCallData,
  FunctionProgressData,
  FunctionResponseData,
  LiveChatMessage,
} from "@/types/live-session";
import { getLiveMessageText } from "@/types/live-session";

type ChatMessageProps = {
  message: LiveChatMessage;
  canResend?: boolean;
  onResend?: () => void;
  functionCallStatus?: "running" | "completed";
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

function ExpandableJson({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Stack spacing={1}>
      <Tooltip title={open ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}>
        <Chip
          clickable
          icon={<ExpandMoreRoundedIcon sx={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />}
          label={label}
          onClick={() => setOpen((current) => !current)}
          variant="outlined"
          sx={{ alignSelf: "flex-start" }}
        />
      </Tooltip>
      <Collapse in={open} unmountOnExit>
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 1.5,
            borderRadius: 1,
            overflowX: "auto",
            bgcolor: (theme) => alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.05 : 0.06),
            fontSize: 12,
          }}
        >
          {formatJson(value)}
        </Box>
      </Collapse>
    </Stack>
  );
}

function renderMessageBody(
  message: LiveChatMessage,
  functionCallStatus: "running" | "completed",
) {
  const text = getLiveMessageText(message);
  if (text) {
    return (
      <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
        {text}
      </Typography>
    );
  }

  if (message.type === "function_call" && message.data && typeof message.data === "object") {
    const data = message.data as FunctionCallData;
    return (
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Chip
            icon={<CodeRoundedIcon />}
            label={`Function call: ${data.name}`}
            size="small"
            sx={{ alignSelf: "flex-start" }}
          />
          <Chip
            label={functionCallStatus === "completed" ? "Completed" : "Running"}
            size="small"
            color={functionCallStatus === "completed" ? "success" : "warning"}
            variant="outlined"
          />
        </Stack>
        <ExpandableJson label="Arguments" value={data.arguments} />
      </Stack>
    );
  }

  if (message.type === "function_response" && message.data && typeof message.data === "object") {
    const data = message.data as FunctionResponseData;
    return (
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Chip
            icon={<CodeRoundedIcon />}
            label={data.name}
            size="small"
            sx={{ alignSelf: "flex-start" }}
          />
        </Stack>
        <ExpandableJson label="Response" value={data.response ?? ""} />
      </Stack>
    );
  }

  if (message.type === "function_progress" && message.data && typeof message.data === "object") {
    const data = message.data as FunctionProgressData;
    return (
      <Stack spacing={0.5}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {data.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {data.message}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {`${data.percentage}% (${data.progress}/${data.total})`}
        </Typography>
      </Stack>
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

  async function handleCopy() {
    if (!messageText) {
      return;
    }
    await navigator.clipboard.writeText(messageText);
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
          {message.sender === "model" && messageText ? (
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
