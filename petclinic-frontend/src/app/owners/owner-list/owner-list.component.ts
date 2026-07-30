import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {ActivatedRoute, Router} from '@angular/router';
import {MatSort, Sort} from '@angular/material/sort';
import {MatPaginator, PageEvent} from '@angular/material/paginator';
import {Subscription} from 'rxjs';
import {finalize} from 'rxjs/operators';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 20];
const DEFAULT_SORT = 'name,asc';

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
  pageSize = DEFAULT_PAGE_SIZE;
  sort = DEFAULT_SORT;
  sortActive = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';
  isOwnersDataReceived = false;

  @ViewChild(MatSort) matSort: MatSort;
  @ViewChild(MatPaginator) matPaginator: MatPaginator;

  private queryParamsSubscription: Subscription;

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
      this.pageSize = params.size && PAGE_SIZE_OPTIONS.includes(Number(params.size))
        ? Number(params.size) : DEFAULT_PAGE_SIZE;
      this.sort = params.sort ?? DEFAULT_SORT;
      const [active, direction] = this.sort.split(',');
      this.sortActive = active;
      this.sortDirection = direction as 'asc' | 'desc';
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
    const sort = sortState.direction ? `${sortState.active},${sortState.direction}` : DEFAULT_SORT;
    // Sorting always returns to page 1 - see searchByLastName for the rationale.
    this.navigate({sort, page: 0});
  }

  onPageChange(pageEvent: PageEvent) {
    if (pageEvent.pageSize !== this.pageSize) {
      // Changing the page size always returns to page 1 - see searchByLastName for the rationale.
      this.navigate({size: pageEvent.pageSize, page: 0});
    } else {
      // Only the paginator's own next/previous/goto navigation carries the page index through.
      this.navigate({page: pageEvent.pageIndex});
    }
  }

  private navigate(changes: { lastName?: string; page?: number; size?: number; sort?: string }) {
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
