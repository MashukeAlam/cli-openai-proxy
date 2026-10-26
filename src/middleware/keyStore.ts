import fs from 'fs';
import path from 'path';

export interface ApiKeyRecord {
  apiKey: string;
  name?: string;
  role?: string;
}

// In-memory cache of valid API keys
let validApiKeys = new Set<string>();
let keyMetadataMap = new Map<string, ApiKeyRecord>();
let hasCsvConfigured = false;

export function loadApiKeys(filePath?: string): void {
  const targetFile = filePath || process.env.API_KEYS_FILE || 'api_keys.csv';
  const resolvedPath = path.isAbsolute(targetFile)
    ? targetFile
    : path.resolve(process.cwd(), targetFile);

  validApiKeys.clear();
  keyMetadataMap.clear();

  if (!fs.existsSync(resolvedPath)) {
    hasCsvConfigured = false;
    return;
  }

  hasCsvConfigured = true;
  try {
    const content = fs.readFileSync(resolvedPath, 'utf8');
    const lines = content.split(/\r?\n/);

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }

      const columns = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
      const key = columns[0];
      if (key) {
        validApiKeys.add(key);
        keyMetadataMap.set(key, {
          apiKey: key,
          name: columns[1],
          role: columns[2],
        });
      }
    }
    console.log(`[auth] Loaded ${validApiKeys.size} valid API key(s) from ${path.basename(resolvedPath)}`);
  } catch (err) {
    console.error(`[auth] Error reading API keys file ${resolvedPath}:`, err);
  }
}

export function isValidApiKey(token: string): boolean {
  const envSingleKey = process.env.API_KEY?.trim();

  // If a single env key is specified, check against it
  if (envSingleKey && token === envSingleKey) {
    return true;
  }

  // Check against CSV loaded keys
  return validApiKeys.has(token);
}

export function isAuthRequired(): boolean {
  const envSingleKey = process.env.API_KEY?.trim();
  return Boolean(envSingleKey) || (hasCsvConfigured && validApiKeys.size > 0);
}

export function getKeyMetadata(token: string): ApiKeyRecord | undefined {
  return keyMetadataMap.get(token);
}
