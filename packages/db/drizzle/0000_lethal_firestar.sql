CREATE TYPE "public"."jackpot_tier" AS ENUM('mini', 'medium', 'large', 'mega', 'super_mega');--> statement-breakpoint
CREATE TYPE "public"."vip_tier" AS ENUM('silver', 'gold', 'diamond');--> statement-breakpoint
CREATE TABLE "relayer_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tx_hash" text,
	"msg_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"gas_used" text,
	"error_log" text,
	"attempts" integer DEFAULT 1 NOT NULL,
	"duration_ms" integer,
	"game_id" uuid,
	"user_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tx_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" text,
	"action" text NOT NULL,
	"details" text,
	"game_id" uuid,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"sender_address" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_address" text NOT NULL,
	"message" text NOT NULL,
	"style" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"type" text DEFAULT 'info' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"address" text NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"rank" integer,
	"prize_won" text,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"metric" text,
	"prize_pool" text DEFAULT '0' NOT NULL,
	"prize_type" text DEFAULT 'checker' NOT NULL,
	"max_participants" integer,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"move_number" integer NOT NULL,
	"player" text NOT NULL,
	"from_row" integer NOT NULL,
	"from_col" integer NOT NULL,
	"to_row" integer NOT NULL,
	"to_col" integer NOT NULL,
	"captures" jsonb DEFAULT '[]'::jsonb,
	"promotion" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"black_player" text,
	"white_player" text,
	"winner" text,
	"status" text DEFAULT 'waiting' NOT NULL,
	"black_ready" boolean DEFAULT false NOT NULL,
	"white_ready" boolean DEFAULT false NOT NULL,
	"variant" text DEFAULT 'russian' NOT NULL,
	"wager" text NOT NULL,
	"time_per_move" integer DEFAULT 60 NOT NULL,
	"game_state" jsonb NOT NULL,
	"move_count" integer DEFAULT 0 NOT NULL,
	"current_turn_deadline" timestamp with time zone,
	"on_chain_game_id" integer,
	"tx_hash_create" text,
	"tx_hash_join" text,
	"tx_hash_resolve" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "jackpot_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"player_address" text NOT NULL,
	"amount" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jackpot_pools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tier" "jackpot_tier" NOT NULL,
	"cycle" integer DEFAULT 1 NOT NULL,
	"current_amount" text DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"winner_address" text,
	"win_amount" text,
	"drawn_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jackpot_tiers" (
	"tier" "jackpot_tier" PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"target_amount" text DEFAULT '0' NOT NULL,
	"contribution_bps" integer DEFAULT 100 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_balances" (
	"address" text PRIMARY KEY NOT NULL,
	"total_earned" text DEFAULT '0' NOT NULL,
	"total_claimed" text DEFAULT '0' NOT NULL,
	"referral_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_codes_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE "referral_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_address" text NOT NULL,
	"from_player_address" text NOT NULL,
	"level" integer NOT NULL,
	"amount" text NOT NULL,
	"game_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_address" text NOT NULL,
	"referred_address" text NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referrals_referred_address_unique" UNIQUE("referred_address")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "shop_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" text NOT NULL,
	"item_type" text NOT NULL,
	"amount_paid" text DEFAULT '0' NOT NULL,
	"checker_reward" text DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staking_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid,
	"amount" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"tx_hash" text,
	"flushed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasury_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"amount" text NOT NULL,
	"game_id" uuid,
	"tx_hash" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"address" text PRIMARY KEY NOT NULL,
	"username" text,
	"avatar_url" text,
	"games_played" integer DEFAULT 0 NOT NULL,
	"games_won" integer DEFAULT 0 NOT NULL,
	"games_lost" integer DEFAULT 0 NOT NULL,
	"games_draw" integer DEFAULT 0 NOT NULL,
	"total_wagered" text DEFAULT '0' NOT NULL,
	"total_won" text DEFAULT '0' NOT NULL,
	"elo" integer DEFAULT 1200 NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"last_seen" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_balances" (
	"address" text PRIMARY KEY NOT NULL,
	"available" text DEFAULT '0' NOT NULL,
	"locked" text DEFAULT '0' NOT NULL,
	"bonus" text DEFAULT '0' NOT NULL,
	"checker_balance" text DEFAULT '0' NOT NULL,
	"offchain_spent" text DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" text NOT NULL,
	"type" text NOT NULL,
	"amount" text NOT NULL,
	"balance_before" text NOT NULL,
	"balance_after" text NOT NULL,
	"reason" text,
	"game_id" uuid,
	"tx_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vip_config" (
	"tier" "vip_tier" PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"price_monthly" text DEFAULT '0' NOT NULL,
	"price_yearly" text DEFAULT '0' NOT NULL,
	"checker_monthly" text DEFAULT '0' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vip_customization" (
	"address" text PRIMARY KEY NOT NULL,
	"name_gradient" text,
	"frame_style" text,
	"badge_icon" text,
	"board_theme" text,
	"piece_style" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vip_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" text NOT NULL,
	"tier" "vip_tier" NOT NULL,
	"starts_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"amount_paid" text DEFAULT '0' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tx_events" ADD CONSTRAINT "tx_events_address_users_address_fk" FOREIGN KEY ("address") REFERENCES "public"."users"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_moves" ADD CONSTRAINT "game_moves_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_moves" ADD CONSTRAINT "game_moves_player_users_address_fk" FOREIGN KEY ("player") REFERENCES "public"."users"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_black_player_users_address_fk" FOREIGN KEY ("black_player") REFERENCES "public"."users"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_white_player_users_address_fk" FOREIGN KEY ("white_player") REFERENCES "public"."users"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_winner_users_address_fk" FOREIGN KEY ("winner") REFERENCES "public"."users"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_balances" ADD CONSTRAINT "referral_balances_address_users_address_fk" FOREIGN KEY ("address") REFERENCES "public"."users"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_address_users_address_fk" FOREIGN KEY ("address") REFERENCES "public"."users"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referrer_address_users_address_fk" FOREIGN KEY ("referrer_address") REFERENCES "public"."users"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_from_player_address_users_address_fk" FOREIGN KEY ("from_player_address") REFERENCES "public"."users"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_address_users_address_fk" FOREIGN KEY ("referrer_address") REFERENCES "public"."users"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_address_users_address_fk" FOREIGN KEY ("referred_address") REFERENCES "public"."users"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_address_users_address_fk" FOREIGN KEY ("address") REFERENCES "public"."users"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_balances" ADD CONSTRAINT "vault_balances_address_users_address_fk" FOREIGN KEY ("address") REFERENCES "public"."users"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_transactions" ADD CONSTRAINT "vault_transactions_address_users_address_fk" FOREIGN KEY ("address") REFERENCES "public"."users"("address") ON DELETE no action ON UPDATE no action;