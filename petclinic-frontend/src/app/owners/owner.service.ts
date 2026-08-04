import { Injectable } from '@angular/core';
import { Owner, OwnerPage } from './owner';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { HandleError, HttpErrorHandler } from '../error.service';

export const EMPTY_OWNER_PAGE: OwnerPage = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  number: 0,
  size: 0
};

export interface OwnerListingParams {
  lastName?: string;
  page?: number;
  size?: number;
  sort?: string;
}

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

  getOwners(params: OwnerListingParams = {}): Observable<OwnerPage> {
    return this.http
      .get<OwnerPage>(this.entityUrl, { params: this.toHttpParams(params) })
      .pipe(catchError(this.handlerError('getOwners', EMPTY_OWNER_PAGE)));
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

  searchOwners(lastName: string, params: OwnerListingParams = {}): Observable<OwnerPage> {
    return this.getOwners({ ...params, lastName });
  }

  private toHttpParams(params: OwnerListingParams): HttpParams {
    let httpParams = new HttpParams();
    if (params.lastName !== undefined) {
      httpParams = httpParams.set('lastName', params.lastName);
    }
    if (params.page !== undefined) {
      httpParams = httpParams.set('page', params.page);
    }
    if (params.size !== undefined) {
      httpParams = httpParams.set('size', params.size);
    }
    if (params.sort !== undefined) {
      httpParams = httpParams.set('sort', params.sort);
    }
    return httpParams;
  }
}
