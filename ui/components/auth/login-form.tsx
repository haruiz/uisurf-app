"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { signInWithEmailAndPassword } from "firebase/auth";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { firebaseAuth } from "@/lib/firebase/client";
import { type LoginValues, loginSchema } from "@/lib/validators";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);

    try {
      const credential = await signInWithEmailAndPassword(
        firebaseAuth,
        values.email,
        values.password,
      );
      const idToken = await credential.user.getIdToken();
      const result = await signIn("credentials", {
        idToken,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
        return;
      }

      router.replace("/");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to sign in right now.",
      );
    }
  });

  return (
    <Paper
      elevation={0}
      sx={{
        width: "100%",
        maxWidth: 460,
        p: 4,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Stack component="form" spacing={3} onSubmit={onSubmit}>
        <Box>
          <Typography variant="overline" sx={{ letterSpacing: "0.25em", color: "primary.main" }}>
            UISURF AGENTIC PLATFORM
          </Typography>
          <Typography variant="h4">Sign in</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Continue to your workspace.
          </Typography>
        </Box>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <TextField
          label="Email"
          type="email"
          placeholder="you@example.com"
          InputLabelProps={{ shrink: true }}
          error={Boolean(errors.email)}
          helperText={errors.email?.message}
          {...register("email")}
        />
        <TextField
          label="Password"
          type="password"
          placeholder="Enter your password"
          InputLabelProps={{ shrink: true }}
          error={Boolean(errors.password)}
          helperText={errors.password?.message}
          {...register("password")}
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={isSubmitting}
          endIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : null}
        >
          Enter Workspace
        </Button>
      </Stack>
    </Paper>
  );
}
