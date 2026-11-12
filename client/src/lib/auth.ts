/**
 * Signing in (US-20). The rules of docs/LOGIN_DESIGN.md live here: which
 * message a student sees for each answer, how a session survives the app
 * closing, and how our own requests prove who is asking.
 *
 * This file does not import Better Auth. It is handed something shaped like
 * Better Auth's client (lib/auth-client.ts makes the real one), so the rules
 * can be tested without a phone, a server or SecureStore.
 */

/** What every Better Auth call answers: data when the server agrees, error when it refuses. */
type Answer<T> = {
  data: T | null;
  error: { status: number; message?: string } | null;
};

type SignedInUser = { user: { email: string } };

/** The parts of Better Auth's client this app uses. */
export type AuthClientLike = {
  signIn: { email: (body: { email: string; password: string }) => Promise<Answer<SignedInUser>> };
  signUp: {
    email: (body: { name: string; email: string; password: string }) => Promise<Answer<SignedInUser>>;
  };
  signOut: () => Promise<Answer<unknown>>;
  getSession: () => Promise<Answer<SignedInUser | null>>;
  /** The saved session cookie, or "" when there is none. Better Auth returns a promise. */
  getCookie: () => Promise<string>;
};

/** How a sign-in or sign-up went: who is signed in, or what to tell the student. */
export type AuthResult = { ok: true; email: string } | { ok: false; message: string };

/**
 * A session found when the app opens. The email is null when the phone has
 * a saved session but could not ask the server whose it is (no connection).
 */
export type RestoredSession = { email: string | null };

/** Everything the app needs from signing in, with the server or without it. */
export type Auth = {
  /** False in sample-data mode, where any password opens the app. */
  checksPasswords: boolean;
  /**
   * Looks for a session kept from last time. Missing when sessions are not
   * kept, and then the app opens on Log in straight away.
   */
  restore?: () => Promise<RestoredSession | null>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (name: string, email: string, password: string) => Promise<AuthResult>;
  /** Ends the session. Never rejects: logging out always works on the phone. */
  signOut: () => Promise<void>;
  /** What to add to each request to our server, so it knows who is asking. */
  requestOptions: () => Promise<RequestInit>;
};

/**
 * Sample-data mode (EXPO_PUBLIC_USE_FIXTURE=1) has no server, so it keeps the
 * sign-in the app had before accounts: any email and password open the app,
 * nothing is stored, and the session lasts until the app is closed.
 */
export const localAuth: Auth = {
  checksPasswords: false,
  signIn: async (email) => ({ ok: true, email }),
  signUp: async (_name, email) => ({ ok: true, email }),
  signOut: async () => {},
  requestOptions: async () => ({}),
};

/**
 * When the app cannot work out where the server is (a release build with no
 * EXPO_PUBLIC_API_URL), it still opens on Log in, and every attempt to sign
 * in or up says why, instead of the app failing to start.
 */
export function unavailableAuth(reason: string): Auth {
  return {
    checksPasswords: true,
    restore: async () => null,
    signIn: async () => ({ ok: false, message: reason }),
    signUp: async () => ({ ok: false, message: reason }),
    signOut: async () => {},
    requestOptions: async () => ({}),
  };
}

/** Used when a refusal comes without the server's own message. */
const MESSAGE_FOR_STATUS: Record<number, string> = {
  401: 'Wrong email or password.',
  422: 'An account with this email already exists.',
};

/** The message a student sees for a refused sign-in or sign-up. */
function refusalMessage(error: { status: number; message?: string }, noConnection: string): string {
  // No status (0 or missing) means the request never got an answer: no connection.
  if (!error.status) return noConnection;
  // The design says to show the server's message, which already reads well.
  if (error.message) return error.message;
  return MESSAGE_FOR_STATUS[error.status] ?? `The server answered ${error.status}. Please try again.`;
}

/** Turns one Better Auth call into an AuthResult, whatever happens to the request. */
async function attempt(call: () => Promise<Answer<SignedInUser>>, noConnection: string): Promise<AuthResult> {
  let answer: Answer<SignedInUser>;
  try {
    answer = await call();
  } catch {
    // The client only rejects when it could not talk to the server at all.
    return { ok: false, message: noConnection };
  }
  if (answer.error !== null) {
    return { ok: false, message: refusalMessage(answer.error, noConnection) };
  }
  if (!answer.data?.user?.email) {
    return { ok: false, message: 'The server sent an answer the app did not understand. Please try again.' };
  }
  return { ok: true, email: answer.data.user.email };
}

/** The saved cookie, or "" when there is none or it cannot be read. */
async function savedCookie(client: AuthClientLike): Promise<string> {
  try {
    return await client.getCookie();
  } catch (error) {
    console.error('auth: could not read the saved session:', error);
    return '';
  }
}

/** Signing in against our server, through Better Auth's client. */
export function createServerAuth(
  client: AuthClientLike,
  { serverAddress, isWeb }: { serverAddress: string; isWeb: boolean }
): Auth {
  const noConnection = `Could not reach the server at ${serverAddress}. Check your connection and try again.`;

  return {
    checksPasswords: true,

    signIn: (email, password) => attempt(() => client.signIn.email({ email, password }), noConnection),

    signUp: (name, email, password) =>
      attempt(() => client.signUp.email({ name, email, password }), noConnection),

    restore: async () => {
      let answer: Answer<SignedInUser | null> | null = null;
      try {
        answer = await client.getSession();
      } catch {
        // No connection: decided below, from what the phone has saved.
      }
      if (answer !== null && answer.error === null) {
        // The server answered. A null session means nobody is signed in.
        const email = answer.data?.user?.email;
        return email ? { email } : null;
      }
      if (answer?.error?.status === 401) return null;
      // No connection or a failing server: the session may still be good, so
      // keep a student who has one signed in. If it has ended, the first
      // request answers 401, and that sends them back to Log in.
      return (await savedCookie(client)) ? { email: null } : null;
    },

    signOut: async () => {
      // Better Auth's Expo plugin wipes the saved session before it sends the
      // request, so the phone is logged out even when the server is not reached.
      try {
        const { error } = await client.signOut();
        if (error !== null) console.error('auth: the server did not end the session:', error);
      } catch (error) {
        console.error('auth: could not reach the server to end the session:', error);
      }
    },

    requestOptions: async () => {
      // A browser sends its own cookies, and will not let a page set Cookie by hand.
      if (isWeb) return { credentials: 'include' };
      const cookie = await savedCookie(client);
      // 'omit' stops the phone adding a cookie of its own next to ours (Better Auth's Expo guide).
      const headers: Record<string, string> = cookie ? { Cookie: cookie } : {};
      return { headers, credentials: 'omit' };
    },
  };
}
