import { createTheme } from "@mui/material/styles";

export type AppThemeMode = "light" | "dark";

export function buildAppTheme(mode: AppThemeMode) {
  const isDark = mode === "dark";
  const primaryMain = isDark ? "#4285f4" : "#3b82f6";
  const secondaryMain = isDark ? "#a142f4" : "#8b5cf6";
  const warningMain = "#fbbc04";
  const successMain = "#16c47f";
  const errorMain = "#ea4335";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: primaryMain,
      },
      secondary: {
        main: secondaryMain,
      },
      success: {
        main: successMain,
      },
      error: {
        main: errorMain,
      },
      warning: {
        main: warningMain,
      },
      background: {
        default: isDark ? "#060b16" : "#f7f9ff",
        paper: isDark ? "#0d1526" : "#ffffff",
      },
      text: {
        primary: isDark ? "#edf2ff" : "#18253f",
        secondary: isDark ? "#9aa8c4" : "#64748b",
      },
    },
  shape: {
    borderRadius: 6,
  },
  typography: {
    fontFamily: "var(--font-work-sans), sans-serif",
    h1: {
      fontFamily: "var(--font-space-grotesk), sans-serif",
      fontWeight: 700,
    },
    h2: {
      fontFamily: "var(--font-space-grotesk), sans-serif",
      fontWeight: 700,
    },
    h3: {
      fontFamily: "var(--font-space-grotesk), sans-serif",
      fontWeight: 700,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          height: "100%",
          backgroundColor: isDark ? "#060b16" : "#f7f9ff",
          colorScheme: mode,
        },
        body: {
          minHeight: "100vh",
          backgroundColor: isDark ? "#060b16" : "#f7f9ff",
          color: isDark ? "#edf2ff" : "#18253f",
          backgroundImage: isDark
            ? "radial-gradient(circle at top left, rgba(66, 133, 244, 0.28), transparent 30%), radial-gradient(circle at top right, rgba(161, 66, 244, 0.2), transparent 24%), radial-gradient(circle at 65% 100%, rgba(22, 196, 127, 0.16), transparent 28%), linear-gradient(180deg, #060b16 0%, #0b1325 100%)"
            : "radial-gradient(circle at top left, rgba(66, 133, 244, 0.18), transparent 28%), radial-gradient(circle at top right, rgba(161, 66, 244, 0.14), transparent 22%), radial-gradient(circle at 70% 100%, rgba(22, 196, 127, 0.12), transparent 24%), radial-gradient(circle at 35% -10%, rgba(251, 188, 4, 0.1), transparent 20%), linear-gradient(180deg, #fbfcff 0%, #eef3ff 100%)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(19,32,51,0.08)",
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 6,
          textTransform: "none",
          fontWeight: 600,
        },
        containedPrimary: {
          backgroundImage: isDark
            ? "linear-gradient(135deg, #4285f4 0%, #7b61ff 100%)"
            : "linear-gradient(135deg, #4285f4 0%, #8b5cf6 100%)",
          color: "#ffffff",
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(19,32,51,0.03)",
          "&.Mui-disabled": {
            backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(19,32,51,0.03)",
          },
        },
        notchedOutline: {
          borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(19,32,51,0.08)",
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        input: {
          "&.Mui-disabled": {
            WebkitTextFillColor: isDark ? "rgba(229, 238, 247, 0.72)" : "rgba(19, 32, 51, 0.72)",
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          textTransform: "none",
          fontWeight: 600,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },
  },
});
}
