import {
  AgentKit,
  wethActionProvider,
  walletActionProvider,
  erc20ActionProvider,
  pythActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import { Client, GatewayIntentBits, Events, Message, TextChannel } from 'discord.js';
import { bettingActionProvider } from "./betting-action";
import { ArbitrumWalletProvider } from "./arbitrumWalletProvider";

dotenv.config();

function validateEnvironment(): void {
  const missingVars: string[] = [];

  const requiredVars = [
    "OPENAI_API_KEY",
    "PRIVATE_KEY",
    "DISCORD_TOKEN",
    "DISCORD_CHANNEL_ID",
    "BETTING_CONTRACT_ADDRESS",
  ];
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    console.error("Error: Required environment variables are not set");
    missingVars.forEach(varName => {
      console.error(`${varName}=your_${varName.toLowerCase()}_here`);
    });
    process.exit(1);
  }

  if (!process.env.NETWORK_ID) {
    console.warn("Warning: NETWORK_ID not set, defaulting to base-sepolia testnet");
  }
}

validateEnvironment();

const WALLET_DATA_FILE = "wallet_data.txt";

async function initializeAgent() {
  try {
    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
    });

    const walletProvider = await ArbitrumWalletProvider.configure({
      privateKey: process.env.PRIVATE_KEY,
    });

    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        wethActionProvider(),
        pythActionProvider(),
        walletActionProvider(),
        erc20ActionProvider(),
        bettingActionProvider(),
      ],
    });

    const tools = await getLangChainTools(agentkit);
    const memory = new MemorySaver();
    const agentConfig = { configurable: { thread_id: "CDP AgentKit Discord Bot!" } };

    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
      messageModifier: `
        You are Betty, an AI assistant that helps users create and manage sports betting smart contracts on Etherium.
        You can deploy and manage betting smart contracts, interact with Chainlink to fetch sports results, and facilitate transactions using MetaMask Wallet or Base Wallet.
        
        When a user wants to create a bet, guide them through the following steps:
        1. **Match Details:** Ask for the event name, teams or players involved, and the scheduled match date.
        2. **Bet Conditions:** Clarify the type of bet (win/lose, over/under, score prediction, etc.).
        3. **Stake and Participation:** Determine the amount to bet, the minimum and maximum number of participants, and if there is a deadline for joining.
        4. **Data Source:** Confirm the source for match results (e.g., Chainlink oracle) and when the result will be available.
        5. **Handling Edge Cases:** Ask how to handle scenarios where no one wins or the event is canceled.
        
        If the result is not available at the expected time, retry up to five times before refunding the stakes.
        Be concise and clear in your responses. If a user requests functionality beyond your capabilities, encourage them to explore the CDP SDK + AgentKit and refer them to docs.arbitrum.io for more details.
      `,
    });

    return { agent, config: agentConfig };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error;
  }
}

async function handleDiscordMessage(message: Message, agent: any, config: any) {
  try {
    if (message.author.bot) return;
    if (message.channelId !== process.env.DISCORD_CHANNEL_ID) return;

    if (message.channel instanceof TextChannel) {
      await message.channel.sendTyping();
    }
    const stream = await agent.stream({ messages: [new HumanMessage(message.content)] }, config);

    let responseContent = '';
    for await (const chunk of stream) {
      if ("agent" in chunk) {
        responseContent += chunk.agent.messages[0].content + '\n';
      } else if ("tools" in chunk) {
        responseContent += chunk.tools.messages[0].content + '\n';
      }
    }

    const MAX_MESSAGE_LENGTH = 2000;
    while (responseContent.length > 0) {
      const chunk = responseContent.slice(0, MAX_MESSAGE_LENGTH);
      await message.reply(chunk);
      responseContent = responseContent.slice(MAX_MESSAGE_LENGTH);
    }

  } catch (error) {
    console.error('Error handling message:', error);
    await message.reply('Lo siento, hubo un error procesando tu solicitud. Por favor, intenta de nuevo más tarde.');
  }
}

async function main() {
  try {
    const { agent, config } = await initializeAgent();

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    client.once(Events.ClientReady, c => {
      console.log(`¡Bot listo! Conectado como ${c.user.tag}`);
    });

    client.on(Events.MessageCreate, async (message) => {
      await handleDiscordMessage(message, agent, config);
    });

    await client.login(process.env.DISCORD_TOKEN);

  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  console.log("Iniciando Agente Discord...");
  main().catch(error => {
    console.error("Error fatal:", error);
    process.exit(1);
  });
}