import { ActionProvider, CreateAction, EvmWalletProvider } from "@coinbase/agentkit";
import { z } from "zod";
import abi from "../betting-contract/src/betting.json";
import { encodeFunctionData } from "viem";

const createBetSchema = z.object({
  eventName: z.string(),
  deadline: z.number(),
  options: z.array(z.number())
});

class BettingActionProvider extends ActionProvider {
  constructor() {
    super("betting", []);
  }
  supportsNetwork = (_: any) => true;

  @CreateAction({
    name: "create_bet",
    description: `
      Creates a new betting event with the specified parameters.
      Takes the following inputs:
      - eventName: Name of the betting event
      - deadline: Timestamp for when the bet ends
      - options: Array of numeric options for the bet
      `,
    schema: createBetSchema,
  })
  async createBet(walletProvider: EvmWalletProvider, args: z.infer<typeof createBetSchema>) {
    try {
      const hash = await walletProvider.sendTransaction({
        to: process.env.BETTING_CONTRACT_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi,
          functionName: "createBet",
          args: [args.eventName, BigInt(args.deadline), args.options.map(BigInt)],
        }),
      });

      await walletProvider.waitForTransactionReceipt(hash);
      return `Created new bet "${args.eventName}". Transaction hash: ${hash}`;
    } catch (error) {
      return `Error creating bet: ${error}`;
    }
  }
}

export const bettingActionProvider = () => new BettingActionProvider();