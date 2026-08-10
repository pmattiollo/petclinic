import {Component, OnDestroy, OnInit} from '@angular/core';
import {OwnerPageSize, OwnerService, OwnerSortColumn, OwnerSortDirection} from '../owner.service';
import {Owner} from '../owner';
import {ActivatedRoute, ParamMap, Router} from '@angular/router';
import {Sort} from '@angular/material/sort';
import {PageEvent} from '@angular/material/paginator';
import {Subject, Subscription} from 'rxjs';
import {debounceTime, distinctUntilChanged, switchMap} from 'rxjs/operators';

const PAGE_SIZE_OPTIONS: OwnerPageSize[] = [5, 10, 20];
const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_SORT: `${OwnerSortColumn},${OwnerSortDirection}` = 'name,asc';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  errorMessage: string;
  owners: Owner[] = [];
  totalElements = 0;
  lastName = '';
  page = 0;
  size: OwnerPageSize = 10;
  sortColumn: OwnerSortColumn = 'name';
  sortDirection: OwnerSortDirection = 'asc';
  isLoading = false;
  isOwnersDataReceived = false;

  private readonly searchTermChanged = new Subject<string>();
  private readonly subscriptions = new Subscription();

  constructor(private router: Router, private route: ActivatedRoute, private ownerService: OwnerService) {
  }

  ngOnInit() {
    this.subscriptions.add(
      this.route.queryParamMap.pipe(
        switchMap(params => {
          this.readStateFromParams(params);
          this.isLoading = true;
          return this.ownerService.getOwnersPage({
            lastName: this.lastName,
            page: this.page,
            size: this.size,
            sortColumn: this.sortColumn,
            sortDirection: this.sortDirection
          });
        })
      ).subscribe(
        page => {
          this.owners = page.content;
          this.totalElements = page.totalElements;
          this.errorMessage = undefined;
          this.isLoading = false;
          this.isOwnersDataReceived = true;
        },
        error => {
          this.errorMessage = error;
          this.isLoading = false;
          this.isOwnersDataReceived = true;
        }
      )
    );

    this.subscriptions.add(
      this.searchTermChanged.pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged()
      ).subscribe(lastName => this.navigate({lastName, page: 0}))
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  searchByLastName(lastName: string) {
    this.searchTermChanged.next(lastName);
  }

  onSortChange(sort: Sort) {
    if (!sort.direction) {
      return; // matSortDisableClear keeps a direction always set
    }
    this.navigate({sort: `${sort.active},${sort.direction}`, page: 0});
  }

  onPageChange(event: PageEvent) {
    const sizeChanged = event.pageSize !== this.size;
    this.navigate({page: sizeChanged ? 0 : event.pageIndex, size: event.pageSize});
  }

  private readStateFromParams(params: ParamMap) {
    this.lastName = params.get('lastName') ?? '';
    this.page = Number(params.get('page') ?? 0) || 0;
    const requestedSize = Number(params.get('size')) as OwnerPageSize;
    this.size = this.pageSizeOptions.includes(requestedSize) ? requestedSize : 10;
    const [column, direction] = (params.get('sort') ?? DEFAULT_SORT).split(',');
    this.sortColumn = column === 'city' ? 'city' : 'name';
    this.sortDirection = direction === 'desc' ? 'desc' : 'asc';
  }

  private navigate(changes: {lastName?: string; page?: number; size?: number; sort?: string}) {
    const queryParams = {
      lastName: changes.lastName ?? this.lastName,
      page: changes.page ?? this.page,
      size: changes.size ?? this.size,
      sort: changes.sort ?? `${this.sortColumn},${this.sortDirection}`
    };
    this.router.navigate([], {relativeTo: this.route, queryParams});
  }
}

