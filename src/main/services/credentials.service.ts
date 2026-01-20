import { readFile, access } from 'fs/promises';
import { constants } from 'fs';
import { getCredentialsPath } from '../utils/paths';

export interface Credentials {
  claudeAiOauth?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
  };
  apiKey?: string;
}

export class CredentialsService {
  private credentialsPath: string;

  constructor() {
    this.credentialsPath = getCredentialsPath();
  }

  /**
   * Check if credentials file exists
   */
  async hasCredentials(): Promise<boolean> {
    try {
      await access(this.credentialsPath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verify that valid credentials exist
   */
  async verifyCredentials(): Promise<boolean> {
    try {
      const exists = await this.hasCredentials();
      if (!exists) {
        return false;
      }

      const content = await readFile(this.credentialsPath, 'utf-8');
      const credentials: Credentials = JSON.parse(content);

      // Check if we have either OAuth or API key
      if (credentials.claudeAiOauth?.accessToken || credentials.apiKey) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to verify credentials:', error);
      return false;
    }
  }

  /**
   * Get credentials (for display purposes, masked)
   */
  async getCredentialsSummary(): Promise<{ type: 'oauth' | 'api_key' | 'none'; masked: string }> {
    try {
      const content = await readFile(this.credentialsPath, 'utf-8');
      const credentials: Credentials = JSON.parse(content);

      if (credentials.claudeAiOauth?.accessToken) {
        return {
          type: 'oauth',
          masked: 'OAuth (claude.ai)'
        };
      }

      if (credentials.apiKey) {
        const key = credentials.apiKey;
        return {
          type: 'api_key',
          masked: `${key.slice(0, 10)}...${key.slice(-4)}`
        };
      }

      return { type: 'none', masked: '' };
    } catch {
      return { type: 'none', masked: '' };
    }
  }
}
