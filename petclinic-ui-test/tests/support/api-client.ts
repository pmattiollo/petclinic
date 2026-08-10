import axios, { AxiosInstance } from 'axios';

export interface OwnerDto {
  firstName: string;
  lastName: string;
  id?: number;
  address?: string;
  city?: string;
  telephone?: string;
}

export interface OwnerPageDto {
  content: OwnerDto[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
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

  /** Mirrors the grid's own default request (page 0, size 10, sorted by name ascending). */
  async fetchOwnersPage(params: {lastName?: string; page?: number; size?: number; sort?: string} = {}):
      Promise<OwnerPageDto> {
    const response = await this.client.get<OwnerPageDto>('/owners', {
      params: {
        lastName: params.lastName ?? '',
        page: params.page ?? 0,
        size: params.size ?? 10,
        sort: params.sort ?? 'name,asc',
      }
    });
    return response.data;
  }

  async fetchOwners(): Promise<OwnerDto[]> {
    const page = await this.fetchOwnersPage();
    return page.content;
  }

  async fetchOwnersByPrefix(prefix: string): Promise<OwnerDto[]> {
    const page = await this.fetchOwnersPage({lastName: prefix});
    return page.content;
  }

  async fetchVisits(): Promise<VisitDto[]> {
    const response = await this.client.get<VisitDto[]>('/visits');
    return response.data;
  }

  /** "Last, First" — the surname-first order shown in the grid (D5). */
  static getFullNames(owners: OwnerDto[]): string[] {
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

  static extractLastName(fullName: string): string {
    const firstComma = fullName.indexOf(',');
    return firstComma < 0 ? fullName : fullName.substring(0, firstComma);
  }

  static choosePrefixFrom(owners: OwnerDto[]): string {
    for (const owner of owners) {
      if (owner.lastName && owner.lastName.trim()) {
        const lastName = owner.lastName.trim();
        return lastName.substring(0, Math.min(2, lastName.length));
      }
    }
    throw new Error('No owners available to derive search prefix');
  }
}

