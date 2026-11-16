import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseEnvInput {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

export type SupabaseConfigReason =
  | 'ok'
  | 'missing_credentials'
  | 'missing_url'
  | 'missing_key'
  | 'invalid_url'
  | 'invalid_key'
  | 'secret_key_rejected';

export interface SupabaseConfigStatus {
  configured: boolean;
  status: 'configured' | 'unconfigured' | 'invalid_config';
  reason: SupabaseConfigReason;
  message: string;
  hasUrl: boolean;
  hasPublishableKey: boolean;
}

export interface SupabaseClientBundle {
  client: SupabaseClient | null;
  status: SupabaseConfigStatus;
}

const PLACEHOLDER_PATTERNS = [
  /^MY_SUPABASE_/i,
  /^YOUR_SUPABASE_/i,
  /^PLACEHOLDER/i,
  /^CHANGEME/i,
  /^<.*>$/,
  /your-project\.supabase\.co/i,
  /example\.supabase\.co/i,
];

function normalizeEnvValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isPlaceholderValue(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

function decodeBase64UrlToUtf8(input: string): string | null {
  try {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLength);

    if (typeof atob === 'function') {
      return atob(padded);
    }
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(padded, 'base64').toString('utf8');
    }
    return null;
  } catch {
    return null;
  }
}

function isSecretOrServiceRoleKey(key: string): boolean {
  if (/^sb_secret_/i.test(key)) {
    return true;
  }

  // Detect Supabase legacy JWT keys where payload.role === 'service_role'
  const parts = key.split('.');
  if (parts.length === 3 && key.startsWith('eyJ')) {
    const decodedPayload = decodeBase64UrlToUtf8(parts[1]);
    if (decodedPayload) {
      try {
        const parsed: unknown = JSON.parse(decodedPayload);
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          'role' in parsed &&
          (parsed as { role?: unknown }).role === 'service_role'
        ) {
          return true;
        }
      } catch {
        return false;
      }
    }
  }

  return false;
}

function isValidSupabaseUrl(rawUrl: string): boolean {
  if (isPlaceholderValue(rawUrl)) {
    return false;
  }

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'https:') {
      return Boolean(parsed.hostname && parsed.hostname.includes('.'));
    }
    if (parsed.protocol === 'http:') {
      return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    }
    return false;
  } catch {
    return false;
  }
}

function isValidPublishableKeyFormat(rawKey: string): boolean {
  if (isPlaceholderValue(rawKey)) {
    return false;
  }
  if (/\s/.test(rawKey)) {
    return false;
  }
  return rawKey.length >= 20;
}

export function readViteSupabaseEnv(): SupabaseEnvInput {
  try {
    const metaEnv = (import.meta as { env?: Record<string, unknown> } | undefined)?.env;
    return {
      VITE_SUPABASE_URL:
        typeof metaEnv?.VITE_SUPABASE_URL === 'string' ? metaEnv.VITE_SUPABASE_URL : undefined,
      VITE_SUPABASE_PUBLISHABLE_KEY:
        typeof metaEnv?.VITE_SUPABASE_PUBLISHABLE_KEY === 'string'
          ? metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY
          : undefined,
    };
  } catch {
    return {};
  }
}

export function validateSupabaseConfig(env: SupabaseEnvInput): SupabaseConfigStatus {
  const url = normalizeEnvValue(env.VITE_SUPABASE_URL);
  const publishableKey = normalizeEnvValue(env.VITE_SUPABASE_PUBLISHABLE_KEY);

  const hasUrl = url.length > 0;
  const hasPublishableKey = publishableKey.length > 0;

  if (!hasUrl && !hasPublishableKey) {
    return {
      configured: false,
      status: 'unconfigured',
      reason: 'missing_credentials',
      message:
        'Supabase ยังไม่ได้ตั้งค่า (ยังไม่มี VITE_SUPABASE_URL และ VITE_SUPABASE_PUBLISHABLE_KEY) — ระบบยังคงใช้งาน localStorage ได้ตามปกติ',
      hasUrl: false,
      hasPublishableKey: false,
    };
  }

  if (!hasUrl) {
    return {
      configured: false,
      status: 'unconfigured',
      reason: 'missing_url',
      message: 'Supabase ยังไม่ได้ตั้งค่า (ขาด VITE_SUPABASE_URL)',
      hasUrl: false,
      hasPublishableKey: true,
    };
  }

  if (!hasPublishableKey) {
    return {
      configured: false,
      status: 'unconfigured',
      reason: 'missing_key',
      message: 'Supabase ยังไม่ได้ตั้งค่า (ขาด VITE_SUPABASE_PUBLISHABLE_KEY)',
      hasUrl: true,
      hasPublishableKey: false,
    };
  }

  if (!isValidSupabaseUrl(url)) {
    return {
      configured: false,
      status: 'invalid_config',
      reason: 'invalid_url',
      message:
        'ค่า VITE_SUPABASE_URL ไม่ถูกต้อง (ต้องเป็น URL แบบ https://... หรือ http://localhost สำหรับพัฒนา)',
      hasUrl: true,
      hasPublishableKey: true,
    };
  }

  if (isSecretOrServiceRoleKey(publishableKey)) {
    return {
      configured: false,
      status: 'invalid_config',
      reason: 'secret_key_rejected',
      message:
        'ไม่อนุญาตให้ใช้ service_role หรือ Secret Key ใน Frontend — กรุณาใช้ VITE_SUPABASE_PUBLISHABLE_KEY เท่านั้น',
      hasUrl: true,
      hasPublishableKey: true,
    };
  }

  if (!isValidPublishableKeyFormat(publishableKey)) {
    return {
      configured: false,
      status: 'invalid_config',
      reason: 'invalid_key',
      message: 'ค่า VITE_SUPABASE_PUBLISHABLE_KEY ไม่ถูกต้องหรือเป็นค่าตัวอย่าง',
      hasUrl: true,
      hasPublishableKey: true,
    };
  }

  return {
    configured: true,
    status: 'configured',
    reason: 'ok',
    message: 'Supabase Client พร้อมใช้งาน (ตั้งค่า URL และ Publishable Key แล้ว)',
    hasUrl: true,
    hasPublishableKey: true,
  };
}

export function createSupabaseClientFromEnv(env: SupabaseEnvInput): SupabaseClientBundle {
  const status = validateSupabaseConfig(env);
  if (!status.configured) {
    return { client: null, status };
  }

  const url = normalizeEnvValue(env.VITE_SUPABASE_URL);
  const publishableKey = normalizeEnvValue(env.VITE_SUPABASE_PUBLISHABLE_KEY);

  try {
    const client = createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    return { client, status };
  } catch (err) {
    return {
      client: null,
      status: {
        configured: false,
        status: 'invalid_config',
        reason: 'invalid_url',
        message: `ไม่สามารถสร้าง Supabase Client ได้: ${
          err instanceof Error ? err.message : 'Invalid Supabase configuration'
        }`,
        hasUrl: status.hasUrl,
        hasPublishableKey: status.hasPublishableKey,
      },
    };
  }
}

const initialBundle = createSupabaseClientFromEnv(readViteSupabaseEnv());

export const supabase: SupabaseClient | null = initialBundle.client;
export const supabaseConfigStatus: SupabaseConfigStatus = initialBundle.status;

export function getSupabaseClient(): SupabaseClient | null {
  return supabase;
}

export function isSupabaseConfigured(): boolean {
  return supabaseConfigStatus.configured && supabase !== null;
}

export function getSupabaseStatus(): SupabaseConfigStatus {
  return supabaseConfigStatus;
}
