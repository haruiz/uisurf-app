"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CircularProgress from "@mui/material/CircularProgress";
import DesktopWindowsRoundedIcon from "@mui/icons-material/DesktopWindowsRounded";
import { Box, Divider, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

const IFRAME_LOAD_TIMEOUT_MS = 15000;

export function VncPanel({
  chatId,
  viewerUrl,
  viewerPending = false,
  onStatusChange,
}: {
  chatId?: string | null;
  viewerUrl?: string | null;
  viewerPending?: boolean;
  onStatusChange?: (status: "idle" | "probing" | "ready" | "error") => void;
}) {
  const [viewerState, setViewerState] = useState<"idle" | "probing" | "ready" | "error">("idle");
  const loadTimeoutRef = useRef<number | null>(null);

  const resolvedViewerUrl = useMemo(() => {
    if (!viewerUrl) {
      return null;
    }

    try {
      const url = new URL(viewerUrl);
      url.searchParams.set("autoconnect", "1");
      if (!url.searchParams.has("resize")) {
        url.searchParams.set("resize", "scale");
      }
      return url.toString();
    } catch {
      const separator = viewerUrl.includes("?") ? "&" : "?";
      return `${viewerUrl}${separator}autoconnect=1&resize=scale`;
    }
  }, [viewerUrl]);

  useEffect(() => {
    if (loadTimeoutRef.current !== null) {
      window.clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }

    if (viewerPending && !resolvedViewerUrl) {
      setViewerState("probing");
      return;
    }

    if (!resolvedViewerUrl) {
      setViewerState("idle");
      return;
    }

    setViewerState("probing");

    loadTimeoutRef.current = window.setTimeout(() => {
      setViewerState((current) => (current === "ready" ? current : "error"));
      loadTimeoutRef.current = null;
    }, IFRAME_LOAD_TIMEOUT_MS);

    return () => {
      if (loadTimeoutRef.current !== null) {
        window.clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    };
  }, [resolvedViewerUrl, viewerPending]);

  useEffect(() => {
    if (!chatId) {
      return;
    }
    onStatusChange?.(viewerState);
  }, [chatId, onStatusChange, viewerState]);

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
      <Stack spacing={2.5} sx={{ height: "100%" }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.18em" }}>
            Remote
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Browser Viewer
          </Typography>
        </Box>

        <Divider />

        <Stack spacing={2.5} sx={{ flex: 1, minHeight: 0 }}>
          <Paper
            variant="outlined"
            sx={{
              flex: 1,
              minHeight: 0,
              position: "relative",
              borderRadius: 1.5,
              bgcolor: (theme) => alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.02 : 0.04),
              borderStyle: "dashed",
              overflow: "hidden",
            }}
          >
            {resolvedViewerUrl ? (
              <>
                <Box
                  component="iframe"
                  src={resolvedViewerUrl}
                  title="Browser Viewer"
                  onLoad={() => {
                    if (loadTimeoutRef.current !== null) {
                      window.clearTimeout(loadTimeoutRef.current);
                      loadTimeoutRef.current = null;
                    }
                    setViewerState("ready");
                  }}
                  onError={() => {
                    if (loadTimeoutRef.current !== null) {
                      window.clearTimeout(loadTimeoutRef.current);
                      loadTimeoutRef.current = null;
                    }
                    setViewerState("error");
                  }}
                  sx={{
                    width: "100%",
                    height: "100%",
                    border: 0,
                    bgcolor: "background.default",
                  }}
                />
                {viewerState !== "ready" ? (
                  <Stack
                    spacing={2}
                    alignItems="center"
                    justifyContent="center"
                    sx={{
                      position: "absolute",
                      inset: 0,
                      bgcolor: (theme) => alpha(theme.palette.background.paper, 0.88),
                    }}
                  >
                    <CircularProgress size={28} />
                    <Typography variant="subtitle1">Starting browser viewer</Typography>
                    <Typography variant="body2" color="text.secondary" textAlign="center" maxWidth={320}>
                      {viewerState === "error"
                        ? "The viewer loaded slowly or could not be embedded."
                        : "Waiting for the embedded VNC session to finish loading."}
                    </Typography>
                  </Stack>
                ) : null}
              </>
            ) : (
              <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ height: "100%" }}>
                {resolvedViewerUrl || viewerPending ? <CircularProgress size={28} /> : <DesktopWindowsRoundedIcon color="primary" sx={{ fontSize: 44 }} />}
                <Typography variant="subtitle1">
                  {resolvedViewerUrl || viewerPending ? "Starting browser viewer" : "Current VNC viewer"}
                </Typography>
                <Typography variant="body2" color="text.secondary" textAlign="center" maxWidth={320}>
                  {resolvedViewerUrl || viewerPending
                    ? viewerState === "error"
                      ? "The viewer is taking longer than expected to respond."
                      : "Waiting for the VNC session to become available."
                    : "Render the active remote viewer here."}
                </Typography>
              </Stack>
            )}
          </Paper>
        </Stack>
      </Stack>
    </Paper>
  );
}
