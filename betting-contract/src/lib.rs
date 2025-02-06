#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

use alloc::{string::String, vec::Vec};
use alloy_sol_types::sol;
use stylus_sdk::{
    alloy_primitives::{Address, U256},
    evm, msg,
    prelude::*,
};

sol_storage! {
    #[entrypoint]
    pub struct BettingContract {
        uint256 bet_counter;
        mapping(uint256 => Bet) bets;
        mapping(uint256 => mapping(address => PlayerBet)) player_bets;
    }

    pub struct Bet {
        address organizer;
        string event_name;
        uint256 deadline;
        uint256[] options;
        uint256 total_pool;
        bool resolved;
    }

    pub struct PlayerBet {
        uint256 amount;
        uint256 option;
        bool claimed;
    }
}

sol! {
    event BetCreated(uint256 indexed bet_id, address indexed organizer, string event_name);
    event PlayerJoined(uint256 indexed bet_id, address indexed player, uint256 amount, uint256 option);
}

#[public]
impl BettingContract {
    pub fn bet_counter(&self) -> U256 {
        self.bet_counter.get()
    }

    #[payable]
    pub fn create_bet(
        &mut self,
        event_name: String,
        deadline: U256,
        options: Vec<U256>,
    ) -> Result<U256, Vec<u8>> {
        if options.is_empty() {
            return Err("Must provide betting options".into());
        }

        let bet_id = self.bet_counter.get() + U256::from(1);
        self.bet_counter.set(bet_id);

        let mut bet = self.bets.setter(bet_id);
        bet.organizer.set(msg::sender());
        bet.event_name.set_str(&event_name);
        bet.deadline.set(deadline);

        for option in options {
            bet.options.push(option);
        }

        bet.total_pool.set(U256::ZERO);
        bet.resolved.set(false);

        let event = BetCreated {
            bet_id,
            organizer: msg::sender(),
            event_name: event_name.clone(),
        };
        evm::log(event);

        Ok(bet_id)
    }

    #[payable]
    pub fn join_bet(&mut self, bet_id: U256, option: U256) -> Result<(), Vec<u8>> {
        let bet = self.bets.getter(bet_id);
        if bet.resolved.get() {
            return Err("Bet is already resolved".into());
        }

        let valid_option = {
            let options = &bet.options;
            let mut found = false;
            for i in 0..options.len() {
                if let Some(opt) = options.get(i) {
                    if opt == option {
                        found = true;
                        break;
                    }
                }
            }
            found
        };

        if !valid_option {
            return Err("Invalid betting option".into());
        }

        let amount = msg::value();
        if amount == U256::ZERO {
            return Err("Must send funds to bet".into());
        }

        let mut bets_by_id = self.player_bets.setter(bet_id);
        let mut player_bet = bets_by_id.setter(msg::sender());
        player_bet.amount.set(amount);
        player_bet.option.set(option);
        player_bet.claimed.set(false);

        let current_total = bet.total_pool.get();
        let mut bet = self.bets.setter(bet_id);
        bet.total_pool.set(current_total + amount);

        let event = PlayerJoined {
            bet_id,
            player: msg::sender(),
            amount,
            option,
        };
        evm::log(event);

        Ok(())
    }

    pub fn get_bet_organizer(&self, bet_id: U256) -> Address {
        self.bets.getter(bet_id).organizer.get()
    }

    pub fn get_bet_deadline(&self, bet_id: U256) -> U256 {
        self.bets.getter(bet_id).deadline.get()
    }

    pub fn get_bet_options(&self, bet_id: U256) -> Vec<U256> {
        let options = &self.bets.getter(bet_id).options;
        let len = options.len();
        let mut result = Vec::with_capacity(len);

        for i in 0..len {
            if let Some(option) = options.get(i) {
                result.push(option);
            }
        }

        result
    }

    pub fn get_bet_total_pool(&self, bet_id: U256) -> U256 {
        self.bets.getter(bet_id).total_pool.get()
    }

    pub fn get_bet_resolved(&self, bet_id: U256) -> bool {
        self.bets.getter(bet_id).resolved.get()
    }

    pub fn get_player_bet_amount(&self, bet_id: U256, player: Address) -> U256 {
        self.player_bets.getter(bet_id).getter(player).amount.get()
    }

    pub fn get_player_bet_option(&self, bet_id: U256, player: Address) -> U256 {
        self.player_bets.getter(bet_id).getter(player).option.get()
    }
}
