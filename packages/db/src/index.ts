import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as usersSchema from './schema/users'
import * as gamesSchema from './schema/games'
import * as sessionsSchema from './schema/sessions'

export const schema = {
  ...usersSchema,
  ...gamesSchema,
  ...sessionsSchema,
}

export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl)
  return drizzle(sql, { schema })
}

export type Db = ReturnType<typeof createDb>

export { users } from './schema/users'
export { games, gameMoves } from './schema/games'
export { sessions } from './schema/sessions'
