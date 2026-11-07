import React, { createContext, useContext, useMemo, useState } from 'react';

type Session = {
  /** The email the student signed in with, or null before they have. */
  email: string | null;
  signIn: (email: string) => void;
  signOut: () => void;
};

const SessionContext = createContext<Session | null>(null);

/**
 * Who is signed in. Log in is the app's front door, but there are no accounts
 * yet (US-19 needs the server and the database), so signing in only records
 * the email for as long as the app is open. Any valid-looking email and
 * password let the student in, and nothing is stored or sent anywhere.
 */
export function SessionProvider({
  children,
  initialEmail = null,
}: {
  children: React.ReactNode;
  /** Lets tests start signed in. */
  initialEmail?: string | null;
}) {
  const [email, setEmail] = useState<string | null>(initialEmail);

  const value = useMemo<Session>(
    () => ({ email, signIn: setEmail, signOut: () => setEmail(null) }),
    [email]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (session === null) {
    throw new Error('useSession must be used inside a SessionProvider');
  }
  return session;
}

/**
 * The session if there is one. The screens are also drawn on their own (in
 * tests and previews), outside any SessionProvider, and then there is simply
 * nobody to sign out.
 */
export function useOptionalSession(): Session | null {
  return useContext(SessionContext);
}
