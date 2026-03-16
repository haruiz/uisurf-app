"use client";

import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import { Box, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";

type ChatToolBoxProps = {
  connectionStatus: string;
  onRestartConnection: () => void;
  onClearMessages: () => void;
};

function getConnectionTone(connectionStatus: string) {
  switch (connectionStatus) {
    case "Open":
      return {
        label: "Connected",
        accent: "#2dd4bf",
        glow: "rgba(45, 212, 191, 0.18)",
      };
    case "Connecting":
      return {
        label: "Connecting",
        accent: "#f59e0b",
        glow: "rgba(245, 158, 11, 0.18)",
      };
    case "Closed":
    case "Closing":
      return {
        label: "Offline",
        accent: "#fb7185",
        glow: "rgba(251, 113, 133, 0.18)",
      };
    default:
      return {
        label: "Idle",
        accent: "#8ea0b8",
        glow: "rgba(142, 160, 184, 0.18)",
      };
  }
}

export function ChatToolBox({
  connectionStatus,
  onRestartConnection,
  onClearMessages,
}: ChatToolBoxProps) {
  const tone = getConnectionTone(connectionStatus);

  return (
    <Paper
      elevation={0}
      variant="outlined"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
        borderRadius: 1.5,
        p: 1.25,
        bgcolor: "background.paper",
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Box
          sx={{
            position: "relative",
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: tone.accent,
            boxShadow: `0 0 0 4px ${tone.glow}`,
            "&::after": {
              content: '""',
              position: "absolute",
              inset: -4,
              borderRadius: "50%",
              border: `1px solid ${tone.glow}`,
              opacity: connectionStatus === "Open" || connectionStatus === "Connecting" ? 1 : 0,
              animation:
                connectionStatus === "Open" || connectionStatus === "Connecting"
                  ? "statusPulse 1.8s ease-out infinite"
                  : "none",
            },
            "@keyframes statusPulse": {
              "0%": { transform: "scale(0.85)", opacity: 0.95 },
              "70%": { transform: "scale(1.7)", opacity: 0 },
              "100%": { transform: "scale(1.7)", opacity: 0 },
            },
          }}
        />
        <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>
          {tone.label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {connectionStatus}
        </Typography>
      </Stack>

      <Stack direction="row" spacing={1}>
        <Tooltip title="Restart connection">
          <IconButton
            color="inherit"
            aria-label="Restart connection"
            onClick={onRestartConnection}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "transparent",
            }}
          >
            <SyncRoundedIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Clear chat history">
          <IconButton
            color="inherit"
            aria-label="Clear chat history"
            onClick={onClearMessages}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "transparent",
            }}
          >
            <DeleteSweepRoundedIcon />
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );
}
