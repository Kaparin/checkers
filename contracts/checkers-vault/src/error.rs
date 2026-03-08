use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("Unauthorized")]
    Unauthorized {},

    #[error("Game not found")]
    GameNotFound {},

    #[error("Invalid game state transition: expected {expected}, got {actual}")]
    InvalidStateTransition { expected: String, actual: String },

    #[error("Cannot join your own game")]
    SelfJoinNotAllowed {},

    #[error("Incorrect wager amount: expected {expected}, sent {sent}")]
    IncorrectWager { expected: String, sent: String },

    #[error("No funds sent")]
    NoFundsSent {},

    #[error("Multiple denoms sent")]
    MultipleDenomsSent {},

    #[error("Wrong denomination: expected {expected}, got {got}")]
    WrongDenom { expected: String, got: String },

    #[error("Wager below minimum ({min})")]
    WagerBelowMinimum { min: String },

    #[error("Resolve deadline not yet reached")]
    DeadlineNotReached {},

    #[error("Invalid commission rate")]
    InvalidCommission {},

    #[error("Winner must be one of the players")]
    InvalidWinner {},
}
