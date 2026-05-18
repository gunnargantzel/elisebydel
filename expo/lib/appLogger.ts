import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = {
  ts: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: string;
};

const STORAGE_KEY = '@elise_app_diagnostic_logs';
const MAX_ENTRIES = 1500;
const PERSIST_DEBOUNCE_MS = 400;

let sessionId = '';
let entries: LogEntry[] = [];
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;

function createSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatEntry(entry: LogEntry): string {
  const dataPart = entry.data ? ` | ${entry.data}` : '';
  return `${entry.ts} [${entry.level.toUpperCase()}] [${entry.category}] ${entry.message}${dataPart}`;
}

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries)).catch(() => {});
  }, PERSIST_DEBOUNCE_MS);
}

function appendEntry(level: LogLevel, category: string, message: string, data?: unknown): void {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    category,
    message,
    data: data !== undefined ? JSON.stringify(data) : undefined,
  };

  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(-MAX_ENTRIES);
  }

  schedulePersist();

  const line = formatEntry(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

async function loadPersistedEntries(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as LogEntry[];
    if (Array.isArray(parsed)) {
      entries = parsed.slice(-MAX_ENTRIES);
    }
  } catch {
    entries = [];
  }
}

export async function initAppLogger(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    sessionId = createSessionId();
    await loadPersistedEntries();

    const deviceInfo = {
      sessionId,
      platform: Platform.OS,
      platformVersion: String(Platform.Version),
      appVersion: Constants.expoConfig?.version ?? 'unknown',
      nativeAppVersion: Application.nativeApplicationVersion ?? 'unknown',
      nativeBuildVersion: Application.nativeBuildVersion ?? 'unknown',
      deviceName: Device.deviceName ?? 'unknown',
      deviceModel: Device.modelName ?? 'unknown',
      manufacturer: Device.manufacturer ?? 'unknown',
      osName: Device.osName ?? 'unknown',
      osVersion: Device.osVersion ?? 'unknown',
      isDevice: Device.isDevice,
    };

    appendEntry('info', 'app', 'Session started', deviceInfo);
    initialized = true;
  })();

  return initPromise;
}

export function getSessionId(): string {
  return sessionId;
}

export function logDebug(category: string, message: string, data?: unknown): void {
  appendEntry('debug', category, message, data);
}

export function logInfo(category: string, message: string, data?: unknown): void {
  appendEntry('info', category, message, data);
}

export function logWarn(category: string, message: string, data?: unknown): void {
  appendEntry('warn', category, message, data);
}

export function logError(category: string, message: string, data?: unknown): void {
  appendEntry('error', category, message, data);
}

export function getEntries(): LogEntry[] {
  return [...entries];
}

export function getEntryCount(): number {
  return entries.length;
}

export function getLogText(): string {
  return entries.map(formatEntry).join('\n');
}

export async function clearLogs(): Promise<void> {
  entries = [];
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  await AsyncStorage.removeItem(STORAGE_KEY);
  appendEntry('info', 'app', 'Diagnostic log cleared');
}
