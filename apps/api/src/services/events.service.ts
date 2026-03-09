import { eq, and, gt, desc, sql } from 'drizzle-orm'
import { events, eventParticipants, announcements } from '@checkers/db'
import type { Db } from '@checkers/db'

export class EventsService {
  constructor(private db: Db) {}

  /** Get active/upcoming events */
  async getEvents() {
    const now = new Date()
    return this.db
      .select()
      .from(events)
      .where(sql`${events.status} IN ('upcoming', 'active', 'calculating')`)
      .orderBy(desc(events.startsAt))
      .limit(20)
  }

  /** Get single event with participants */
  async getEvent(eventId: string) {
    const [event] = await this.db.select().from(events).where(eq(events.id, eventId)).limit(1)
    if (!event) return null

    const participants = await this.db
      .select()
      .from(eventParticipants)
      .where(eq(eventParticipants.eventId, eventId))
      .orderBy(desc(eventParticipants.score))
      .limit(100)

    return { event, participants }
  }

  /** Join an event */
  async join(eventId: string, address: string): Promise<boolean> {
    const [event] = await this.db.select().from(events).where(eq(events.id, eventId)).limit(1)
    if (!event || (event.status !== 'upcoming' && event.status !== 'active')) return false

    // Check already joined
    const [existing] = await this.db
      .select()
      .from(eventParticipants)
      .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.address, address)))
      .limit(1)
    if (existing) return false

    // Check max participants
    if (event.maxParticipants) {
      const count = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(eventParticipants)
        .where(eq(eventParticipants.eventId, eventId))
      if (count[0].count >= event.maxParticipants) return false
    }

    await this.db.insert(eventParticipants).values({ eventId, address })
    return true
  }

  /** Get active announcements */
  async getAnnouncements() {
    const now = new Date()
    return this.db
      .select()
      .from(announcements)
      .where(eq(announcements.active, true))
      .orderBy(desc(announcements.createdAt))
      .limit(10)
  }
}
