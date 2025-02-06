#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

use stylus_sdk::{alloy_primitives::U256, prelude::*};

sol_storage! {
    #[entrypoint]
    pub struct BettingContract {
        uint256 bet_counter;
    }
}

#[public]
impl BettingContract {
    /// Gets the current bet counter
    pub fn bet_counter(&self) -> U256 {
        self.bet_counter.get()
    }

    /// Increment bet counter
    pub fn increment_counter(&mut self) {
        let current = self.bet_counter.get();
        self.bet_counter.set(current + U256::from(1));
    }
}
