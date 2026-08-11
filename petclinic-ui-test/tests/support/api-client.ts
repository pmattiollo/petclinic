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

  /** The listing is paged; ask for the largest page the server allows. */
  async fetchOwners(): Promise<OwnerDto[]> {
    const response = await this.client.get<OwnerPageDto>('/owners', {
      params: { size: 20 }
    });
    return response.data.content;
  }

  async fetchOwnersByPrefix(prefix: string): Promise<OwnerDto[]> {
    const response = await this.client.get<OwnerPageDto>('/owners', {
      params: { lastName: prefix, size: 20 }
    });
    return response.data.content;
  }

  /** Total owners matching a prefix, across every page — not just the ones on the first page. */
  async countOwnersByPrefix(prefix: string): Promise<number> {
    const response = await this.client.get<OwnerPageDto>('/owners', {
      params: { lastName: prefix, size: 5 }
    });
    return response.data.totalElements;
  }

  async fetchVisits(): Promise<VisitDto[]> {
    const response = await this.client.get<VisitDto[]>('/visits');
    return response.data;
  }

  /**
   * The grid renders the surname first ("Potter, Harry") so that its alphabetical ordering is visible in the
   * column being read. Expected values must be built the same way to be comparable with what is on screen.
   */
  static getFullNames(owners: OwnerDto[]): string[] {
    return owners
      .map(owner => `${owner.lastName}, ${owner.firstName}`.trim())
      .filter(name => name.length > 2);
  }

  static sorted(values: string[]): string[] {
    return [...values].sort();
  }

  static sortedByDate<T extends { date: string }>(rows: T[]): T[] {
    return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Names render as "Lastname, Firstname", so the surname is what precedes the comma. */
  static extractLastName(fullName: string): string {
    const comma = fullName.indexOf(',');
    if (comma < 0) {
      return fullName;
    }
    return fullName.substring(0, comma).trim();
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
