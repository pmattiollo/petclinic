import { Injectable } from '@angular/core';
import { Owner } from './owner';
import { OwnerPage } from './owner-page';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { HandleError, HttpErrorHandler } from '../error.service';

export type OwnerSortColumn = 'name' | 'city';
export type OwnerSortDirection = 'asc' | 'desc';
export type OwnerPageSize = 5 | 10 | 20;

export interface OwnerQuery {
  lastName: string;
  page: number;
  size: OwnerPageSize;
  sortColumn: OwnerSortColumn;
  sortDirection: OwnerSortDirection;
}

const EMPTY_OWNER_PAGE: OwnerPage = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 10 };

@Injectable()
export class OwnerService {
  entityUrl = environment.REST_API_URL + 'owners';

  private readonly handlerError: HandleError;

  constructor(
    private http: HttpClient,
    private httpErrorHandler: HttpErrorHandler
  ) {
    this.handlerError = httpErrorHandler.createHandleError('OwnerService');
  }

  getOwnersPage(query: OwnerQuery): Observable<OwnerPage> {
    const params = new HttpParams()
      .set('lastName', query.lastName)
      .set('page', String(query.page))
      .set('size', String(query.size))
      .set('sort', `${query.sortColumn},${query.sortDirection}`);

    return this.http
      .get<OwnerPage>(this.entityUrl, { params })
      .pipe(catchError(this.handlerError('getOwnersPage', EMPTY_OWNER_PAGE)));
  }

  getOwnerById(ownerId: number): Observable<Owner> {
    return this.http
      .get<Owner>(this.entityUrl + '/' + ownerId)
      .pipe(catchError(this.handlerError('getOwnerById', {} as Owner)));
  }

  addOwner(owner: Owner): Observable<Owner> {
    return this.http
      .post<Owner>(this.entityUrl, owner)
      .pipe(catchError(this.handlerError('addOwner', owner)));
  }


  updateOwner(ownerId: string, owner: Owner): Observable<{}> {
    return this.http
      .put<Owner>(this.entityUrl + '/' + ownerId, owner)
      .pipe(catchError(this.handlerError('updateOwner', owner)));
  }

  deleteOwner(ownerId: string): Observable<{}> {
    return this.http
      .delete<Owner>(this.entityUrl + '/' + ownerId)
      .pipe(catchError(this.handlerError('deleteOwner', [ownerId])));
  }
}
