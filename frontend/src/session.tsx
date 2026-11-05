import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { request } from "./api";
import type { PortalSession } from "./types";

interface SessionContextValue {
  session?: PortalSession;
  error?: Error;
  refresh: () => Promise<PortalSession>;
  update: (session: PortalSession) => void;
}
const SessionContext = createContext<SessionContextValue | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, update] = useState<PortalSession>();
  const [error, setError] = useState<Error>();
  async function refresh() {
    const value = await request<PortalSession>("session");
    update(value);
    setError(undefined);
    return value;
  }
  useEffect(() => {
    refresh().catch((error: Error) => setError(error));
  }, []);
  return (
    <SessionContext.Provider value={{ session, error, refresh, update }}>
      {children}
    </SessionContext.Provider>
  );
}
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("Session provider is required.");
  return value;
}
