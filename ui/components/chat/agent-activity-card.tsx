"use client";

import { useState } from "react";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import DesktopWindowsRoundedIcon from "@mui/icons-material/DesktopWindowsRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import Collapse from "@mui/material/Collapse";
import { Box, Chip, IconButton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import type { AgentActivityKind, AgentActivityModel } from "@/types/live-session";

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getStatusPresentation(status: AgentActivityModel["status"]) {
  switch (status) {
    case "completed":
      return {
        label: "Completed",
        color: "success" as const,
        icon: <CheckCircleRoundedIcon fontSize="small" />,
      };
    case "failed":
      return {
        label: "Failed",
        color: "error" as const,
        icon: <ErrorOutlineRoundedIcon fontSize="small" />,
      };
    default:
      return {
        label: "Running",
        color: "warning" as const,
        icon: (
          <SyncRoundedIcon
            fontSize="small"
            sx={{
              animation: "activitySpin 1.2s linear infinite",
              "@keyframes activitySpin": {
                from: { transform: "rotate(0deg)" },
                to: { transform: "rotate(360deg)" },
              },
            }}
          />
        ),
      };
  }
}

function getKindIcon(kind: AgentActivityKind) {
  switch (kind) {
    case "function_call":
    case "function_response":
      return <CodeRoundedIcon fontSize="small" />;
    case "progress":
    case "task_update":
      return <TimelineRoundedIcon fontSize="small" />;
    default:
      return <SmartToyRoundedIcon fontSize="small" />;
  }
}

function getKindLabel(kind: AgentActivityKind) {
  switch (kind) {
    case "function_call":
      return "Function call";
    case "function_response":
      return "Function response";
    case "task_update":
      return "Task update";
    case "progress":
      return "Progress";
    case "thought":
      return "Thought";
    case "message":
      return "Message";
    default:
      return "Agent event";
  }
}

function getAgentChipIcon(agentName: string | null) {
  const normalized = agentName?.trim().toLowerCase() ?? "";
  if (!normalized) {
    return null;
  }

  if (normalized.includes("browser")) {
    return <LanguageRoundedIcon fontSize="small" />;
  }

  if (normalized.includes("desktop")) {
    return <DesktopWindowsRoundedIcon fontSize="small" />;
  }

  return <SmartToyRoundedIcon fontSize="small" />;
}

export function AgentActivityCard({ activity }: { activity: AgentActivityModel }) {
  const [open, setOpen] = useState(activity.status === "failed");
  const status = getStatusPresentation(activity.status);
  const showStatusChip = activity.kind !== "thought";
  const agentChipIcon = getAgentChipIcon(activity.agentName);

  return (
    <Box
      sx={(theme) => ({
        width: "100%",
        minWidth: 0,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor:
          activity.kind === "thought"
            ? alpha(theme.palette.divider, 0.8)
            : activity.status === "failed"
            ? alpha(theme.palette.error.main, 0.35)
            : activity.status === "completed"
              ? alpha(theme.palette.success.main, 0.28)
              : alpha(theme.palette.warning.main, 0.3),
        bgcolor:
          activity.kind === "thought"
            ? alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.035 : 0.03)
            : activity.status === "failed"
            ? alpha(theme.palette.error.main, 0.07)
            : activity.status === "completed"
              ? alpha(theme.palette.success.main, 0.06)
              : alpha(theme.palette.warning.main, 0.08),
        p: 1.5,
      })}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ minWidth: 0 }}>
            <Chip icon={getKindIcon(activity.kind)} label={getKindLabel(activity.kind)} size="small" />
            {showStatusChip ? (
              <Chip
                icon={status.icon}
                label={status.label}
                size="small"
                color={status.color}
                variant="outlined"
              />
            ) : null}
            {activity.agentName ? (
              <Chip
                icon={agentChipIcon ?? undefined}
                label={activity.agentName}
                size="small"
                variant="outlined"
                sx={{ borderStyle: "dashed" }}
              />
            ) : null}
          </Stack>
          <IconButton
            size="small"
            color="inherit"
            onClick={() => setOpen((current) => !current)}
            aria-label={open ? "Hide activity details" : "Show activity details"}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          >
            <ExpandMoreRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Stack spacing={0.35} sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {activity.title}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
            }}
          >
            {activity.summary}
          </Typography>
        </Stack>

        {activity.functionName || activity.taskId || activity.contextId ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ minWidth: 0 }}>
            {activity.functionName ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
              >
                Function: {activity.functionName}
              </Typography>
            ) : null}
            {activity.taskId ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
              >
                Task: {activity.taskId}
              </Typography>
            ) : null}
            {activity.contextId ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
              >
                Context: {activity.contextId}
              </Typography>
            ) : null}
          </Stack>
        ) : null}

        <Collapse in={open} unmountOnExit>
          <Box
            component="pre"
            sx={(theme) => ({
              m: 0,
              p: 1.5,
              borderRadius: 1.25,
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
              bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.08 : 0.06),
              fontSize: 12,
              lineHeight: 1.45,
            })}
          >
            {formatJson(activity.details)}
          </Box>
        </Collapse>
      </Stack>
    </Box>
  );
}
