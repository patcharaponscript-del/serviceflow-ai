import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
  User,
} from '@supabase/supabase-js';
import {
  supabase as defaultSupabaseClient,
  supabaseConfigStatus as defaultConfigStatus,
  SupabaseConfigStatus,
} from '../lib/supabaseClient';

export type AuthErrorCode =
  | 'SUPABASE_NOT_CONFIGURED'
  | 'INVALID_INPUT'
  | 'AUTH_ERROR'
  | 'UNEXPECTED_ERROR';

export type AuthServiceResult<T> =
  | {
      ok: true;
      configured: true;
      data: T;
    }
  | {
      ok: false;
      configured: boolean;
      errorCode: AuthErrorCode;
      error: string;
    };

export interface SignUpParams {
  email: string;
  password: string;
  metadata?: Record<string, unknown>;
  emailRedirectTo?: string;
}

export interface SignInParams {
  email: string;
  password: string;
}

export interface SignUpData {
  user: User | null;
  session: Session | null;
}

export interface SignInData {
  user: User | null;
  session: Session | null;
}

export interface AuthStateSubscription {
  active: boolean;
  configured: boolean;
  unsubscribe: () => void;
}

export type AuthStateChangeCallback = (
  event: AuthChangeEvent,
  session: Session | null
) => void;

export interface SupabaseAuthService {
  getStatus: () => SupabaseConfigStatus;
  signUp: (params: SignUpParams) => Promise<AuthServiceResult<SignUpData>>;
  signIn: (params: SignInParams) => Promise<AuthServiceResult<SignInData>>;
  signOut: () => Promise<AuthServiceResult<null>>;
  getCurrentSession: () => Promise<AuthServiceResult<Session | null>>;
  getCurrentUser: () => Promise<AuthServiceResult<User | null>>;
  onAuthStateChange: (callback: AuthStateChangeCallback) => AuthStateSubscription;
}

function formatErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

export function createAuthService(
  client: SupabaseClient | null = defaultSupabaseClient,
  configStatus: SupabaseConfigStatus = defaultConfigStatus
): SupabaseAuthService {
  const notConfiguredResult = <T>(): AuthServiceResult<T> => ({
    ok: false,
    configured: false,
    errorCode: 'SUPABASE_NOT_CONFIGURED',
    error: configStatus.message || 'Supabase ยังไม่ได้ตั้งค่า Credentials',
  });

  return {
    getStatus: () => configStatus,

    async signUp(params: SignUpParams): Promise<AuthServiceResult<SignUpData>> {
      if (!client || !configStatus.configured) {
        return notConfiguredResult<SignUpData>();
      }

      const email = params.email.trim();
      const password = params.password;
      if (!email || !password) {
        return {
          ok: false,
          configured: true,
          errorCode: 'INVALID_INPUT',
          error: 'กรุณาระบุอีเมลและรหัสผ่านให้ครบถ้วน',
        };
      }

      try {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options:
            params.metadata || params.emailRedirectTo
              ? {
                  data: params.metadata,
                  emailRedirectTo: params.emailRedirectTo,
                }
              : undefined,
        });

        if (error) {
          return {
            ok: false,
            configured: true,
            errorCode: 'AUTH_ERROR',
            error: error.message,
          };
        }

        return {
          ok: true,
          configured: true,
          data: {
            user: data.user,
            session: data.session,
          },
        };
      } catch (err) {
        return {
          ok: false,
          configured: true,
          errorCode: 'UNEXPECTED_ERROR',
          error: formatErrorMessage(err, 'เกิดข้อผิดพลาดระหว่างสมัครสมาชิก'),
        };
      }
    },

    async signIn(params: SignInParams): Promise<AuthServiceResult<SignInData>> {
      if (!client || !configStatus.configured) {
        return notConfiguredResult<SignInData>();
      }

      const email = params.email.trim();
      const password = params.password;
      if (!email || !password) {
        return {
          ok: false,
          configured: true,
          errorCode: 'INVALID_INPUT',
          error: 'กรุณาระบุอีเมลและรหัสผ่านให้ครบถ้วน',
        };
      }

      try {
        const { data, error } = await client.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          return {
            ok: false,
            configured: true,
            errorCode: 'AUTH_ERROR',
            error: error.message,
          };
        }

        return {
          ok: true,
          configured: true,
          data: {
            user: data.user,
            session: data.session,
          },
        };
      } catch (err) {
        return {
          ok: false,
          configured: true,
          errorCode: 'UNEXPECTED_ERROR',
          error: formatErrorMessage(err, 'เกิดข้อผิดพลาดระหว่างเข้าสู่ระบบ'),
        };
      }
    },

    async signOut(): Promise<AuthServiceResult<null>> {
      if (!client || !configStatus.configured) {
        return notConfiguredResult<null>();
      }

      try {
        const { error } = await client.auth.signOut();
        if (error) {
          return {
            ok: false,
            configured: true,
            errorCode: 'AUTH_ERROR',
            error: error.message,
          };
        }

        return {
          ok: true,
          configured: true,
          data: null,
        };
      } catch (err) {
        return {
          ok: false,
          configured: true,
          errorCode: 'UNEXPECTED_ERROR',
          error: formatErrorMessage(err, 'เกิดข้อผิดพลาดระหว่างออกจากระบบ'),
        };
      }
    },

    async getCurrentSession(): Promise<AuthServiceResult<Session | null>> {
      if (!client || !configStatus.configured) {
        return notConfiguredResult<Session | null>();
      }

      try {
        const { data, error } = await client.auth.getSession();
        if (error) {
          return {
            ok: false,
            configured: true,
            errorCode: 'AUTH_ERROR',
            error: error.message,
          };
        }

        return {
          ok: true,
          configured: true,
          data: data.session,
        };
      } catch (err) {
        return {
          ok: false,
          configured: true,
          errorCode: 'UNEXPECTED_ERROR',
          error: formatErrorMessage(err, 'ไม่สามารถตรวจสอบ Session ปัจจุบันได้'),
        };
      }
    },

    async getCurrentUser(): Promise<AuthServiceResult<User | null>> {
      if (!client || !configStatus.configured) {
        return notConfiguredResult<User | null>();
      }

      try {
        const { data, error } = await client.auth.getUser();
        if (error) {
          return {
            ok: false,
            configured: true,
            errorCode: 'AUTH_ERROR',
            error: error.message,
          };
        }

        return {
          ok: true,
          configured: true,
          data: data.user,
        };
      } catch (err) {
        return {
          ok: false,
          configured: true,
          errorCode: 'UNEXPECTED_ERROR',
          error: formatErrorMessage(err, 'ไม่สามารถตรวจสอบข้อมูลผู้ใช้ปัจจุบันได้'),
        };
      }
    },

    onAuthStateChange(callback: AuthStateChangeCallback): AuthStateSubscription {
      if (!client || !configStatus.configured) {
        return {
          active: false,
          configured: false,
          unsubscribe: () => {},
        };
      }

      const { data } = client.auth.onAuthStateChange((event, session) => {
        callback(event, session);
      });

      return {
        active: true,
        configured: true,
        unsubscribe: () => {
          data.subscription.unsubscribe();
        },
      };
    },
  };
}

export const authService: SupabaseAuthService = createAuthService();
