import { isNotNull, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { bigint, check, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { timestamps } from './_helpers';
import { users } from './user';
import { workspaces } from './workspace';

export const taskNumberNamespaces = pgTable(
  'task_number_namespaces',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    userId: text('user_id').references((): AnyPgColumn => users.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id').references((): AnyPgColumn => workspaces.id, {
      onDelete: 'cascade',
    }),
    prefix: text('prefix').notNull(),
    counter: bigint('counter', { mode: 'number' }).notNull().default(0),
    ...timestamps,
  },
  (t) => [
    check(
      'task_number_namespaces_owner_check',
      sql`(${t.userId} IS NULL) <> (${t.workspaceId} IS NULL)`,
    ),
    uniqueIndex('task_number_namespaces_user_prefix_unique')
      .on(t.userId, t.prefix)
      .where(isNotNull(t.userId)),
    uniqueIndex('task_number_namespaces_workspace_prefix_unique')
      .on(t.workspaceId, t.prefix)
      .where(isNotNull(t.workspaceId)),
  ],
);

export type TaskNumberNamespaceItem = typeof taskNumberNamespaces.$inferSelect;
export type NewTaskNumberNamespace = typeof taskNumberNamespaces.$inferInsert;
