use cosmwasm_std::testing::{mock_dependencies, mock_env, mock_info};
use cosmwasm_std::{coins, Addr, Uint128};

use crate::contract::{execute, instantiate, query};
use crate::msg::{ExecuteMsg, GameResponse, GamesResponse, InstantiateMsg, QueryMsg};
use crate::state::GameStatus;

const ADMIN: &str = "admin";
const TREASURY: &str = "treasury";
const PLAYER_A: &str = "player_a";
const PLAYER_B: &str = "player_b";
const DENOM: &str = "uaxm";

fn setup_contract() -> (cosmwasm_std::OwnedDeps<cosmwasm_std::MemoryStorage, cosmwasm_std::testing::MockApi, cosmwasm_std::testing::MockQuerier>, cosmwasm_std::Env) {
    let mut deps = mock_dependencies();
    let env = mock_env();
    let info = mock_info(ADMIN, &[]);

    let msg = InstantiateMsg {
        treasury: TREASURY.to_string(),
        denom: DENOM.to_string(),
        commission_bps: 1000, // 10%
        min_wager: Uint128::new(1_000_000),
        resolve_timeout_secs: 3600,
    };

    instantiate(deps.as_mut(), env.clone(), info, msg).unwrap();
    (deps, env)
}

fn create_game(deps: &mut cosmwasm_std::OwnedDeps<cosmwasm_std::MemoryStorage, cosmwasm_std::testing::MockApi, cosmwasm_std::testing::MockQuerier>, env: &cosmwasm_std::Env, sender: &str, wager: u128) -> u64 {
    let info = mock_info(sender, &coins(wager, DENOM));
    let msg = ExecuteMsg::CreateGame {
        variant: "russian".to_string(),
        time_per_move: 60,
    };
    let res = execute(deps.as_mut(), env.clone(), info, msg).unwrap();
    // Extract game_id from attributes
    res.attributes.iter()
        .find(|a| a.key == "game_id")
        .unwrap()
        .value
        .parse::<u64>()
        .unwrap()
}

fn query_game(deps: &cosmwasm_std::OwnedDeps<cosmwasm_std::MemoryStorage, cosmwasm_std::testing::MockApi, cosmwasm_std::testing::MockQuerier>, game_id: u64) -> GameResponse {
    let res = query(deps.as_ref(), mock_env(), QueryMsg::Game { game_id }).unwrap();
    cosmwasm_std::from_json(res).unwrap()
}

#[test]
fn test_create_game() {
    let (mut deps, env) = setup_contract();
    let game_id = create_game(&mut deps, &env, PLAYER_A, 5_000_000);

    let game = query_game(&deps, game_id);
    assert_eq!(game.game_id, 1);
    assert_eq!(game.creator, Addr::unchecked(PLAYER_A));
    assert_eq!(game.opponent, None);
    assert_eq!(game.wager, Uint128::new(5_000_000));
    assert_eq!(game.variant, "russian");
    assert!(matches!(game.status, GameStatus::Open));
}

#[test]
fn test_create_game_below_minimum() {
    let (mut deps, env) = setup_contract();
    let info = mock_info(PLAYER_A, &coins(100, DENOM)); // below min_wager
    let msg = ExecuteMsg::CreateGame {
        variant: "russian".to_string(),
        time_per_move: 60,
    };
    let err = execute(deps.as_mut(), env, info, msg).unwrap_err();
    assert!(err.to_string().contains("below minimum"));
}

#[test]
fn test_join_game() {
    let (mut deps, env) = setup_contract();
    let game_id = create_game(&mut deps, &env, PLAYER_A, 5_000_000);

    let info = mock_info(PLAYER_B, &coins(5_000_000, DENOM));
    let msg = ExecuteMsg::JoinGame { game_id };
    execute(deps.as_mut(), env.clone(), info, msg).unwrap();

    let game = query_game(&deps, game_id);
    assert_eq!(game.opponent, Some(Addr::unchecked(PLAYER_B)));
    assert!(matches!(game.status, GameStatus::Active));
    assert!(game.started_at.is_some());
}

