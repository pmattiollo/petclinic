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

export interface PetDto {
  id: number;
  name: string;
  birthDate: string;
  ownerId?: number;
  visits?: VisitDto[];
}

export interface ApiResult {
  status: number;
  location?: string;
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

  async fetchOwners(): Promise<OwnerDto[]> {
    const response = await this.client.get<OwnerDto[]>('/owners');
    return response.data;
  }

  async fetchOwnersByPrefix(prefix: string): Promise<OwnerDto[]> {
    const response = await this.client.get<OwnerDto[]>('/owners', {
      params: { lastName: prefix }
    });
    return response.data;
  }

  async fetchVisits(): Promise<VisitDto[]> {
    const response = await this.client.get<VisitDto[]>('/visits');
    return response.data;
  }

  async fetchPet(petId: number): Promise<PetDto> {
    const response = await this.client.get<PetDto>(`/pets/${petId}`);
    return response.data;
  }

  /** Creates an owner and returns its id, read from the 201 Location header. */
  async createOwner(owner: OwnerDto): Promise<number> {
    const response = await this.client.post('/owners', owner);
    return ApiClient.idFromLocation(response.headers['location']);
  }

  async deleteOwner(ownerId: number): Promise<void> {
    await this.client.delete(`/owners/${ownerId}`);
  }

  /** Adds a pet to an owner and returns the new pet's id. */
  async addPet(ownerId: number, pet: { name: string; birthDate: string; typeId: number }): Promise<number> {
    await this.client.post(`/owners/${ownerId}/pets`, {
      name: pet.name,
      birthDate: pet.birthDate,
      type: {id: pet.typeId, name: 'ignored-by-server'},
    });
    const owner = await this.client.get<{ pets: PetDto[] }>(`/owners/${ownerId}`);
    const created = owner.data.pets.find(p => p.name === pet.name);
    if (!created) {
      throw new Error(`Pet ${pet.name} was not attached to owner ${ownerId}`);
    }
    return created.id;
  }

  async firstPetTypeId(): Promise<number> {
    const response = await this.client.get<{ id: number }[]>('/pettypes');
    return response.data[0].id;
  }

  async deleteVisit(visitId: number): Promise<void> {
    await this.client.delete(`/visits/${visitId}`);
  }

  /**
   * POST /visits without throwing on 4xx — the date-range tests assert on the
   * status code itself, so a rejection must come back as data, not an exception.
   */
  async postVisit(visit: { petId: number; date: string; description: string }): Promise<ApiResult> {
    const response = await this.client.post('/visits', visit, {validateStatus: () => true});
    return {status: response.status, location: response.headers['location']};
  }

  async postVisitForOwnersPet(ownerId: number, petId: number,
                              visit: { date: string; description: string }): Promise<ApiResult> {
    const response = await this.client.post(`/owners/${ownerId}/pets/${petId}/visits`, visit,
      {validateStatus: () => true});
    return {status: response.status, location: response.headers['location']};
  }

  async putVisit(visitId: number, visit: { date: string; description: string }): Promise<ApiResult> {
    const response = await this.client.put(`/visits/${visitId}`, visit, {validateStatus: () => true});
    return {status: response.status};
  }

  private static idFromLocation(location: string | undefined): number {
    const id = Number((location ?? '').split('/').pop());
    if (!Number.isInteger(id)) {
      throw new Error(`Cannot extract an id from Location header: ${location}`);
    }
    return id;
  }

  static getFullNames(owners: OwnerDto[]): string[] {
    return owners
      .map(owner => `${owner.firstName} ${owner.lastName}`.trim())
      .filter(name => name.length > 0);
  }

  static sorted(values: string[]): string[] {
    return [...values].sort();
  }

  static sortedByDate<T extends { date: string }>(rows: T[]): T[] {
    return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  }

  static extractLastName(fullName: string): string {
    const firstSpace = fullName.indexOf(' ');
    if (firstSpace < 0 || firstSpace === fullName.length - 1) {
      return fullName;
    }
    return fullName.substring(firstSpace + 1);
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
