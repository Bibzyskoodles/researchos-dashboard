/**
 * KoboToolbox Backend Service
 * Handles API communication, token encryption, and connection validation
 *
 * NOTE: This service is intended for Node.js backend use.
 * In a browser context the crypto methods are not available at runtime,
 * but the file is included for type-checking purposes only.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodeCrypto: typeof import('crypto') = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('crypto');
  } catch {
    return null as unknown as typeof import('crypto');
  }
})();

export interface KoboServiceConfig {
  encryptionKey: string; // 32-byte hex string for AES-256
  tokenTTL?: number; // milliseconds, default 24 hours
}

export interface StoredKoboAuth {
  encryptedToken: string;
  server: string;
  username: string;
  iv: string; // initialization vector
  validatedAt: Date;
  expiresAt?: Date;
}

/**
 * KoboService - Manage authentication and API calls to KoboToolbox
 */
export class KoboService {
  private encryptionKey: Buffer;
  private tokenTTL: number;
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly AUTH_TAG_LENGTH = 16;

  constructor(config: KoboServiceConfig) {
    this.encryptionKey = Buffer.from(config.encryptionKey, 'hex');
    if (this.encryptionKey.length !== 32) {
      throw new Error('Encryption key must be 32 bytes (256 bits)');
    }
    this.tokenTTL = config.tokenTTL || 24 * 60 * 60 * 1000; // 24 hours default
  }

  /**
   * Validate connection to KoboToolbox server
   * Throws on failure, returns user info on success
   */
  async validateConnection(
    server: string,
    token: string
  ): Promise<{ username: string; email?: string }> {
    const normalizedServer = this.normalizeServerUrl(server);

    try {
      const response = await fetch(`${normalizedServer}/api/v2/user/`, {
        method: 'GET',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API token');
        }
        if (response.status === 403) {
          throw new Error('Access denied - check your token permissions');
        }
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const user = await response.json();

      if (!user.username) {
        throw new Error('Unexpected response format from server');
      }

      return { username: user.username, email: user.email };
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(`Connection error: ${error.message}. Check the server URL.`);
      }
      throw error;
    }
  }

  /**
   * Encrypt and store API token
   */
  encryptToken(token: string): { encrypted: string; iv: string } {
    const iv = nodeCrypto.randomBytes(16);
    const cipher = nodeCrypto.createCipheriv(this.ALGORITHM, this.encryptionKey, iv);

    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();
    encrypted += authTag.toString('hex');

    return { encrypted, iv: iv.toString('hex') };
  }

  /**
   * Decrypt stored API token
   */
  decryptToken(encrypted: string, ivHex: string): string {
    const iv = Buffer.from(ivHex, 'hex');

    const authTagStart = encrypted.length - this.AUTH_TAG_LENGTH * 2;
    const encryptedData = encrypted.substring(0, authTagStart);
    const authTag = Buffer.from(encrypted.substring(authTagStart), 'hex');

    const decipher = nodeCrypto.createDecipheriv(this.ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  private normalizeServerUrl(url: string): string {
    let normalized = url.trim();
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${normalized}`;
    }
    normalized = normalized.replace(/\/$/, '');
    try {
      new URL(normalized);
      return normalized;
    } catch {
      throw new Error(`Invalid server URL: ${url}`);
    }
  }

  isTokenExpired(expiresAt?: Date): boolean {
    if (!expiresAt) return false;
    return new Date() > expiresAt;
  }

  getTokenExpiration(): Date {
    return new Date(Date.now() + this.tokenTTL);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleKoboConnect(
  koboService: KoboService,
  server: string,
  token: string,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any
) {
  const userInfo = await koboService.validateConnection(server, token);
  const { encrypted, iv } = koboService.encryptToken(token);

  const auth: StoredKoboAuth = {
    encryptedToken: encrypted,
    server,
    username: userInfo.username,
    iv,
    validatedAt: new Date(),
    expiresAt: koboService.getTokenExpiration(),
  };

  await db.koboAuth.upsert({ userId }, auth);

  return { username: userInfo.username, email: userInfo.email };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleKoboDisconnect(userId: string, db: any) {
  await db.koboAuth.delete({ userId });
}

export async function handleKoboStatus(
  userId: string,
  koboService: KoboService,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any
): Promise<{ isConnected: boolean; username?: string; error?: string }> {
  const auth = await db.koboAuth.findOne({ userId });

  if (!auth) {
    return { isConnected: false };
  }

  if (koboService.isTokenExpired(auth.expiresAt)) {
    await db.koboAuth.delete({ userId });
    return { isConnected: false, error: 'Token expired' };
  }

  return { isConnected: true, username: auth.username };
}
