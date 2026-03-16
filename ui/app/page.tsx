import { redirect } from "next/navigation";
import { Box } from "@mui/material";

import { auth } from "@/lib/auth";
import { TopBar } from "@/components/layout/top-bar";
import { WorkspaceShell } from "@/components/layout/workspace-shell";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        bgcolor: "background.default",
        color: "text.primary",
        px: { xs: 2, md: 3 },
        py: { xs: 2, md: 3 },
      }}
    >
      <TopBar email={session.user.email} name={session.user.name} />
      <Box component="main" sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <WorkspaceShell token={session.accessToken} />
      </Box>
    </Box>
  );
}
