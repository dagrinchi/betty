import { ActionProvider, CreateAction, EvmWalletProvider } from "@coinbase/agentkit";
import { z } from "zod";
import contractAbi from "../betting-contract/src/betting.json";
import { Abi, encodeFunctionData } from "viem";

const abi: Abi = contractAbi as Abi;

const createBetSchema = z.object({
  eventName: z.string(),
  deadline: z.number(),
  options: z.array(z.number())
});

const betQuerySchema = z.object({
  betId: z.number()
});

const joinBetSchema = z.object({
  betId: z.number(),
  option: z.number(),
  amount: z.string()
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

  @CreateAction({
    name: "get_bet_details",
    description: `
      Gets all details about a specific bet.
      Takes the following input:
      - betId: ID of the bet to query
      `,
    schema: betQuerySchema,
  })
  async getBetDetails(walletProvider: EvmWalletProvider, args: z.infer<typeof betQuerySchema>) {
    try {
      const [eventName, deadline, options, organizer, totalPool, resolved, winningOption] = await Promise.all([
        walletProvider.readContract({
          address: process.env.BETTING_CONTRACT_ADDRESS as `0x${string}`,
          abi,
          functionName: "getBetEventName",
          args: [BigInt(args.betId)],
        }),
        walletProvider.readContract({
          address: process.env.BETTING_CONTRACT_ADDRESS as `0x${string}`,
          abi,
          functionName: "getBetDeadline",
          args: [BigInt(args.betId)],
        }),
        walletProvider.readContract({
          address: process.env.BETTING_CONTRACT_ADDRESS as `0x${string}`,
          abi,
          functionName: "getBetOptions",
          args: [BigInt(args.betId)],
        }),
        walletProvider.readContract({
          address: process.env.BETTING_CONTRACT_ADDRESS as `0x${string}`,
          abi,
          functionName: "getBetOrganizer",
          args: [BigInt(args.betId)],
        }),
        walletProvider.readContract({
          address: process.env.BETTING_CONTRACT_ADDRESS as `0x${string}`,
          abi,
          functionName: "getBetTotalPool",
          args: [BigInt(args.betId)],
        }),
        walletProvider.readContract({
          address: process.env.BETTING_CONTRACT_ADDRESS as `0x${string}`,
          abi,
          functionName: "getBetResolved",
          args: [BigInt(args.betId)],
        }),
        walletProvider.readContract({
          address: process.env.BETTING_CONTRACT_ADDRESS as `0x${string}`,
          abi,
          functionName: "getBetWinningOption",
          args: [BigInt(args.betId)],
        })
      ]);

      const deadlineDate = new Date(Number(deadline) * 1000).toLocaleString();
      const totalPoolETH = Number(totalPool) / 1e18;

      return `
**Bet details**  

- 📌 **Event name:** ${eventName}
- ⏳ **Deadline:** ${deadlineDate}  
- 🎯 **Options:** ${Array(options).join(', ')}  
- 👤 **Organizer Wallet:** ${organizer}  
- 💰 **Pool:** ${totalPoolETH} ETH  
- ✅ **Resolved:** ${resolved ? 'Yes' : 'No'}  
${resolved ? `- 🏆 **Winner option:** ${winningOption}` : ''}
  `;
    } catch (error) {
      return `Error getting bet details: ${error}`;
    }
  }

  @CreateAction({
    name: "join_bet",
    description: `
    Joins an existing bet with the specified option and amount.
    Takes the following inputs:
    - betId: ID of the bet to join
    - option: Your chosen option number
    - amount: Amount of ETH to bet
    `,
    schema: joinBetSchema,
  })
  async joinBet(walletProvider: EvmWalletProvider, args: z.infer<typeof joinBetSchema>) {
    try {
      const hash = await walletProvider.sendTransaction({
        to: process.env.BETTING_CONTRACT_ADDRESS as `0x${string}`,
        value: BigInt(args.amount),
        data: encodeFunctionData({
          abi,
          functionName: "joinBet",
          args: [BigInt(args.betId), BigInt(args.option)],
        }),
      });

      await walletProvider.waitForTransactionReceipt(hash);
      return `Joined bet ${args.betId} with option ${args.option}. Transaction hash: ${hash}`;
    } catch (error) {
      return `Error joining bet: ${error}`;
    }
  }
}

export const bettingActionProvider = () => new BettingActionProvider();