#[test]
fn test_cannot_join_own_game() {
    let (mut deps, env) = setup_contract();
    let game_id = create_game(&mut deps, &env, PLAYER_A, 5_000_000);

    let info = mock_info(PLAYER_A, &coins(5_000_000, DENOM));
    let msg = ExecuteMsg::JoinGame { game_id };
    let err = execute(deps.as_mut(), env, info, msg).unwrap_err();
    assert!(err.to_string().contains("own game"));
}

#[test]
fn test_join_wrong_wager() {
    let (mut deps, env) = setup_contract();
    let game_id = create_game(&mut deps, &env, PLAYER_A, 5_000_000);

    let info = mock_info(PLAYER_B, &coins(3_000_000, DENOM)); // wrong amount
    let msg = ExecuteMsg::JoinGame { game_id };
    let err = execute(deps.as_mut(), env, info, msg).unwrap_err();
    assert!(err.to_string().contains("Incorrect wager"));
}

#[test]
fn test_resolve_game() {
    let (mut deps, env) = setup_contract();
    let game_id = create_game(&mut deps, &env, PLAYER_A, 5_000_000);

    // Join
    let info = mock_info(PLAYER_B, &coins(5_000_000, DENOM));
    execute(deps.as_mut(), env.clone(), info, ExecuteMsg::JoinGame { game_id }).unwrap();

    // Resolve — admin sets PLAYER_A as winner
    let info = mock_info(ADMIN, &[]);
    let res = execute(
        deps.as_mut(),
        env.clone(),
        info,
        ExecuteMsg::ResolveGame {
            game_id,
            winner: PLAYER_A.to_string(),
        },
    ).unwrap();

    // Check payout: 10M total, 10% commission = 1M, payout = 9M
    let payout_attr = res.attributes.iter().find(|a| a.key == "payout").unwrap();
    assert_eq!(payout_attr.value, "9000000");

    let commission_attr = res.attributes.iter().find(|a| a.key == "commission").unwrap();
    assert_eq!(commission_attr.value, "1000000");

    // 2 bank messages: payout to winner, commission to treasury
    assert_eq!(res.messages.len(), 2);

    let game = query_game(&deps, game_id);
    assert!(matches!(game.status, GameStatus::Resolved));
    assert_eq!(game.winner, Some(Addr::unchecked(PLAYER_A)));
}

#[test]
fn test_resolve_draw() {
    let (mut deps, env) = setup_contract();
    let game_id = create_game(&mut deps, &env, PLAYER_A, 5_000_000);

    let info = mock_info(PLAYER_B, &coins(5_000_000, DENOM));
    execute(deps.as_mut(), env.clone(), info, ExecuteMsg::JoinGame { game_id }).unwrap();

    let info = mock_info(ADMIN, &[]);
    let res = execute(deps.as_mut(), env.clone(), info, ExecuteMsg::ResolveDraw { game_id }).unwrap();

    // Both players get their wager back
    assert_eq!(res.messages.len(), 2);

    let game = query_game(&deps, game_id);
    assert!(matches!(game.status, GameStatus::Draw));
    assert_eq!(game.winner, None);
}

#[test]
fn test_resolve_only_admin() {
    let (mut deps, env) = setup_contract();
    let game_id = create_game(&mut deps, &env, PLAYER_A, 5_000_000);

    let info = mock_info(PLAYER_B, &coins(5_000_000, DENOM));
    execute(deps.as_mut(), env.clone(), info, ExecuteMsg::JoinGame { game_id }).unwrap();

    let info = mock_info(PLAYER_A, &[]); // not admin!
    let err = execute(
        deps.as_mut(),
        env,
        info,
        ExecuteMsg::ResolveGame {
            game_id,
            winner: PLAYER_A.to_string(),
        },
    ).unwrap_err();
    assert!(err.to_string().contains("Unauthorized"));
}

