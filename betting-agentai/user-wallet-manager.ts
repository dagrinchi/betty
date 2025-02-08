import { z } from "zod";
import { Message } from 'discord.js';
import * as fs from 'fs';

interface UserWallet {
  discordId: string;
  discordUsername: string;
  walletAddress: string;
  lastUsed: Date;
}

const registerWalletSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address")
});

class UserWalletManager {
  private userWallets: Map<string, UserWallet>;
  private readonly STORAGE_PATH = 'user-wallets.json';

  constructor() {
    this.userWallets = new Map();
    this.loadWallets();
  }

  private loadWallets() {
    try {
      if (fs.existsSync(this.STORAGE_PATH)) {
        const data = JSON.parse(fs.readFileSync(this.STORAGE_PATH, 'utf8'));
        this.userWallets = new Map(Object.entries(data));
      }
    } catch (error) {
      console.error('Error loading wallets:', error);
    }
  }

  private saveWallets() {
    try {
      const data = Object.fromEntries(this.userWallets);
      fs.writeFileSync(this.STORAGE_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving wallets:', error);
    }
  }

  async registerWallet(message: Message, walletAddress: string): Promise<string> {
    try {
      registerWalletSchema.parse({ walletAddress });
      const userWallet: UserWallet = {
        discordId: message.author.id,
        discordUsername: message.author.username,
        walletAddress,
        lastUsed: new Date()
      };

      this.userWallets.set(message.author.id, userWallet);
      this.saveWallets();

      return `Wallet ${walletAddress} successfully registered for ${message.author.username}`;
    } catch (error) {
      return `Error registering wallet: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  getWalletAddress(discordId: string): string | null {
    const userWallet = this.userWallets.get(discordId);
    return userWallet ? userWallet.walletAddress : null;
  }

  isWalletRegistered(discordId: string): boolean {
    return this.userWallets.has(discordId);
  }

  updateLastUsed(discordId: string) {
    const userWallet = this.userWallets.get(discordId);
    if (userWallet) {
      userWallet.lastUsed = new Date();
      this.userWallets.set(discordId, userWallet);
      this.saveWallets();
    }
  }
}

export const userWalletManager = new UserWalletManager();