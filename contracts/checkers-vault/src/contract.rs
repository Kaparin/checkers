use cosmwasm_std::{
    entry_point, to_json_binary, BankMsg, Binary, Coin, CosmosMsg, Deps, DepsMut, Env,
    MessageInfo, Order, Response, StdResult, Uint128,
};
use cw2::set_contract_version;

use crate::error::ContractError;
use crate::msg::{
    ConfigResponse, ExecuteMsg, GameResponse, GamesResponse, InstantiateMsg, QueryMsg,
};
use crate::state::{Config, Game, GameStatus, CONFIG, GAMES, NEXT_GAME_ID};

const CONTRACT_NAME: &str = "crates.io:checkers-vault";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");
const MAX_COMMISSION_BPS: u16 = 5000;
const DEFAULT_QUERY_LIMIT: u32 = 20;
const MAX_QUERY_LIMIT: u32 = 50;

// ═══════════════════════════════════════════════════════════════════
// INSTANTIATE
// ═══════════════════════════════════════════════════════════════════

#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;

    if msg.commission_bps > MAX_COMMISSION_BPS {
        return Err(ContractError::InvalidCommission {});
    }

    let treasury = deps.api.addr_validate(&msg.treasury)?;

    let config = Config {
        admin: info.sender.clone(),
        treasury,
        denom: msg.denom,
        commission_bps: msg.commission_bps,
        min_wager: msg.min_wager,
        resolve_timeout_secs: msg.resolve_timeout_secs,
    };

    CONFIG.save(deps.storage, &config)?;
    NEXT_GAME_ID.save(deps.storage, &1u64)?;

    Ok(Response::new()
        .add_attribute("action", "instantiate")
        .add_attribute("admin", info.sender))
}

// ═══════════════════════════════════════════════════════════════════
// EXECUTE
// ═══════════════════════════════════════════════════════════════════

#[entry_point]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::CreateGame {
            variant,
            time_per_move,
        } => execute_create_game(deps, env, info, variant, time_per_move),
        ExecuteMsg::JoinGame { game_id } => execute_join_game(deps, env, info, game_id),
        ExecuteMsg::ResolveGame { game_id, winner } => {
            execute_resolve_game(deps, env, info, game_id, winner)
        }
        ExecuteMsg::ResolveDraw { game_id } => execute_resolve_draw(deps, env, info, game_id),
        ExecuteMsg::CancelGame { game_id } => execute_cancel_game(deps, info, game_id),
        ExecuteMsg::ClaimTimeout { game_id } => execute_claim_timeout(deps, env, info, game_id),
        ExecuteMsg::UpdateConfig {
            treasury,
            commission_bps,
            min_wager,
            resolve_timeout_secs,
        } => execute_update_config(deps, info, treasury, commission_bps, min_wager, resolve_timeout_secs),
        ExecuteMsg::TransferAdmin { new_admin } => execute_transfer_admin(deps, info, new_admin),
    }
}

// ── Create Game ─────────────────────────────────────────────────────

fn execute_create_game(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    variant: String,
    time_per_move: u64,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;

    // Validate funds
    let wager = extract_native_amount(&info, &config.denom)?;
    if wager < config.min_wager {
        return Err(ContractError::WagerBelowMinimum {
            min: config.min_wager.to_string(),
        });
    }

    // Create game
    let game_id = NEXT_GAME_ID.load(deps.storage)?;
    NEXT_GAME_ID.save(deps.storage, &(game_id + 1))?;

    let game = Game {
        creator: info.sender.clone(),
        opponent: None,
        wager,
        variant,
        time_per_move,
        status: GameStatus::Open,
        winner: None,
        started_at: None,
        resolved_at: None,
    };

    GAMES.save(deps.storage, game_id, &game)?;

    Ok(Response::new()
        .add_attribute("action", "create_game")
        .add_attribute("game_id", game_id.to_string())
        .add_attribute("creator", info.sender)
        .add_attribute("wager", wager))
}

// ── Join Game ───────────────────────────────────────────────────────

