import { randomUUID } from 'crypto';
import type { Response } from 'express';
import type {
  OAuthServerProvider,
  OAuthClientInformationFull,
  OAuthTokens,
  AuthorizationParams,
} from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';

// Pre-generated client credentials for easy setup
const PREGENERATED_CLIENT_ID = 'chatgpt-mcp-fs-client';
const PREGENERATED_CLIENT_SECRET = 'chatgpt-mcp-fs-secret-' + randomUUID();

/**
 * Simple in-memory OAuth clients store with pre-registered client
 */
export class SimpleClientsStore implements OAuthRegisteredClientsStore {
  private clients = new Map<string, OAuthClientInformationFull>();

  constructor() {
    // Pre-register a client for easy ChatGPT setup
    this.clients.set(PREGENERATED_CLIENT_ID, {
      client_id: PREGENERATED_CLIENT_ID,
      client_secret: PREGENERATED_CLIENT_SECRET,
      client_name: 'ChatGPT MCP FS',
      redirect_uris: [
        'http://localhost:8080/callback',
        'http://localhost:3000/callback',
        'http://127.0.0.1:8080/callback',
        'http://127.0.0.1:3000/callback',
      ],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post',
    });
  }

  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    return this.clients.get(clientId);
  }

  async registerClient(clientMetadata: OAuthClientInformationFull): Promise<OAuthClientInformationFull> {
    this.clients.set(clientMetadata.client_id, clientMetadata);
    return clientMetadata;
  }

  // Getter for pre-generated credentials
  getPreGeneratedCredentials(): { clientId: string; clientSecret: string } {
    return {
      clientId: PREGENERATED_CLIENT_ID,
      clientSecret: PREGENERATED_CLIENT_SECRET,
    };
  }
}

interface AuthorizationCode {
  client: OAuthClientInformationFull;
  params: AuthorizationParams;
}

interface TokenData {
  token: string;
  clientId: string;
  scopes: string[];
  expiresAt: number;
  resource?: URL;
}

/**
 * Simple OAuth provider for local/development use
 * Auto-approves all authorization requests
 */
export class SimpleOAuthProvider implements OAuthServerProvider {
  private _clientsStore: SimpleClientsStore;
  private codes = new Map<string, AuthorizationCode>();
  private tokens = new Map<string, TokenData>();

  constructor() {
    this._clientsStore = new SimpleClientsStore();
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    return this._clientsStore;
  }

  // Getter for pre-generated credentials
  getPreGeneratedCredentials(): { clientId: string; clientSecret: string } {
    return this._clientsStore.getPreGeneratedCredentials();
  }

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response
  ): Promise<void> {
    const code = randomUUID();
    const searchParams = new URLSearchParams({ code });

    if (params.state !== undefined) {
      searchParams.set('state', params.state);
    }

    this.codes.set(code, { client, params });

    if (!client.redirect_uris.includes(params.redirectUri)) {
      res.status(400).json({ error: 'invalid_redirect_uri' });
      return;
    }

    const targetUrl = new URL(params.redirectUri);
    targetUrl.search = searchParams.toString();
    res.redirect(targetUrl.toString());
  }

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string
  ): Promise<string> {
    const codeData = this.codes.get(authorizationCode);
    if (!codeData) {
      throw new Error('Invalid authorization code');
    }
    return codeData.params.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string
  ): Promise<OAuthTokens> {
    const codeData = this.codes.get(authorizationCode);
    if (!codeData) {
      throw new Error('Invalid authorization code');
    }

    this.codes.delete(authorizationCode);

    const token = randomUUID();
    const tokenData: TokenData = {
      token,
      clientId: client.client_id,
      scopes: codeData.params.scopes || [],
      expiresAt: Date.now() + 3600000, // 1 hour
      resource: codeData.params.resource,
    };

    this.tokens.set(token, tokenData);

    return {
      access_token: token,
      token_type: 'bearer',
      expires_in: 3600,
      scope: (codeData.params.scopes || []).join(' '),
    };
  }

  async exchangeRefreshToken(
    _client: OAuthClientInformationFull,
    _refreshToken: string,
    _scopes?: string[]
  ): Promise<OAuthTokens> {
    throw new Error('Refresh tokens not supported');
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const tokenData = this.tokens.get(token);
    if (!tokenData || tokenData.expiresAt < Date.now()) {
      throw new Error('Invalid or expired token');
    }

    return {
      token,
      clientId: tokenData.clientId,
      scopes: tokenData.scopes,
      expiresAt: Math.floor(tokenData.expiresAt / 1000),
      resource: tokenData.resource,
    };
  }
}
