import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { SESSION_ENDED_MESSAGE, setRequestAuth } from '../lib/api';
import { Auth, localAuth } from '../lib/auth';

type Session = {
  /** True while the app looks for a session kept from last time. */
  checking: boolean;
  signedIn: boolean;
  /**
   * The email the student signed in with. Null when signed out, and also
   * when the app opened offline with a saved session it could not look up.
   */
  email: string | null;
  /** Why the student was sent back to Log in without asking, if they were. */
  notice: string | null;
  /** False in sample-data mode, where any password opens the app. */
  checksPasswords: boolean;
  /** Resolves to the message to show, or to null once signed in. */
  signIn: (email: string, password: string) => Promise<string | null>;
  /** Resolves to the message to show, or to null once signed up and signed in. */
  signUp: (name: string, email: string, password: string) => Promise<string | null>;
  signOut: () => void;
  /**
  * True right after this student created their account, until the welcome
  * (US-47) has been opened for them. Signing in or a kept session never sets it.
  */
  newAccount: boolean;
  /** Says the welcome has been opened, so it is not opened again. */
  welcomed: () => void;
};

type State = {
  status: 'checking' | 'signedOut' | 'signedIn';
  email: string | null;
  notice: string | null;
  newAccount: boolean;
};

const SessionContext = createContext<Session | null>(null);

/** The state a provider opens with. */
function openingState(auth: Auth, initialEmail: string | null): State {
  if (initialEmail !== null) return { status: 'signedIn', email: initialEmail, notice: null, newAccount: false };
  return { status: auth.restore ? 'checking' : 'signedOut', email: null, notice: null, newAccount: false };
}
/**
 * Who is signed in (US-20). `auth` is how: the server through Better Auth
 * in the app, or local sign-in in sample-data mode and tests (the default),
 * where any email and password open the app until it is closed.
 */
export function SessionProvider({
  children,
  auth = localAuth,
  initialEmail = null,
}: {
  children: React.ReactNode;
  auth?: Auth;
  /** Lets tests start signed in. */
  initialEmail?: string | null;
}) {
  const [state, setState] = useState<State>(() => openingState(auth, initialEmail));

  // Look for a session kept from last time, once, when the app opens.
  useEffect(() => {
    if (!auth.restore || initialEmail !== null) return;
    let closed = false;
    auth
      .restore()
      .then(
        (restored): State =>
          restored === null
                      ? { status: 'signedOut', email: null, notice: null, newAccount: false }
                      : { status: 'signedIn', email: restored.email, notice: null, newAccount: false },
        (error: unknown): State => {
          console.error('session: could not check for a saved session:', error);
          return { status: 'signedOut', email: null, notice: null, newAccount: false };
        }
      )
      .then((next) => {
        if (!closed) setState(next);
      });
    return () => {
      closed = true;
    };
  }, [auth, initialEmail]);

  // Requests to our server carry the session, and a 401 sends the student
  // back to Log in. A layout effect, because it must be in place before the
  // ordinary effects below it run, like the semester's first fetch.
  // Sample-data mode has no server to send a session to.
  useLayoutEffect(() => {
    if (!auth.checksPasswords) return;
    setRequestAuth({
      options: auth.requestOptions,
      onResponse: auth.receiveResponse,
      onSessionEnded: () => setState({ status: 'signedOut', email: null, notice: SESSION_ENDED_MESSAGE, newAccount: false }),
    });
    return () => setRequestAuth(null);
  }, [auth]);

  const value = useMemo<Session>(() => {
    const signedInAs = (email: string, newAccount = false) =>
      setState({ status: 'signedIn', email, notice: null, newAccount });
    return {
      checking: state.status === 'checking',
      signedIn: state.status === 'signedIn',
      email: state.email,
      notice: state.notice,
      checksPasswords: auth.checksPasswords,
      signIn: async (email, password) => {
        const result = await auth.signIn(email, password);
        if (!result.ok) return result.message;
        signedInAs(result.email);
        return null;
      },
      signUp: async (name, email, password) => {
        const result = await auth.signUp(name, email, password);
        if (!result.ok) return result.message;
        signedInAs(result.email, true);
        return null;
      },
      signOut: () => {
        // Leave at once; ending the session on the server never fails loudly.
        setState({ status: 'signedOut', email: null, notice: null, newAccount: false });
        void auth.signOut();
      },

      newAccount: state.newAccount,
     welcomed: () => setState((current) => ({ ...current, newAccount: false })),
    };
  }, [auth, state]);

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