fn execute_join_game(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    game_id: u64,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    let mut game = GAMES
        .load(deps.storage, game_id)
        .map_err(|_| ContractError::GameNotFound {})?;

    // Validate state
    if game.status != GameStatus::Open {
        return Err(ContractError::InvalidStateTransition {
            expected: "open".to_string(),
            actual: game.status.to_string(),
        });
    }
    if game.creator == info.sender {
        return Err(ContractError::SelfJoinNotAllowed {});
    }

    // Validate funds match wager
    let sent = extract_native_amount(&info, &config.denom)?;
    if sent != game.wager {
        return Err(ContractError::IncorrectWager {
            expected: game.wager.to_string(),
            sent: sent.to_string(),
        });
    }

    // Update game
    game.opponent = Some(info.sender.clone());
    game.status = GameStatus::Active;
    game.started_at = Some(env.block.time.seconds());
    GAMES.save(deps.storage, game_id, &game)?;

    Ok(Response::new()
        .add_attribute("action", "join_game")
        .add_attribute("game_id", game_id.to_string())
        .add_attribute("opponent", info.sender))
}

// ── Resolve Game (admin/relayer only) ───────────────────────────────

fn execute_resolve_game(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    game_id: u64,
    winner_addr: String,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    if info.sender != config.admin {
        return Err(ContractError::Unauthorized {});
    }

    let mut game = GAMES
        .load(deps.storage, game_id)
        .map_err(|_| ContractError::GameNotFound {})?;

    if game.status != GameStatus::Active {
        return Err(ContractError::InvalidStateTransition {
            expected: "active".to_string(),
            actual: game.status.to_string(),
        });
    }

    let winner = deps.api.addr_validate(&winner_addr)?;
    let opponent = game.opponent.clone().unwrap();

    // Winner must be one of the players
    if winner != game.creator && winner != opponent {
        return Err(ContractError::InvalidWinner {});
    }

    // Calculate payout: total pot = 2 * wager, minus commission
    let total_pot = game.wager * Uint128::new(2);
    let commission = total_pot * Uint128::from(config.commission_bps) / Uint128::new(10_000);
    let payout = total_pot - commission;

    game.status = GameStatus::Resolved;
    game.winner = Some(winner.clone());
    game.resolved_at = Some(env.block.time.seconds());
    GAMES.save(deps.storage, game_id, &game)?;

    // Send payout to winner + commission to treasury
    let mut msgs: Vec<CosmosMsg> = vec![];

    if !payout.is_zero() {
        msgs.push(CosmosMsg::Bank(BankMsg::Send {
            to_address: winner.to_string(),
            amount: vec![Coin {
                denom: config.denom.clone(),
                amount: payout,
            }],
        }));
    }
    if !commission.is_zero() {
        msgs.push(CosmosMsg::Bank(BankMsg::Send {
            to_address: config.treasury.to_string(),
            amount: vec![Coin {
                denom: config.denom,
                amount: commission,
            }],
        }));
    }

    Ok(Response::new()
        .add_messages(msgs)
        .add_attribute("action", "resolve_game")
        .add_attribute("game_id", game_id.to_string())
        .add_attribute("winner", winner)
        .add_attribute("payout", payout)
        .add_attribute("commission", commission))
}

// ── Resolve Draw (admin/relayer only) ───────────────────────────────

fn execute_resolve_draw(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    game_id: u64,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    if info.sender != config.admin {
        return Err(ContractError::Unauthorized {});
    }

    let mut game = GAMES
        .load(deps.storage, game_id)
        .map_err(|_| ContractError::GameNotFound {})?;

    if game.status != GameStatus::Active {
        return Err(ContractError::InvalidStateTransition {
            expected: "active".to_string(),
            actual: game.status.to_string(),
        });
    }

    let opponent = game.opponent.clone().unwrap();

    game.status = GameStatus::Draw;
    game.resolved_at = Some(env.block.time.seconds());
    GAMES.save(deps.storage, game_id, &game)?;

    // Refund both players their wager
    let mut msgs: Vec<CosmosMsg> = vec![];
    if !game.wager.is_zero() {
        msgs.push(CosmosMsg::Bank(BankMsg::Send {
            to_address: game.creator.to_string(),
            amount: vec![Coin {
                denom: config.denom.clone(),
                amount: game.wager,
            }],
        }));
        msgs.push(CosmosMsg::Bank(BankMsg::Send {
            to_address: opponent.to_string(),
            amount: vec![Coin {
                denom: config.denom,
                amount: game.wager,
            }],
        }));
    }

    Ok(Response::new()
        .add_messages(msgs)
        .add_attribute("action", "resolve_draw")
        .add_attribute("game_id", game_id.to_string()))
}

