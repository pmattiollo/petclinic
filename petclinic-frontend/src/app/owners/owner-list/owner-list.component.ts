import {Component, OnDestroy, OnInit} from '@angular/core';
import {OwnerPageSize, OwnerQuery, OwnerService, OwnerSort} from '../owner.service';
import {Owner} from '../owner';
import {ActivatedRoute, Router} from '@angular/router';
import {Sort} from '@angular/material/sort';
import {PageEvent} from '@angular/material/paginator';
import {Subscription} from 'rxjs';
import {finalize} from 'rxjs/operators';

const DEFAULT_PAGE_SIZE: OwnerPageSize = 10;
const PAGE_SIZE_OPTIONS: OwnerPageSize[] = [5, 10, 20];
const DEFAULT_SORT: OwnerSort = 'name,asc';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  displayedColumns = ['name', 'address', 'city', 'telephone', 'pets'];
  pageSizeOptions = PAGE_SIZE_OPTIONS;

  errorMessage: string;
  lastName = '';
  owners: Owner[] = [];
  totalElements = 0;
  pageIndex = 0;
  pageSize: OwnerPageSize = DEFAULT_PAGE_SIZE;
  sort: OwnerSort = DEFAULT_SORT;
  isOwnersDataReceived = false;

  private queryParamsSubscription: Subscription;

  get sortActive(): string {
    return this.sort.split(',')[0];
  }

  get sortDirection(): 'asc' | 'desc' {
    return this.sort.split(',')[1] === 'desc' ? 'desc' : 'asc';
  }

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private ownerService: OwnerService
  ) {
  }

  ngOnInit() {
    this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
      this.lastName = params.lastName ?? '';
      this.pageIndex = params.page ? Number(params.page) : 0;
      this.pageSize = PAGE_SIZE_OPTIONS.find(option => option === Number(params.size)) ?? DEFAULT_PAGE_SIZE;
      this.sort = params.sort ?? DEFAULT_SORT;
      this.loadOwners();
    });
  }

  ngOnDestroy() {
    this.queryParamsSubscription?.unsubscribe();
  }

  private loadOwners() {
    this.ownerService.getOwners({
      lastName: this.lastName,
      page: this.pageIndex,
      size: this.pageSize,
      sort: this.sort
    }).pipe(
      finalize(() => this.isOwnersDataReceived = true)
    ).subscribe(
      page => {
        this.owners = page.content;
        this.totalElements = page.totalElements;
        // Render what the server actually paged by, not what we asked for - the server clamps
        // the size too, and the paginator must never disagree with the rows on screen.
        this.pageIndex = page.number;
        this.pageSize = page.size as OwnerPageSize;
      },
      error => this.errorMessage = error as any);
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  searchByLastName(lastName: string) {
    // Search always returns to page 1 - the current page position means nothing once the
    // matching result set changes.
    this.navigate({lastName, page: 0});
  }

  onSortChange(sortState: Sort) {
    const sort = sortState.direction
      ? `${sortState.active},${sortState.direction}` as OwnerSort
      : DEFAULT_SORT;
    // Sorting always returns to page 1 - see searchByLastName for the rationale.
    this.navigate({sort, page: 0});
  }

  onPageChange(pageEvent: PageEvent) {
    if (pageEvent.pageSize !== this.pageSize) {
      // Changing the page size always returns to page 1 - see searchByLastName for the rationale.
      this.navigate({size: pageEvent.pageSize as OwnerPageSize, page: 0});
    } else {
      // Only the paginator's own next/previous/goto navigation carries the page index through.
      this.navigate({page: pageEvent.pageIndex});
    }
  }

  private navigate(changes: OwnerQuery) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        lastName: changes.lastName ?? this.lastName,
        size: changes.size ?? this.pageSize,
        sort: changes.sort ?? this.sort,
        page: changes.page ?? this.pageIndex
      }
    });
  }
}
