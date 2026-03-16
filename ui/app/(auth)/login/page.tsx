import { Box, Stack } from "@mui/material";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { auth } from "@/lib/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user && session.accessToken) {
    redirect("/");
  }

  return (
    <Box
      component="main"
      sx={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        px: 3,
        py: 6,
      }}
    >
      <Stack alignItems="center" justifyContent="center" sx={{ width: "100%" }}>
        <LoginForm />
      </Stack>
    </Box>
  );
}
