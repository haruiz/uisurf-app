"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";

const useAccessToken = () => {
  const { data: session, status: authStatus } = useSession();

  return useMemo(() => {
    const sessionUsrToken = session?.accessToken;
    const usrIsAuthenticated = authStatus === "authenticated" && !!sessionUsrToken;
    return usrIsAuthenticated ? sessionUsrToken : null;
  }, [session, authStatus]);
};

export default useAccessToken;
