import { components, operations } from '../generated/api-types';
import { Owner } from './owner';

/** One page of owners, as returned by GET /api/owners. Shape generated from openapi.yaml. */
export type OwnerPage = Omit<components['schemas']['OwnerPageDto'], 'content'> & {
  content: Owner[];
};

type ListOwnersQuery = NonNullable<operations['listOwners']['parameters']['query']>;

export type OwnerSortField = NonNullable<ListOwnersQuery['sort']>;

export type SortDirection = 'ASC' | 'DESC';

/** The page sizes the server accepts; anything else is rejected with 400. */
export const PAGE_SIZES = [5, 10, 20];

export const DEFAULT_PAGE_SIZE = 10;

/** Everything that defines which owners the grid shows, and in what order. */
export interface OwnerQuery {
  page: number;
  size: number;
  sort: OwnerSortField;
  direction: SortDirection;
  lastName: string;
}

export const DEFAULT_OWNER_QUERY: OwnerQuery = {
  page: 0,
  size: DEFAULT_PAGE_SIZE,
  sort: 'NAME',
  direction: 'ASC',
  lastName: '',
};