// ── Cancel Game ─────────────────────────────────────────────────────

fn execute_cancel_game(
    deps: DepsMut,
    info: MessageInfo,
    game_id: u64,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    let mut game = GAMES
        .load(deps.storage, game_id)
        .map_err(|_| ContractError::GameNotFound {})?;

    if game.status != GameStatus::Open {
        return Err(ContractError::InvalidStateTransition {
            expected: "open".to_string(),
            actual: game.status.to_string(),
        });
    }

    // Only creator or admin can cancel
    if info.sender != game.creator && info.sender != config.admin {
        return Err(ContractError::Unauthorized {});
    }

    game.status = GameStatus::Canceled;
    GAMES.save(deps.storage, game_id, &game)?;

    // Refund creator
    let msg = CosmosMsg::Bank(BankMsg::Send {
        to_address: game.creator.to_string(),
        amount: vec![Coin {
            denom: config.denom,
            amount: game.wager,
        }],
    });

    Ok(Response::new()
        .add_message(msg)
        .add_attribute("action", "cancel_game")
        .add_attribute("game_id", game_id.to_string()))
}

// ── Claim Timeout ───────────────────────────────────────────────────

fn execute_claim_timeout(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    game_id: u64,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    let mut game = GAMES
        .load(deps.storage, game_id)
        .map_err(|_| ContractError::GameNotFound {})?;

    if game.status != GameStatus::Active {
        return Err(ContractError::InvalidStateTransition {
            expected: "active".to_string(),
            actual: game.status.to_string(),
        });
    }

    // Only players can claim
    let opponent = game.opponent.clone().unwrap();
    if info.sender != game.creator && info.sender != opponent {
        return Err(ContractError::Unauthorized {});
    }

    // Check timeout
    let started = game.started_at.unwrap();
    let deadline = started + config.resolve_timeout_secs;
    if env.block.time.seconds() < deadline {
        return Err(ContractError::DeadlineNotReached {});
    }

    // Claimer wins (gets full pot minus commission)
    let total_pot = game.wager * Uint128::new(2);
    let commission = total_pot * Uint128::from(config.commission_bps) / Uint128::new(10_000);
    let payout = total_pot - commission;

    game.status = GameStatus::TimeoutClaimed;
    game.winner = Some(info.sender.clone());
    game.resolved_at = Some(env.block.time.seconds());
    GAMES.save(deps.storage, game_id, &game)?;

    let mut msgs: Vec<CosmosMsg> = vec![];
    if !payout.is_zero() {
        msgs.push(CosmosMsg::Bank(BankMsg::Send {
            to_address: info.sender.to_string(),
            amount: vec![Coin {
                denom: config.denom.clone(),
                amount: payout,
            }],
        }));
    }
    if !commission.is_zero() {
        msgs.push(CosmosMsg::Bank(BankMsg::Send {
            to_address: config.treasury.to_string(),
            amount: vec![Coin {
                denom: config.denom,
                amount: commission,
            }],
        }));
    }

    Ok(Response::new()
        .add_messages(msgs)
        .add_attribute("action", "claim_timeout")
        .add_attribute("game_id", game_id.to_string())
        .add_attribute("claimer", info.sender)
        .add_attribute("payout", payout))
}

// ── Update Config ───────────────────────────────────────────────────

fn execute_update_config(
    deps: DepsMut,
    info: MessageInfo,
    treasury: Option<String>,
    commission_bps: Option<u16>,
    min_wager: Option<Uint128>,
    resolve_timeout_secs: Option<u64>,
) -> Result<Response, ContractError> {
    let mut config = CONFIG.load(deps.storage)?;
    if info.sender != config.admin {
        return Err(ContractError::Unauthorized {});
    }

    if let Some(t) = treasury {
        config.treasury = deps.api.addr_validate(&t)?;
    }
    if let Some(c) = commission_bps {
        if c > MAX_COMMISSION_BPS {
            return Err(ContractError::InvalidCommission {});
        }
        config.commission_bps = c;
    }
    if let Some(m) = min_wager {
        config.min_wager = m;
    }
    if let Some(r) = resolve_timeout_secs {
        config.resolve_timeout_secs = r;
    }

    CONFIG.save(deps.storage, &config)?;

    Ok(Response::new().add_attribute("action", "update_config"))
}

// ── Transfer Admin ──────────────────────────────────────────────────

