#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

use alloc::{string::String, vec::Vec};
use alloy_sol_types::sol;
use stylus_sdk::{
    alloy_primitives::{Address, U256},
    call::transfer_eth,
    evm, msg,
    prelude::*,
};

sol_storage! {
    #[entrypoint]
    pub struct BettingContract {
        uint256 bet_counter;
        mapping(uint256 => Bet) bets;
        mapping(uint256 => mapping(address => PlayerBet)) player_bets;
        mapping(uint256 => address[]) bet_players;
    }

    pub struct Bet {
        address organizer;
        string event_name;
        uint256 deadline;
        uint256[] options;
        uint256 total_pool;
        bool resolved;
        uint256 winning_option;
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
    event BetResolved(uint256 indexed bet_id, uint256 winning_option);
    event PrizeClaimed(uint256 indexed bet_id, address indexed winner, uint256 amount);
}

#[public]
impl BettingContract {
    pub fn bet_counter(&self) -> U256 {
        self.bet_counter.get()
    }

    pub fn create_bet(
        &mut self,
        event_name: String,
        deadline: U256,
        options: Vec<U256>,
    ) -> Result<U256, Vec<u8>> {
        if options.is_empty() {
            return Err("Must provide betting options".into());
        }

        let bet_id = self.bet_counter.get().saturating_add(U256::from(1));
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

        // Registrar la apuesta del jugador
        let mut bets_by_id = self.player_bets.setter(bet_id);
        let mut player_bet = bets_by_id.setter(msg::sender());
        player_bet.amount.set(amount);
        player_bet.option.set(option);
        player_bet.claimed.set(false);

        // Agregar jugador a la lista de participantes
        self.bet_players.setter(bet_id).push(msg::sender());

        // Actualizar el pool total
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

    pub fn resolve_bet(&mut self, bet_id: U256, winning_option: U256) -> Result<(), Vec<u8>> {
        let bet = self.bets.getter(bet_id);

        if bet.organizer.get() != msg::sender() {
            return Err("Only organizer can resolve bet".into());
        }

        if bet.resolved.get() {
            return Err("Bet already resolved".into());
        }

        let valid_option = {
            let options = &bet.options;
            let mut found = false;
            for i in 0..options.len() {
                if let Some(opt) = options.get(i) {
                    if opt == winning_option {
                        found = true;
                        break;
                    }
                }
            }
            found
        };

        if !valid_option {
            return Err("Invalid winning option".into());
        }

        let mut bet = self.bets.setter(bet_id);
        bet.resolved.set(true);
        bet.winning_option.set(winning_option);

        let event = BetResolved {
            bet_id,
            winning_option,
        };
        evm::log(event);

        Ok(())
    }

    pub fn claim_prize(&mut self, bet_id: U256) -> Result<(), Vec<u8>> {
        let bet = self.bets.getter(bet_id);
        if !bet.resolved.get() {
            return Err("Bet not resolved yet".into());
        }

        let bets_by_id = self.player_bets.getter(bet_id);
        let player_bet = bets_by_id.getter(msg::sender());

        let amount = player_bet.amount.get();
        if amount == U256::ZERO {
            return Err("No bet found for player".into());
        }

        if player_bet.claimed.get() {
            return Err("Prize already claimed".into());
        }

        if player_bet.option.get() != bet.winning_option.get() {
            return Err("Player did not win".into());
        }

        let total_winning_pool = self.calculate_winning_pool(bet_id)?;
        let prize = amount
            .checked_mul(bet.total_pool.get())
            .unwrap_or(U256::ZERO)
            .checked_div(total_winning_pool)
            .unwrap_or(U256::ZERO);

        let mut bets_by_id = self.player_bets.setter(bet_id);
        let mut player_bet = bets_by_id.setter(msg::sender());

        if transfer_eth(msg::sender(), prize).is_err() {
            return Err("Transfer failed".into());
        }
        player_bet.claimed.set(true);

        let event = PrizeClaimed {
            bet_id,
            winner: msg::sender(),
            amount: prize,
        };
        evm::log(event);

        Ok(())
    }

    fn calculate_winning_pool(&self, bet_id: U256) -> Result<U256, Vec<u8>> {
        let bet = self.bets.getter(bet_id);
        let winning_option = bet.winning_option.get();
        let players = &self.bet_players.getter(bet_id);

        let mut total_winning_pool = U256::ZERO;

        for i in 0..players.len() {
            if let Some(player) = players.get(i) {
                let bets_by_id = self.player_bets.getter(bet_id);
                let player_bet = bets_by_id.getter(player);
                if player_bet.option.get() == winning_option {
                    total_winning_pool += player_bet.amount.get();
                }
            }
        }

        if total_winning_pool == U256::ZERO {
            return Err("No winners found".into());
        }

        Ok(total_winning_pool)
    }

    // Getters para consultar el estado
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

    pub fn get_bet_winning_option(&self, bet_id: U256) -> U256 {
        self.bets.getter(bet_id).winning_option.get()
    }

    pub fn get_player_bet_amount(&self, bet_id: U256, player: Address) -> U256 {
        self.player_bets.getter(bet_id).getter(player).amount.get()
    }

    pub fn get_player_bet_option(&self, bet_id: U256, player: Address) -> U256 {
        self.player_bets.getter(bet_id).getter(player).option.get()
    }

    pub fn get_player_bet_claimed(&self, bet_id: U256, player: Address) -> bool {
        self.player_bets.getter(bet_id).getter(player).claimed.get()
    }

    pub fn get_bet_players(&self, bet_id: U256) -> Vec<Address> {
        let players = &self.bet_players.getter(bet_id);
        let len = players.len();
        let mut result = Vec::with_capacity(len);

        for i in 0..len {
            if let Some(player) = players.get(i) {
                result.push(player);
            }
        }

        result
    }
}
