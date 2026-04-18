import { File, Paths } from 'expo-file-system';

const APPLE_HEALTH_LOG_RELATIVE_PATH = 'Documents/apple-health.ndjson';
const APPLE_HEALTH_LOG_FILE = new File(Paths.document, 'apple-health.ndjson');
const MAX_LOG_BYTES = 256 * 1024;

interface AppleHealthDiagnosticEntry {
  event: string;
  timestamp: string;
  payload: unknown;
}

function trimLogIfNeeded(content: string): string {
  if (content.length <= MAX_LOG_BYTES) {
    return content;
  }

  return content.slice(content.length - MAX_LOG_BYTES);
}

function buildLogLine(event: string, payload: unknown): string {
  const entry: AppleHealthDiagnosticEntry = {
    event,
    timestamp: new Date().toISOString(),
    payload,
  };

  return `${JSON.stringify(entry)}\n`;
}

export function appendAppleHealthDiagnostic(event: string, payload: unknown): void {
  try {
    const nextLine = buildLogLine(event, payload);
    const existing = APPLE_HEALTH_LOG_FILE.exists ? APPLE_HEALTH_LOG_FILE.textSync() : '';

    if (!APPLE_HEALTH_LOG_FILE.exists) {
      APPLE_HEALTH_LOG_FILE.create({ intermediates: true, overwrite: true });
    }

    APPLE_HEALTH_LOG_FILE.write(trimLogIfNeeded(`${existing}${nextLine}`));
  } catch (error: unknown) {
    console.error('[appleHealthDiagnostics] Failed to append diagnostic entry:', error);
  }
}

export function getAppleHealthDiagnosticsRelativePath(): string {
  return APPLE_HEALTH_LOG_RELATIVE_PATH;
}
