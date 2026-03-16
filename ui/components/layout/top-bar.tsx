"use client";

import { useMemo, useState } from "react";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import {
  AppBar,
  Avatar,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { signOut } from "next-auth/react";

import { useThemeMode } from "@/components/layout/providers";

export function TopBar({ email, name }: { email?: string | null; name?: string | null }) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const theme = useTheme();
  const { mode, toggleMode } = useThemeMode();

  const initials = useMemo(() => {
    const source = name || email || "U";
    return source
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [email, name]);

  return (
    <AppBar
      position="static"
      color="transparent"
      elevation={0}
      sx={{
        mb: 2,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1.5,
        backgroundColor:
          mode === "dark"
            ? alpha(theme.palette.background.paper, 0.9)
            : alpha(theme.palette.background.paper, 0.82),
        backdropFilter: "blur(18px)",
      }}
    >
      <Toolbar sx={{ minHeight: 76, justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Avatar
            sx={{
              backgroundImage:
                mode === "dark"
                  ? "linear-gradient(135deg, #4285f4 0%, #16c47f 55%, #a142f4 100%)"
                  : "linear-gradient(135deg, #4285f4 0%, #1fb6ff 45%, #8b5cf6 100%)",
              color: "#ffffff",
            }}
          >
            <SmartToyRoundedIcon />
          </Avatar>
          <Box>
            <Typography
              variant="overline"
              sx={{
                letterSpacing: "0.28em",
                backgroundImage:
                  mode === "dark"
                    ? "linear-gradient(90deg, #4285f4 0%, #16c47f 45%, #a142f4 100%)"
                    : "linear-gradient(90deg, #4285f4 0%, #22c55e 45%, #8b5cf6 100%)",
                backgroundClip: "text",
                color: "transparent",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              AGENTS WORKSPACE
            </Typography>
            <Typography variant="h6" sx={{ lineHeight: 1.1 }}>
              UISurf Agentic Platform
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ display: { xs: "none", sm: "block" }, textAlign: "right" }}>
            <Typography variant="body2">{name || "Workspace user"}</Typography>
            <Typography variant="caption" color="text.secondary">
              {email}
            </Typography>
          </Box>
          <IconButton
            aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleMode}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              bgcolor: theme.palette.background.paper,
            }}
          >
            {mode === "dark" ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
          </IconButton>
          <IconButton onClick={(event) => setAnchorEl(event.currentTarget)} sx={{ p: 0 }}>
            <Avatar
              sx={{
                bgcolor: "secondary.main",
                color: theme.palette.getContrastText(theme.palette.secondary.main),
              }}
            >
              {initials}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            PaperProps={{
              sx: {
                mt: 1,
                minWidth: 180,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
              },
            }}
          >
            <MenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              sx={{ gap: 1.5 }}
            >
              <LogoutRoundedIcon fontSize="small" />
              Close session
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
