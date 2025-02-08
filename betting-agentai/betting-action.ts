import { ActionProvider } from "@coinbase/agentkit";

class BettingActionProvider extends ActionProvider {
  constructor() {
    super("betting", []);
  }
  supportsNetwork = (_: any) => true;
}

export const bettingActionProvider = () => new BettingActionProvider();