use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::{Addr, Uint128};
use crate::state::{Config, Game, GameStatus};

// ── Instantiate ─────────────────────────────────────────────────────

#[cw_serde]
pub struct InstantiateMsg {
    /// Treasury address
    pub treasury: String,
    /// Accepted native denom
    pub denom: String,
    /// Commission in basis points (max 5000 = 50%)
    pub commission_bps: u16,
    /// Minimum wager amount
    pub min_wager: Uint128,
    /// Timeout for relayer resolution (seconds)
    pub resolve_timeout_secs: u64,
}

// ── Execute ─────────────────────────────────────────────────────────

#[cw_serde]
pub enum ExecuteMsg {
    /// Create a new game. Sender locks wager (sent as native funds).
    CreateGame {
        variant: String,
        time_per_move: u64,
    },
    /// Join an open game. Sender locks wager (sent as native funds).
    JoinGame {
        game_id: u64,
    },
    /// Resolve game — only admin (relayer). Pays winner minus commission.
    ResolveGame {
        game_id: u64,
        winner: String,
    },
    /// Resolve game as draw — only admin (relayer). Both players get refund.
    ResolveDraw {
        game_id: u64,
    },
    /// Cancel an open game — only creator, before opponent joins.
    CancelGame {
        game_id: u64,
    },
    /// Claim timeout — any player, only if game is Active and
    /// resolve_timeout_secs passed since started_at.
    /// The claimer wins by default.
    ClaimTimeout {
        game_id: u64,
    },
    /// Admin: update config
    UpdateConfig {
        treasury: Option<String>,
        commission_bps: Option<u16>,
        min_wager: Option<Uint128>,
        resolve_timeout_secs: Option<u64>,
    },
    /// Admin: transfer admin to new address
    TransferAdmin {
        new_admin: String,
    },
}

// ── Query ───────────────────────────────────────────────────────────

#[cw_serde]
#[derive(QueryResponses)]
pub enum QueryMsg {
    #[returns(ConfigResponse)]
    Config {},

    #[returns(GameResponse)]
    Game { game_id: u64 },

    #[returns(GamesResponse)]
    OpenGames {
        start_after: Option<u64>,
        limit: Option<u32>,
    },

    #[returns(GamesResponse)]
    UserGames {
        address: String,
        status: Option<String>,
        start_after: Option<u64>,
        limit: Option<u32>,
    },
}

// ── Response types ──────────────────────────────────────────────────

#[cw_serde]
pub struct ConfigResponse {
    pub admin: Addr,
    pub treasury: Addr,
    pub denom: String,
    pub commission_bps: u16,
    pub min_wager: Uint128,
    pub resolve_timeout_secs: u64,
}

impl From<Config> for ConfigResponse {
    fn from(c: Config) -> Self {
        ConfigResponse {
            admin: c.admin,
            treasury: c.treasury,
            denom: c.denom,
            commission_bps: c.commission_bps,
            min_wager: c.min_wager,
            resolve_timeout_secs: c.resolve_timeout_secs,
        }
    }
}

#[cw_serde]
pub struct GameResponse {
    pub game_id: u64,
    pub creator: Addr,
    pub opponent: Option<Addr>,
    pub wager: Uint128,
    pub variant: String,
    pub time_per_move: u64,
    pub status: GameStatus,
    pub winner: Option<Addr>,
    pub started_at: Option<u64>,
    pub resolved_at: Option<u64>,
}

impl GameResponse {
    pub fn from_game(game_id: u64, g: Game) -> Self {
        GameResponse {
            game_id,
            creator: g.creator,
            opponent: g.opponent,
            wager: g.wager,
            variant: g.variant,
            time_per_move: g.time_per_move,
            status: g.status,
            winner: g.winner,
            started_at: g.started_at,
            resolved_at: g.resolved_at,
        }
    }
}

#[cw_serde]
pub struct GamesResponse {
    pub games: Vec<GameResponse>,
}
