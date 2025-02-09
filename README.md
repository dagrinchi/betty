# Betty - AI Sports Betting Agent

[![Docker Pulls](https://img.shields.io/docker/pulls/dagrinchi/betting-agentai)](https://hub.docker.com/r/dagrinchi/betting-agentai)
[![Docker Image Version](https://img.shields.io/docker/v/dagrinchi/betting-agentai/latest)](https://hub.docker.com/r/dagrinchi/betting-agentai/tags)

Betty is an AI agent for sports betting with friends on Discord. It creates bets using smart contracts on Arbitrum Stylus, manages deposits via Metamask, and automates payouts with Chainlink results—making group betting seamless and trustless.

## Features
- **Smart Contract Integration:** Bets are secured with Arbitrum Stylus smart contracts.
- **Web3 Transactions:** Manages deposits and payouts via Metamask.
- **Automated Payouts:** Uses Chainlink to fetch match results and distribute funds.
- **Seamless Discord Experience:** No need for a traditional frontend; everything happens within Discord.
- **Trustless Betting:** No intermediaries, ensuring fairness and transparency.

## How It Works
1. **Create a Bet:** A user sets up a bet in Discord with Betty's guidance.
2. **Smart Contract Deployment:** Betty generates a smart contract and a unique betting link.
3. **Friends Join:** Users place their bets using Metamask.
4. **Match Result Fetching:** Chainlink provides verified match results.
5. **Payout Distribution:** The smart contract automatically distributes winnings.

## Getting Started
### Prerequisites
- A **Discord account** to interact with Betty.
- A **Metamask wallet** for placing bets.
- **Arbitrum Stylus setup** for executing smart contracts.
- Chainlink for **oracles and match results**.
- Docker installed on your system (for Docker deployment)

### Installation

#### Using Docker

Pull and run the Docker image:

```bash
# Pull the latest version
docker pull dagrinchi/betting-agentai:latest

# Run with environment variables
docker run -d \
  --name betting-agentai \
  --env-file .env \
  dagrinchi/betting-agentai:latest
```

Required environment variables in `.env`:
```env
# OpenAI API Key for AI functionality
OPENAI_API_KEY=your-openai-key

# Wallet Private Key for transactions
PRIVATE_KEY=your-wallet-private-key

# Discord Configuration
DISCORD_TOKEN=your-discord-token
DISCORD_CHANNEL_ID=your-channel-id

# Smart Contract
BETTING_CONTRACT_ADDRESS=your-contract-address
```

#### Using Docker Compose

Create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  betting-agent:
    image: dagrinchi/betting-agentai:latest
    container_name: betting-agentai
    env_file:
      - .env
    restart: unless-stopped
```

Then run:
```bash
docker-compose up -d
```

## Roadmap
- Add multi-sport support.
- Enhance UI/UX for Discord interactions.
- Implement additional analytics for betting strategies.

## License
This project is licensed under the MIT License.

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss the proposed changes.

## Contact
For inquiries or support, reach me via Discord or open an issue in this repository.