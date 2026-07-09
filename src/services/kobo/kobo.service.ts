/**
 * KoboToolbox Backend Service
 * Handles API communication, token encryption, and connection validation
 *
 * Usage in your backend (Express, Fastify, etc.):
 * - POST /api/kobo/connect - Test connection and store encrypted token
 * - POST /api/kobo/disconnect - Remove stored token and disconnect
 * - GET /api/kobo/status - Check current connection status
 */

import crypto from 'crypto';

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
        timeout: 10000,
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API token');
        }
        if (response.status === 403) {
          throw new Error('Access denied - check your token permissions');
        }
        throw new Error(
          `Server returned ${response.status}: ${response.statusText}`
        );
      }

      const user = await response.json();

      // Validate we got expected user data
      if (!user.username) {
        throw new Error('Unexpected response format from server');
      }

      return {
        username: user.username,
        email: user.email,
      };
    } catch (error) {
      if (error instanceof TypeError) {
        // Network error
        throw new Error(
          `Connection error: ${error.message}. Check the server URL.`
        );
      }
      throw error;
    }
  }

  /**
   * Encrypt and store API token
   */
  encryptToken(token: string): { encrypted: string; iv: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.ALGORITHM, this.encryptionKey, iv);

    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();
    // Append auth tag to encrypted data for GCM
    encrypted += authTag.toString('hex');

    return {
      encrypted,
      iv: iv.toString('hex'),
    };
  }

  /**
   * Decrypt stored API token
   */
  decryptToken(encrypted: string, ivHex: string): string {
    const iv = Buffer.from(ivHex, 'hex');

    // Extract auth tag from end of encrypted data
    const authTagStart = encrypted.length - this.AUTH_TAG_LENGTH * 2;
    const encryptedData = encrypted.substring(0, authTagStart);
    const authTag = Buffer.from(encrypted.substring(authTagStart), 'hex');

    const decipher = crypto.createDecipheriv(
      this.ALGORITHM,
      this.encryptionKey,
      iv
    );
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Normalize server URL (ensure protocol, remove trailing slash)
   */
  private normalizeServerUrl(url: string): string {
    let normalized = url.trim();

    // Add protocol if missing
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${normalized}`;
    }

    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');

    try {
      new URL(normalized);
      return normalized;
    } catch {
      throw new Error(`Invalid server URL: ${url}`);
    }
  }

  /**
   * Check if stored token is still valid (hasn't expired)
   */
  isTokenExpired(expiresAt?: Date): boolean {
    if (!expiresAt) return false;
    return new Date() > expiresAt;
  }

  /**
   * Generate expiration time for token
   */
  getTokenExpiration(): Date {
    return new Date(Date.now() + this.tokenTTL);
  }
}

/**
 * Example Express route handlers
 */

export async function handleKoboConnect(
  koboService: KoboService,
  server: string,
  token: string,
  userId: string,
  db: any // Your database
) {
  // Validate connection first
  const userInfo = await koboService.validateConnection(server, token);

  // Encrypt token
  const { encrypted, iv } = koboService.encryptToken(token);

  // Store in database
  const auth: StoredKoboAuth = {
    encryptedToken: encrypted,
    server,
    username: userInfo.username,
    iv,
    validatedAt: new Date(),
    expiresAt: koboService.getTokenExpiration(),
  };

  // Save to your database (example using generic db)
  await db.koboAuth.upsert(
    { userId },
    auth
  );

  return {
    username: userInfo.username,
    email: userInfo.email,
  };
}

export async function handleKoboDisconnect(
  userId: string,
  db: any // Your database
) {
  // Delete from database
  await db.koboAuth.delete({ userId });
}

export async function handleKoboStatus(
  userId: string,
  koboService: KoboService,
  db: any // Your database
): Promise<{ isConnected: boolean; username?: string; error?: string }> {
  const auth = await db.koboAuth.findOne({ userId });

  if (!auth) {
    return { isConnected: false };
  }

  // Check expiration
  if (koboService.isTokenExpired(auth.expiresAt)) {
    await db.koboAuth.delete({ userId });
    return { isConnected: false, error: 'Token expired' };
  }

  // Could optionally re-validate here
  // For now, just check if we have it stored
  return {
    isConnected: true,
    username: auth.username,
  };
}

/**
 * Example usage in your application:
 *
 * const koboService = new KoboService({
 *   encryptionKey: process.env.KOBO_ENCRYPTION_KEY, // 32-byte hex string
 * });
 *
 * app.post('/api/kobo/connect', authenticate, async (req, res) => {
 *   try {
 *     const { server, token } = req.body;
 *
 *     const result = await handleKoboConnect(
 *       koboService,
 *       server,
 *       token,
 *       req.user.id,
 *       db
 *     );
 *
 *     res.json(result);
 *   } catch (error) {
 *     res.status(400).json({
 *       message: error instanceof Error ? error.message : 'Connection failed',
 *     });
 *   }
 * });
 *
 * app.post('/api/kobo/disconnect', authenticate, async (req, res) => {
 *   try {
 *     await handleKoboDisconnect(req.user.id, db);
 *     res.json({ success: true });
 *   } catch (error) {
 *     res.status(500).json({ message: 'Failed to disconnect' });
 *   }
 * });
 *
 * app.get('/api/kobo/status', authenticate, async (req, res) => {
 *   try {
 *     const status = await handleKoboStatus(
 *       req.user.id,
 *       koboService,
 *       db
 *     );
 *     res.json(status);
 *   } catch (error) {
 *     res.status(500).json({ message: 'Failed to check status' });
 *   }
 * });
 */