#[test]
fn test_cancel_game() {
    let (mut deps, env) = setup_contract();
    let game_id = create_game(&mut deps, &env, PLAYER_A, 5_000_000);

    let info = mock_info(PLAYER_A, &[]);
    let res = execute(deps.as_mut(), env.clone(), info, ExecuteMsg::CancelGame { game_id }).unwrap();

    // Refund message
    assert_eq!(res.messages.len(), 1);

    let game = query_game(&deps, game_id);
    assert!(matches!(game.status, GameStatus::Canceled));
}

#[test]
fn test_cannot_cancel_active_game() {
    let (mut deps, env) = setup_contract();
    let game_id = create_game(&mut deps, &env, PLAYER_A, 5_000_000);

    let info = mock_info(PLAYER_B, &coins(5_000_000, DENOM));
    execute(deps.as_mut(), env.clone(), info, ExecuteMsg::JoinGame { game_id }).unwrap();

    let info = mock_info(PLAYER_A, &[]);
    let err = execute(deps.as_mut(), env, info, ExecuteMsg::CancelGame { game_id }).unwrap_err();
    assert!(err.to_string().contains("Invalid game state"));
}

#[test]
fn test_claim_timeout() {
    let (mut deps, mut env) = setup_contract();
    let game_id = create_game(&mut deps, &env, PLAYER_A, 5_000_000);

    let info = mock_info(PLAYER_B, &coins(5_000_000, DENOM));
    execute(deps.as_mut(), env.clone(), info, ExecuteMsg::JoinGame { game_id }).unwrap();

    // Advance time past resolve_timeout_secs (3600s)
    env.block.time = env.block.time.plus_seconds(3601);

    let info = mock_info(PLAYER_B, &[]);
    let res = execute(deps.as_mut(), env.clone(), info, ExecuteMsg::ClaimTimeout { game_id }).unwrap();

    assert_eq!(res.messages.len(), 2); // payout + commission

    let game = query_game(&deps, game_id);
    assert!(matches!(game.status, GameStatus::TimeoutClaimed));
    assert_eq!(game.winner, Some(Addr::unchecked(PLAYER_B)));
}

#[test]
fn test_claim_timeout_too_early() {
    let (mut deps, env) = setup_contract();
    let game_id = create_game(&mut deps, &env, PLAYER_A, 5_000_000);

    let info = mock_info(PLAYER_B, &coins(5_000_000, DENOM));
    execute(deps.as_mut(), env.clone(), info, ExecuteMsg::JoinGame { game_id }).unwrap();

    // Don't advance time — timeout not reached
    let info = mock_info(PLAYER_B, &[]);
    let err = execute(deps.as_mut(), env, info, ExecuteMsg::ClaimTimeout { game_id }).unwrap_err();
    assert!(err.to_string().contains("not yet reached"));
}

#[test]
fn test_query_open_games() {
    let (mut deps, env) = setup_contract();
    create_game(&mut deps, &env, PLAYER_A, 5_000_000);
    create_game(&mut deps, &env, PLAYER_A, 10_000_000);

    let res = query(
        deps.as_ref(),
        env,
        QueryMsg::OpenGames {
            start_after: None,
            limit: None,
        },
    ).unwrap();
    let games: GamesResponse = cosmwasm_std::from_json(res).unwrap();
    assert_eq!(games.games.len(), 2);
}

#[test]
fn test_full_lifecycle() {
    let (mut deps, env) = setup_contract();

    // Create
    let game_id = create_game(&mut deps, &env, PLAYER_A, 5_000_000);

    // Join
    let info = mock_info(PLAYER_B, &coins(5_000_000, DENOM));
    execute(deps.as_mut(), env.clone(), info, ExecuteMsg::JoinGame { game_id }).unwrap();

    // Resolve
    let info = mock_info(ADMIN, &[]);
    let res = execute(
        deps.as_mut(),
        env.clone(),
        info,
        ExecuteMsg::ResolveGame {
            game_id,
            winner: PLAYER_B.to_string(),
        },
    ).unwrap();

    assert_eq!(res.messages.len(), 2);

    let game = query_game(&deps, game_id);
    assert_eq!(game.winner, Some(Addr::unchecked(PLAYER_B)));
    assert!(matches!(game.status, GameStatus::Resolved));
}
