"use client";

import { useEffect, useMemo, useState } from "react";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { Button, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import { useWebSocketContext } from "@/components/providers/websocket-provider";
import { useChatStore } from "@/store/chat-store";
import { useMessageStore } from "@/store/message-store";
import { getActiveApprovalRequest } from "@/types/live-session";

type ApprovalAlertProps = {
  controlMode?: "agent" | "manual" | null;
};

export function ApprovalAlert({ controlMode = null }: ApprovalAlertProps) {
  const selectedChatId = useChatStore((state) => state.selectedChatId);
  const resolvedApprovalKeyByChatId = useChatStore((state) => state.resolvedApprovalKeyByChatId);
  const setResolvedApprovalKey = useChatStore((state) => state.setResolvedApprovalKey);
  const clearResolvedApprovalKey = useChatStore((state) => state.clearResolvedApprovalKey);
  const messages = useMessageStore((state) => state.messages);
  const startWaiting = useMessageStore((state) => state.startWaiting);
  const stopWaiting = useMessageStore((state) => state.stopWaiting);
  const setSendError = useMessageStore((state) => state.setSendError);
  const { sendJsonMessage, connectionStatus } = useWebSocketContext();
  const [pendingDecision, setPendingDecision] = useState<"accept" | "cancel" | null>(null);
  const resolvedApprovalKey = selectedChatId ? resolvedApprovalKeyByChatId[selectedChatId] ?? null : null;

  const approvalState = useMemo(
    () => getActiveApprovalRequest(messages, selectedChatId, controlMode, resolvedApprovalKey),
    [controlMode, messages, resolvedApprovalKey, selectedChatId],
  );

  useEffect(() => {
    setPendingDecision(null);
  }, [approvalState?.approvalKey]);

  if (controlMode !== "manual" || !selectedChatId || !approvalState) {
    return null;
  }

  const chatId = selectedChatId;
  const approvalKey = approvalState.approvalKey;

  async function handleDecision(command: "approve" | "cancel", decision: "accept" | "cancel") {
    if (connectionStatus !== "Open" || pendingDecision) {
      return;
    }

    try {
      setPendingDecision(decision);
      setResolvedApprovalKey(chatId, approvalKey);
      setSendError(null);
      startWaiting();
      sendJsonMessage({
        type: "text",
        sender: "user",
        data: command,
        timestamp: Date.now(),
      });
    } catch (error) {
      setPendingDecision(null);
      clearResolvedApprovalKey(chatId);
      stopWaiting();
      setSendError(error instanceof Error ? error.message : "Unable to submit approval decision");
    }
  }

  return (
    <Paper
      elevation={0}
      variant="outlined"
      sx={(theme) => ({
        borderRadius: 1.5,
        borderColor: alpha(theme.palette.warning.main, 0.4),
        bgcolor: alpha(theme.palette.warning.main, theme.palette.mode === "dark" ? 0.1 : 0.06),
        p: 2,
      })}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <WarningAmberRoundedIcon color="warning" fontSize="small" />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Approval required
          </Typography>
        </Stack>

        <Typography
          variant="body2"
          sx={{
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {approvalState.explanation}
        </Typography>

        <Typography variant="caption" color="text.secondary">
          Take over in the live UI if needed, then click Accept to let the agent continue or Cancel to stop the blocked action.
        </Typography>

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Button
            variant="contained"
            color="warning"
            onClick={() => void handleDecision("approve", "accept")}
            disabled={connectionStatus !== "Open" || pendingDecision !== null}
          >
            Accept
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => void handleDecision("cancel", "cancel")}
            disabled={connectionStatus !== "Open" || pendingDecision !== null}
          >
            Cancel
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
