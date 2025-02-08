import {
  EvmWalletProvider,
  Network
} from "@coinbase/agentkit";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  TransactionRequest,
  ReadContractParameters,
  ReadContractReturnType,
  Account
} from "viem";
import { arbitrumSepolia } from "viem/chains";
import { privateKeyToAccount, mnemonicToAccount } from "viem/accounts";

interface ArbitrumWalletConfig {
  privateKey?: string;
  mnemonicPhrase?: string;
  rpcUrl?: string;
}

export class ArbitrumWalletProvider extends EvmWalletProvider {
  private walletClient: any;
  private publicClient: any;
  private account: Account;
  private network: Network;

  constructor(account: Account, publicClient: any, walletClient: any) {
    super();
    this.account = account;
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.network = {
      protocolFamily: "evm",
      networkId: "arbitrum-sepolia",
      chainId: "421614"
    };
  }

  static async configure(config: ArbitrumWalletConfig): Promise<ArbitrumWalletProvider> {
    try {
      let account: Account;

      if (config.privateKey) {
        const privateKey = config.privateKey.startsWith('0x')
          ? config.privateKey as `0x${string}`
          : `0x${config.privateKey}` as `0x${string}`;

        account = privateKeyToAccount(privateKey);
      } else if (config.mnemonicPhrase) {
        account = mnemonicToAccount(config.mnemonicPhrase);
      } else {
        throw new Error("Either privateKey or mnemonicPhrase must be provided");
      }

      const rpcUrl = config.rpcUrl || "https://sepolia-rollup.arbitrum.io/rpc";

      const publicClient = createPublicClient({
        chain: arbitrumSepolia,
        transport: http(rpcUrl)
      });

      const walletClient = createWalletClient({
        account,
        chain: arbitrumSepolia,
        transport: http(rpcUrl)
      });

      return new ArbitrumWalletProvider(account, publicClient, walletClient);
    } catch (error) {
      throw new Error(`Failed to initialize ArbitrumWalletProvider: ${error}`);
    }
  }

  getAddress(): string {
    return this.account.address;
  }

  getNetwork(): Network {
    return this.network;
  }

  getName(): string {
    return "ArbitrumWalletProvider";
  }

  async getBalance(): Promise<bigint> {
    return await this.publicClient.getBalance({
      address: this.account.address
    });
  }

  async nativeTransfer(to: `0x${string}`, value: string): Promise<`0x${string}`> {
    const hash = await this.walletClient.sendTransaction({
      to,
      value: parseEther(value),
      account: this.account
    });
    return hash;
  }

  async signMessage(message: string | Uint8Array): Promise<`0x${string}`> {
    return await this.walletClient.signMessage({
      message,
      account: this.account
    });
  }

  async signTypedData(typedData: any): Promise<`0x${string}`> {
    return await this.walletClient.signTypedData({
      ...typedData,
      account: this.account
    });
  }

  async signTransaction(transaction: TransactionRequest): Promise<`0x${string}`> {
    return await this.walletClient.signTransaction({
      ...transaction,
      account: this.account
    });
  }

  async sendTransaction(transaction: TransactionRequest): Promise<`0x${string}`> {
    const hash = await this.walletClient.sendTransaction({
      ...transaction,
      account: this.account
    });
    return hash;
  }

  async waitForTransactionReceipt(txHash: `0x${string}`): Promise<any> {
    return await this.publicClient.waitForTransactionReceipt({
      hash: txHash
    });
  }

  async readContract(params: ReadContractParameters): Promise<ReadContractReturnType> {
    return await this.publicClient.readContract(params);
  }
}