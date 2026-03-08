use cosmwasm_schema::cw_serde;
use cosmwasm_std::{Addr, Uint128};
use cw_storage_plus::{Item, Map};

#[cw_serde]
pub struct Config {
    /// Admin address (relayer that can resolve games)
    pub admin: Addr,
    /// Treasury address (receives commission)
    pub treasury: Addr,
    /// Accepted native denom (e.g. "uaxm")
    pub denom: String,
    /// Commission in basis points (e.g. 1000 = 10%)
    pub commission_bps: u16,
    /// Minimum wager amount
    pub min_wager: Uint128,
    /// Timeout in seconds after which opponent can claim (safety net)
    pub resolve_timeout_secs: u64,
}

#[cw_serde]
pub enum GameStatus {
    /// Waiting for opponent to join
    Open,
    /// Both players joined, game in progress
    Active,
    /// Game resolved by relayer
    Resolved,
    /// Canceled by creator before opponent joined
    Canceled,
    /// Resolved via timeout claim (relayer didn't resolve in time)
    TimeoutClaimed,
    /// Resolved as draw — both players get their wager back
    Draw,
}

impl std::fmt::Display for GameStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GameStatus::Open => write!(f, "open"),
            GameStatus::Active => write!(f, "active"),
            GameStatus::Resolved => write!(f, "resolved"),
            GameStatus::Canceled => write!(f, "canceled"),
            GameStatus::TimeoutClaimed => write!(f, "timeout_claimed"),
            GameStatus::Draw => write!(f, "draw"),
        }
    }
}

#[cw_serde]
pub struct Game {
    /// Game creator (plays black)
    pub creator: Addr,
    /// Opponent (plays white), None if still open
    pub opponent: Option<Addr>,
    /// Wager amount per player
    pub wager: Uint128,
    /// Game variant ("russian" or "american")
    pub variant: String,
    /// Time per move in seconds
    pub time_per_move: u64,
    /// Current status
    pub status: GameStatus,
    /// Winner address (set on resolution)
    pub winner: Option<Addr>,
    /// Block time when game became Active (opponent joined)
    pub started_at: Option<u64>,
    /// Block time when game was resolved
    pub resolved_at: Option<u64>,
}

pub const CONFIG: Item<Config> = Item::new("config");
pub const NEXT_GAME_ID: Item<u64> = Item::new("next_game_id");
pub const GAMES: Map<u64, Game> = Map::new("games");
