import type { AddFavoriteParams, FavoriteItem, FavoriteType } from '@lobechat/types';

import { createReplicaSlice, recordLens, type ReplicaSyncResult } from '@/libs/replica';
import { favoriteService } from '@/services/favorite';
import type { HomeStore } from '@/store/home/store';
import type { StoreSetter } from '@/store/types';
import { setNamespace } from '@/utils/storeDebug';

import { FAVORITE_LIST_KEY, favoriteListResource } from './projection';
import { favoriteSelectors } from './selectors';

const n = setNamespace('favorite');

const LIST_PARAMS = {} as Record<string, never>;

type FavoriteSnapshot = Partial<Pick<FavoriteItem, 'icon' | 'path' | 'title'>>;

/** Rows added on the client before the server confirmed them. */
export const isOptimisticId = (id: string) => id.startsWith('optimistic:');

/**
 * The row an id from the list points at. A client id names its target, so it
 * still finds the row after the server confirmed it under a real id.
 */
const findRow = (items: FavoriteItem[], id: string): FavoriteItem | undefined => {
  const byId = items.find((item) => item.id === id);
  if (byId || !isOptimisticId(id)) return byId;
  const [, type, ...rest] = id.split(':');
  const targetId = rest.join(':');
  return items.find((item) => item.type === type && item.targetId === targetId);
};

const isTarget = (item: FavoriteItem, type: FavoriteType, targetId: string) =>
  item.type === type && item.targetId === targetId;

/** Insert or refresh `item` in place, the way the server upserts by target. */
const upsert = (items: FavoriteItem[], item: FavoriteItem): FavoriteItem[] => {
  const index = items.findIndex((row) => isTarget(row, item.type, item.targetId));
  if (index === -1) return [...items, item];
  const next = [...items];
  next[index] = { ...item, id: items[index].id };
  return next;
};

type Setter = StoreSetter<HomeStore>;
export const createFavoriteSlice = (set: Setter, get: () => HomeStore, _api?: unknown) =>
  new FavoriteActionImpl(set, get, _api);

export class FavoriteActionImpl {
  readonly #get: () => HomeStore;
  readonly #list;
  /** Writes per target reach the server in order, so a quick re-toggle cannot land reversed. */
  readonly #targetQueues = new Map<string, Promise<unknown>>();
  /** Reorders reach the server in drag order, so the last drag wins. */
  #reorderQueue: Promise<unknown> = Promise.resolve();
  /** Adds still waiting for the server; a reorder waits for them to learn their ids. */
  readonly #pendingAdds = new Set<Promise<unknown>>();

  constructor(set: Setter, get: () => HomeStore, _api?: unknown) {
    void _api;
    this.#get = get;
    this.#list = createReplicaSlice(favoriteListResource, {
      actionPrefix: n('favoriteList'),
      fetcher: () => favoriteService.list(),
      get,
      set,
      stateKey: 'favoriteListReplica',
      view: recordLens<HomeStore, FavoriteItem[]>('favoriteListMap'),
    });
  }

  #enqueue = async <T>(type: FavoriteType, targetId: string, run: () => Promise<T>) => {
    const key = `${type}:${targetId}`;
    const previous = this.#targetQueues.get(key) ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(run);
    this.#targetQueues.set(key, operation);
    try {
      return await operation;
    } finally {
      if (this.#targetQueues.get(key) === operation) this.#targetQueues.delete(key);
    }
  };

  addFavorite = async (params: AddFavoriteParams): Promise<void> => {
    const optimisticItem: FavoriteItem = {
      icon: params.icon ?? null,
      id: `optimistic:${params.type}:${params.targetId}`,
      path: params.path,
      targetId: params.targetId,
      title: params.title,
      type: params.type,
    };

    const operation = this.#list.optimistic(
      FAVORITE_LIST_KEY,
      (items = []) => upsert(items, optimisticItem),
      () => this.#enqueue(params.type, params.targetId, () => favoriteService.add(params)),
      {
        confirm:
          (saved) =>
          (items = []) => {
            const index = items.findIndex((row) => isTarget(row, saved.type, saved.targetId));
            if (index === -1) return [...items, saved];
            const next = [...items];
            next[index] = saved;
            return next;
          },
      },
    );
    // Settles once the confirmed row (with its real id) is in the list.
    this.#pendingAdds.add(operation);
    try {
      await operation;
    } finally {
      this.#pendingAdds.delete(operation);
    }
  };

  refreshFavorites = async (): Promise<void> => {
    await this.#list.revalidate();
  };

  removeFavorite = async (type: FavoriteType, targetId: string): Promise<void> => {
    await this.#list.optimistic(
      FAVORITE_LIST_KEY,
      (items = []) => items.filter((item) => !isTarget(item, type, targetId)),
      () => this.#enqueue(type, targetId, () => favoriteService.removeByTarget(type, targetId)),
    );
  };

  reorderFavorites = async (ids: string[]): Promise<void> => {
    await this.#list.optimistic(
      FAVORITE_LIST_KEY,
      (items = []) => {
        const listed = ids.flatMap((id) => findRow(items, id) ?? []);
        const rest = items.filter((item) => !listed.includes(item));
        return [...listed, ...rest];
      },
      () => {
        const operation = this.#reorderQueue
          .catch(() => undefined)
          .then(async () => {
            // A row being added has no server id yet: wait for its add, then
            // send the whole order with real ids so the server keeps its slot.
            await Promise.allSettled(this.#pendingAdds);
            const items = favoriteSelectors.favorites(this.#get());
            const persistedIds = ids
              .map((id) => findRow(items, id)?.id)
              .filter((id): id is string => !!id && !isOptimisticId(id));
            await favoriteService.reorder(persistedIds);
          });
        this.#reorderQueue = operation;
        return operation;
      },
    );
  };

  toggleFavorite = async (params: AddFavoriteParams): Promise<void> => {
    const isFavorite = favoriteSelectors.isFavorite(params.type, params.targetId)(this.#get());
    if (isFavorite) await this.removeFavorite(params.type, params.targetId);
    else await this.addFavorite(params);
  };

  /**
   * Keep the snapshot of a favorite in step with the page it points at (a
   * renamed topic, a new page emoji). A no-op when nothing changed.
   */
  syncFavoriteSnapshot = async (
    type: FavoriteType,
    targetId: string,
    snapshot: FavoriteSnapshot,
  ): Promise<void> => {
    const item = favoriteSelectors.getFavorite(type, targetId)(this.#get());
    if (!item || isOptimisticId(item.id)) return;

    const changes = Object.fromEntries(
      Object.entries(snapshot).filter(
        ([key, value]) => value !== undefined && item[key as keyof FavoriteSnapshot] !== value,
      ),
    ) as FavoriteSnapshot;
    if (Object.keys(changes).length === 0) return;

    await this.#list.optimistic(
      FAVORITE_LIST_KEY,
      (items = []) => items.map((row) => (row.id === item.id ? { ...row, ...changes } : row)),
      () => this.#enqueue(type, targetId, () => favoriteService.update(item.id, changes)),
    );
  };

  useFetchFavorites = (enabled: boolean): ReplicaSyncResult =>
    this.#list.useSync(LIST_PARAMS, { enabled });
}

export type FavoriteAction = Pick<FavoriteActionImpl, keyof FavoriteActionImpl>;
