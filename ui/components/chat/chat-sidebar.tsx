"use client";

import { useEffect, useState, type MouseEvent } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import KeyboardDoubleArrowLeftRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowLeftRounded";
import KeyboardDoubleArrowRightRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowRightRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import {
  Box,
  CircularProgress,
    Divider,
    IconButton,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Paper,
    Stack,
    Tooltip,
    Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import { useCreateChatSession, useDeleteChatSession, useChatSessions } from "@/hooks/use-chat-sessions";
import { useChatStore, type SessionAgentState } from "@/store/chat-store";

function SessionStatusBadge({ state }: { state: SessionAgentState }) {
  return (
    <Box
      sx={(theme) => ({
        position: "absolute",
        right: -4,
        bottom: -4,
        width: 18,
        height: 18,
        borderRadius: 999,
        border: "2px solid",
        borderColor: theme.palette.background.paper,
        bgcolor:
          state === "approval_required"
            ? theme.palette.warning.main
            : state === "working"
              ? alpha(theme.palette.info.main, 0.14)
              : theme.palette.success.main,
        color:
          state === "approval_required"
            ? theme.palette.warning.contrastText
            : state === "working"
              ? theme.palette.info.main
              : theme.palette.success.contrastText,
        display: "grid",
        placeItems: "center",
        boxShadow: theme.shadows[1],
      })}
    >
      {state === "approval_required" ? (
        <WarningAmberRoundedIcon sx={{ fontSize: 12 }} />
      ) : state === "working" ? (
        <CircularProgress size={10} thickness={6} color="inherit" />
      ) : (
        <CheckCircleRoundedIcon sx={{ fontSize: 12 }} />
      )}
    </Box>
  );
}

export function ChatSidebar({ token }: { token?: string }) {
  const {
    selectedChatId,
    setSelectedChatId,
    sidebarOpen,
    toggleSidebar,
    loadingViewerChatIds,
    sessionAgentStateById,
  } = useChatStore();
  const sessionsQuery = useChatSessions(token);
  const createSession = useCreateChatSession(token);
  const deleteSession = useDeleteChatSession(token);
  const [createMenuAnchor, setCreateMenuAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const sessions = sessionsQuery.data?.items ?? [];
    if (sessions.length === 0) {
      if (selectedChatId) {
        setSelectedChatId(null);
      }
      return;
    }

    const selectedExists = sessions.some((session) => session.id === selectedChatId);
    if (!selectedChatId || !selectedExists) {
      setSelectedChatId(sessions[0].id);
    }
  }, [selectedChatId, sessionsQuery.data?.items, setSelectedChatId]);

  function handleOpenCreateMenu(event: MouseEvent<HTMLElement>) {
    setCreateMenuAnchor(event.currentTarget);
  }

  function handleCloseCreateMenu() {
    setCreateMenuAnchor(null);
  }

  function handleCreateSession(controlMode: "agent" | "manual") {
    createSession.mutate({
      title: `New session ${new Date().toLocaleTimeString()}`,
      control_mode: controlMode,
    });
    handleCloseCreateMenu();
  }

  return (
    <Paper
      elevation={0}
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        p: 2,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Stack
        direction={sidebarOpen ? "row" : "column"}
        alignItems={sidebarOpen ? "center" : "center"}
        justifyContent="space-between"
        spacing={sidebarOpen ? 1 : 2}
        sx={{ mb: 1 }}
      >
        <Stack direction={sidebarOpen ? "row" : "column"} spacing={1} alignItems="center">
          {!sidebarOpen ? (
            <Tooltip title="Expand panel">
              <IconButton
                onClick={toggleSidebar}
                color="inherit"
                sx={{
                  width: 40,
                  height: 40,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: (theme) => alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.02 : 0.04),
                }}
              >
                <KeyboardDoubleArrowRightRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
          {sidebarOpen ? (
            <Tooltip title="Collapse panel">
              <IconButton
                onClick={toggleSidebar}
                color="inherit"
                sx={{
                  width: 40,
                  height: 40,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: (theme) => alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.02 : 0.04),
                }}
              >
                <KeyboardDoubleArrowLeftRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
        </Stack>

        {sidebarOpen ? (
          <>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.18em" }}>
                Browser
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Sessions
              </Typography>
            </Box>
            <Tooltip title="New chat">
              <IconButton
                color="primary"
                onClick={handleOpenCreateMenu}
                sx={{
                  width: 40,
                  height: 40,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: (theme) => alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.02 : 0.04),
                }}
              >
                <AddRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={createMenuAnchor}
              open={Boolean(createMenuAnchor)}
              onClose={handleCloseCreateMenu}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
            >
              <MenuItem onClick={() => handleCreateSession("agent")}>
                <ListItemText
                  primary="Agent session"
                  secondary="The agent proceeds automatically."
                />
              </MenuItem>
              <MenuItem onClick={() => handleCreateSession("manual")}>
                <ListItemText
                  primary="Manual session"
                  secondary="The user confirms sensitive steps."
                />
              </MenuItem>
            </Menu>
          </>
        ) : (
          <IconButton color="primary">
            <ChatBubbleOutlineRoundedIcon />
          </IconButton>
        )}
      </Stack>

      {sidebarOpen ? <Divider sx={{ mb: 1.5 }} /> : null}

      {!sidebarOpen ? (
        <Stack spacing={1.5} alignItems="center">
          {sessionsQuery.data?.items.map((session) => {
            const sessionAgentState = sessionAgentStateById[session.id];
            return (
            <Tooltip
              key={session.id}
              title={session.title}
            >
              <IconButton
                color={session.id === selectedChatId ? "primary" : "default"}
                onClick={() => setSelectedChatId(session.id)}
                sx={{
                  width: 48,
                  height: 48,
                  border: "1px solid",
                  borderColor: session.id === selectedChatId ? "primary.main" : "divider",
                  bgcolor: (theme) =>
                    session.id === selectedChatId ? alpha(theme.palette.primary.main, 0.12) : "transparent",
                }}
              >
                <Box sx={{ position: "relative", display: "grid", placeItems: "center" }}>
                  {loadingViewerChatIds.includes(session.id) ? (
                    <CircularProgress size={16} />
                  ) : (
                    <>
                      <ChatBubbleOutlineRoundedIcon fontSize="small" />
                      {sessionAgentState ? <SessionStatusBadge state={sessionAgentState} /> : null}
                    </>
                  )}
                </Box>
              </IconButton>
            </Tooltip>
            );
          })}
        </Stack>
      ) : sessionsQuery.isLoading ? (
        <Box sx={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <List sx={{ p: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1.25 }}>
          {sessionsQuery.data?.items.length === 0 ? (
            <Paper
              elevation={0}
              variant="outlined"
              sx={{
                borderRadius: 1.5,
                p: 2,
                bgcolor: "background.default",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                No browser sessions yet.
              </Typography>
            </Paper>
          ) : null}
          {sessionsQuery.data?.items.map((session) => {
            const viewerLoading = loadingViewerChatIds.includes(session.id);
            const sessionAgentState = sessionAgentStateById[session.id];
            return (
            <Box
              key={session.id}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                minHeight: 112,
                borderRadius: 1.5,
                border: "1px solid",
                borderColor: session.id === selectedChatId ? "primary.main" : "divider",
                bgcolor: (theme) =>
                  session.id === selectedChatId ? alpha(theme.palette.primary.main, 0.12) : "transparent",
              }}
            >
              <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                <ListItemButton
                  selected={session.id === selectedChatId}
                  onClick={() => setSelectedChatId(session.id)}
                  sx={{
                    borderRadius: 1.5,
                    px: 2,
                    pt: 1.75,
                    pb: 0.75,
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 44 }}>
                    <Box
                      sx={{
                        position: "relative",
                        width: 36,
                        height: 36,
                        borderRadius: 1,
                        display: "grid",
                        placeItems: "center",
                        bgcolor: (theme) =>
                          alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.04 : 0.06),
                      }}
                    >
                      <ChatBubbleOutlineRoundedIcon fontSize="small" />
                      {!viewerLoading && sessionAgentState ? <SessionStatusBadge state={sessionAgentState} /> : null}
                    </Box>
                  </ListItemIcon>
                  <ListItemText
                    primary={session.title}
                    secondary={new Date(session.updated_at).toLocaleString()}
                    primaryTypographyProps={{ fontWeight: 500 }}
                    secondaryTypographyProps={{ color: "text.secondary", noWrap: true }}
                  />
                </ListItemButton>

                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    pb: 0.5,
                    gap: 1,
                  }}
                >
                  <Box sx={{ minHeight: 28, display: "flex", alignItems: "center" }}>
                    {viewerLoading ? (
                      <Box
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.75,
                          height: 28,
                          px: 1,
                          borderRadius: 999,
                          border: "1px solid",
                          borderColor: "primary.main",
                          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                          color: "primary.main",
                        }}
                      >
                        <CircularProgress size={12} thickness={6} color="inherit" />
                        <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: "0.04em" }}>
                          Booting viewer
                        </Typography>
                      </Box>
                    ) : null}
                  </Box>
                  <Tooltip title="Delete session">
                    <IconButton
                      size="small"
                      color="inherit"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteSession.mutate(session.id);
                      }}
                      sx={{
                        width: 28,
                        height: 28,
                        mr: 0.5,
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Stack>
            </Box>
            );
          })}
        </List>
      )}
    </Paper>
  );
}
