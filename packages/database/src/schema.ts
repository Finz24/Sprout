// Feature issues introduce owner-scoped domain tables through reviewed migrations.
import { sql } from 'drizzle-orm';
import { boolean, check, index, pgSchema, text, timestamp, unique } from 'drizzle-orm/pg-core';

const auth = pgSchema('auth');
const privateData = pgSchema('private');
const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
export const user = auth.table('user', {
  id: text('id').primaryKey(), name: text('name').notNull(),
  email: text('email').notNull().unique(), emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'), ...timestamps(),
}, (t) => [check('normalized_email', sql`${t.email} = lower(btrim(${t.email}))`)]);
export const account = auth.table('account', {
  id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(), providerId: text('provider_id').notNull(), password: text('password'),
  accessToken: text('access_token'), refreshToken: text('refresh_token'), idToken: text('id_token'), scope: text('scope'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }), ...timestamps(),
}, (t) => [index('account_user_idx').on(t.userId), unique('account_provider_identity').on(t.providerId, t.accountId)]);
export const session = auth.table('session', {
  id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'), userAgent: text('user_agent'), ...timestamps(),
}, (t) => [index('session_user_idx').on(t.userId)]);
export const verification = auth.table('verification', {
  id: text('id').primaryKey(), identifier: text('identifier').notNull(), value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), ...timestamps(),
}, (t) => [index('verification_identifier_idx').on(t.identifier)]);
export const ownerSettings = privateData.table('owner_settings', {
  ownerUserId: text('owner_user_id').primaryKey().references(() => user.id, { onDelete: 'restrict' }),
  libraryView: text('library_view', { enum: ['grid', 'list'] }).notNull().default('grid'), ...timestamps(),
}, (t) => [check('library_view', sql`${t.libraryView} in ('grid', 'list')`)]);
