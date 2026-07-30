import axios, { AxiosInstance } from 'axios';

export interface OwnerDto {
  firstName: string;
  lastName: string;
  id?: number;
  address?: string;
  city?: string;
  telephone?: string;
}

export interface VisitDto {
  id: number;
  date: string;
  description: string;
  petId: number;
  petName?: string;
  ownerId?: number;
  ownerFirstName?: string;
  ownerLastName?: string;
}

// GET /api/owners now returns a page envelope, not a bare array.
export interface OwnerPageDto {
  content: OwnerDto[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

// The largest page size the backend accepts; used when a test needs every
// matching owner in one request rather than a single page of results.
const MAX_PAGE_SIZE = 20;

export class ApiClient {
  private client: AxiosInstance;

  // Use 127.0.0.1 (not "localhost"): under Node 18+ "localhost" can resolve to IPv6 ::1
  // first and fail with a cryptic AggregateError when the backend listens on IPv4.
  constructor(baseUrl: string = process.env.API_BASE_URL || 'http://127.0.0.1:8080/api') {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
    });
  }

  /** Fetches a single page of owners, sorted by name ascending by default (the UI's default). */
  async fetchOwnersPage(params: {lastName?: string; page?: number; size?: number; sort?: string} = {}): Promise<OwnerPageDto> {
    const response = await this.client.get<OwnerPageDto>('/owners', {params});
    return response.data;
  }

  /** Fetches just the first page of owners (10 rows, name ascending) - what the UI shows on initial load. */
  async fetchOwners(): Promise<OwnerDto[]> {
    const page = await this.fetchOwnersPage();
    return page.content;
  }

  /** Walks every page (by name ascending) and returns the full, unpaginated set of matching owners. */
  async fetchAllOwners(lastName?: string): Promise<OwnerDto[]> {
    const all: OwnerDto[] = [];
    let pageNumber = 0;
    let totalPages = 1;
    do {
      const page = await this.fetchOwnersPage({lastName, page: pageNumber, size: MAX_PAGE_SIZE, sort: 'name,asc'});
      all.push(...page.content);
      totalPages = page.totalPages;
      pageNumber++;
    } while (pageNumber < totalPages);
    return all;
  }

  async fetchOwnersByPrefix(prefix: string): Promise<OwnerDto[]> {
    return this.fetchAllOwners(prefix);
  }

  async fetchVisits(): Promise<VisitDto[]> {
    const response = await this.client.get<VisitDto[]>('/visits');
    return response.data;
  }

  static getFullNames(owners: OwnerDto[]): string[] {
    return owners
      .map(owner => `${owner.firstName} ${owner.lastName}`.trim())
      .filter(name => name.length > 0);
  }

  /** The owners grid renders the Name column as "Last, First" (see owner-list.component.html). */
  static getDisplayNames(owners: OwnerDto[]): string[] {
    return owners
      .map(owner => `${owner.lastName}, ${owner.firstName}`.trim())
      .filter(name => name.length > 0);
  }

  static sorted(values: string[]): string[] {
    return [...values].sort();
  }

  static sortedByDate<T extends { date: string }>(rows: T[]): T[] {
    return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Extracts the last name from the grid's "Last, First" display format (owner-list.component.html). */
  static extractLastName(displayName: string): string {
    const comma = displayName.indexOf(',');
    if (comma < 0) {
      return displayName;
    }
    return displayName.substring(0, comma).trim();
  }

  static choosePrefixFrom(owners: OwnerDto[]): string {
    for (const owner of owners) {
      if (owner.lastName && owner.lastName.trim()) {
        // Use the whole last name (not just a short prefix) so the match stays within a
        // single page even against seed data with several similarly-named owners - a short
        // 2-letter prefix can match more owners than the default page size shows.
        return owner.lastName.trim();
      }
    }
    throw new Error('No owners available to derive search prefix');
  }
}