fn execute_transfer_admin(
    deps: DepsMut,
    info: MessageInfo,
    new_admin: String,
) -> Result<Response, ContractError> {
    let mut config = CONFIG.load(deps.storage)?;
    if info.sender != config.admin {
        return Err(ContractError::Unauthorized {});
    }

    config.admin = deps.api.addr_validate(&new_admin)?;
    CONFIG.save(deps.storage, &config)?;

    Ok(Response::new()
        .add_attribute("action", "transfer_admin")
        .add_attribute("new_admin", new_admin))
}

// ═══════════════════════════════════════════════════════════════════
// QUERY
// ═══════════════════════════════════════════════════════════════════

#[entry_point]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::Config {} => to_json_binary(&query_config(deps)?),
        QueryMsg::Game { game_id } => to_json_binary(&query_game(deps, game_id)?),
        QueryMsg::OpenGames { start_after, limit } => {
            to_json_binary(&query_open_games(deps, start_after, limit)?)
        }
        QueryMsg::UserGames {
            address,
            status,
            start_after,
            limit,
        } => to_json_binary(&query_user_games(deps, address, status, start_after, limit)?),
    }
}

fn query_config(deps: Deps) -> StdResult<ConfigResponse> {
    let config = CONFIG.load(deps.storage)?;
    Ok(config.into())
}

fn query_game(deps: Deps, game_id: u64) -> StdResult<GameResponse> {
    let game = GAMES.load(deps.storage, game_id)?;
    Ok(GameResponse::from_game(game_id, game))
}

fn query_open_games(
    deps: Deps,
    start_after: Option<u64>,
    limit: Option<u32>,
) -> StdResult<GamesResponse> {
    let limit = limit.unwrap_or(DEFAULT_QUERY_LIMIT).min(MAX_QUERY_LIMIT) as usize;
    let start = start_after.map(|s| cw_storage_plus::Bound::exclusive(s));

    let games: Vec<GameResponse> = GAMES
        .range(deps.storage, start, None, Order::Ascending)
        .filter_map(|r| {
            r.ok().and_then(|(id, g)| {
                if matches!(g.status, GameStatus::Open) {
                    Some(GameResponse::from_game(id, g))
                } else {
                    None
                }
            })
        })
        .take(limit)
        .collect();

    Ok(GamesResponse { games })
}

fn query_user_games(
    deps: Deps,
    address: String,
    status: Option<String>,
    start_after: Option<u64>,
    limit: Option<u32>,
) -> StdResult<GamesResponse> {
    let addr = deps.api.addr_validate(&address)?;
    let limit = limit.unwrap_or(DEFAULT_QUERY_LIMIT).min(MAX_QUERY_LIMIT) as usize;
    let start = start_after.map(|s| cw_storage_plus::Bound::exclusive(s));

    let status_filter: Option<GameStatus> = status.and_then(|s| match s.as_str() {
        "open" => Some(GameStatus::Open),
        "active" => Some(GameStatus::Active),
        "resolved" => Some(GameStatus::Resolved),
        "canceled" => Some(GameStatus::Canceled),
        _ => None,
    });

    let games: Vec<GameResponse> = GAMES
        .range(deps.storage, start, None, Order::Descending)
        .filter_map(|r| {
            r.ok().and_then(|(id, g)| {
                let is_player = g.creator == addr
                    || g.opponent.as_ref().map_or(false, |o| *o == addr);
                if !is_player {
                    return None;
                }
                if let Some(ref sf) = status_filter {
                    if std::mem::discriminant(&g.status) != std::mem::discriminant(sf) {
                        return None;
                    }
                }
                Some(GameResponse::from_game(id, g))
            })
        })
        .take(limit)
        .collect();

    Ok(GamesResponse { games })
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/// Extract native coin amount from message info, validating denom
fn extract_native_amount(info: &MessageInfo, denom: &str) -> Result<Uint128, ContractError> {
    if info.funds.is_empty() {
        return Err(ContractError::NoFundsSent {});
    }
    if info.funds.len() > 1 {
        return Err(ContractError::MultipleDenomsSent {});
    }
    let coin = &info.funds[0];
    if coin.denom != denom {
        return Err(ContractError::WrongDenom {
            expected: denom.to_string(),
            got: coin.denom.clone(),
        });
    }
    Ok(coin.amount)
}
