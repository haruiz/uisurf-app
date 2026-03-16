"use client";

import { Box, CircularProgress, Paper, Skeleton, Stack, Typography } from "@mui/material";

import { useMessageStore } from "@/store/message-store";
import { getLiveMessageText } from "@/types/live-session";

import { ChatMessage } from "./chat-message";

type ChatHistoryProps = {
  chatId: string | null;
  onResendMessage?: (messageText: string) => void;
  canResend?: boolean;
};

export function ChatHistory({ chatId, onResendMessage, canResend = false }: ChatHistoryProps) {
  const messages = useMessageStore((state) => state.messages);
  const isLoadingHistory = useMessageStore((state) => state.isLoadingHistory);
  const isWaitingForResponse = useMessageStore((state) => state.isWaitingForResponse);
  const completedFunctionNames = new Set(
    messages
      .filter((message) => message.type === "function_response" && message.data && typeof message.data === "object" && "name" in message.data)
      .map((message) => String(message.data.name)),
  );
  const latestUserTextMessageId =
    [...messages]
      .reverse()
      .find((message) => message.sender === "user" && message.type === "text" && getLiveMessageText(message))?.id ??
    null;

  if (!chatId) {
    return (
      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          borderRadius: 1.5,
          p: 3,
          bgcolor: "background.default",
        }}
      >
        <Stack spacing={1}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Waiting for conversation to start
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create a browser session to begin the first chat.
          </Typography>
        </Stack>
      </Paper>
    );
  }

  if (isLoadingHistory) {
    return (
      <Stack spacing={2}>
        <Paper
          elevation={0}
          variant="outlined"
          sx={{
            borderRadius: 1.5,
            p: 2.5,
            bgcolor: "background.default",
          }}
        >
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Skeleton variant="circular" width={40} height={40} />
            <Stack spacing={1.2} sx={{ flex: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Skeleton variant="text" width={64} height={24} />
                <Skeleton variant="rounded" width={48} height={24} />
              </Stack>
              <Skeleton variant="text" width="82%" height={30} />
              <Skeleton variant="text" width="74%" height={30} />
              <Skeleton variant="text" width="58%" height={30} />
            </Stack>
          </Stack>
        </Paper>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">
            Loading messages
          </Typography>
        </Box>
      </Stack>
    );
  }

  if (!messages.length) {
    return (
      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          borderRadius: 1.5,
          p: 3,
          bgcolor: "background.default",
        }}
      >
        <Stack spacing={1}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            No messages yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Start with a clear instruction, expected outcome, or the next browser step you want the agent to take.
          </Typography>
        </Stack>
      </Paper>
    );
  }

  return (
    <Box
      sx={{
        height: "100%",
        minHeight: 0,
        overflowY: "auto",
        pr: 0.75,
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(142, 160, 184, 0.45) transparent",
        "&::-webkit-scrollbar": {
          width: 10,
        },
        "&::-webkit-scrollbar-track": {
          background: "transparent",
        },
        "&::-webkit-scrollbar-thumb": {
          borderRadius: 999,
          backgroundColor: "rgba(142, 160, 184, 0.35)",
          border: "2px solid transparent",
          backgroundClip: "padding-box",
        },
        "&:hover::-webkit-scrollbar-thumb": {
          backgroundColor: "rgba(142, 160, 184, 0.55)",
        },
      }}
    >
      <Stack spacing={2} sx={{ minHeight: "100%" }}>
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            canResend={canResend && message.id === latestUserTextMessageId}
            functionCallStatus={
              message.type === "function_call" &&
              message.data &&
              typeof message.data === "object" &&
              "name" in message.data &&
              completedFunctionNames.has(String(message.data.name))
                ? "completed"
                : "running"
            }
            onResend={
              onResendMessage
                ? () => {
                    const text = getLiveMessageText(message);
                    if (text) {
                      onResendMessage(text);
                    }
                  }
                : undefined
            }
          />
        ))}
        {isWaitingForResponse ? (
          <Paper
            elevation={0}
            variant="outlined"
            sx={{
              borderRadius: 1.5,
              p: 2,
              bgcolor: "background.default",
              overflow: "hidden",
            }}
          >
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.65,
                  px: 0.25,
                  "& span": {
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    bgcolor: "rgba(229, 238, 247, 0.78)",
                    animation: "thinkingDots 1.25s ease-in-out infinite",
                  },
                  "& span:nth-of-type(1)": {
                    animationDelay: "0s",
                  },
                  "& span:nth-of-type(2)": {
                    animationDelay: "0.16s",
                  },
                  "& span:nth-of-type(3)": {
                    animationDelay: "0.32s",
                  },
                  "@keyframes thinkingDots": {
                    "0%, 100%": {
                      transform: "translateY(0) scale(0.85)",
                      opacity: 0.3,
                    },
                    "40%": {
                      transform: "translateY(-3px) scale(1)",
                      opacity: 0.95,
                    },
                    "60%": {
                      transform: "translateY(0) scale(0.92)",
                      opacity: 0.55,
                    },
                  },
                }}
              >
                <Box component="span" />
                <Box component="span" />
                <Box component="span" />
              </Box>
              <Stack spacing={0.15}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Thinking
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Generating a response
                </Typography>
              </Stack>
            </Stack>
          </Paper>
        ) : null}
      </Stack>
    </Box>
  );
}
