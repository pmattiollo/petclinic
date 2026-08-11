import {Component, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {switchMap} from 'rxjs/operators';
import {
  DEFAULT_OWNER_QUERY,
  DEFAULT_PAGE_SIZE,
  OwnerPage,
  OwnerQuery,
  OwnerSortField,
  PAGE_SIZES,
  SortDirection,
} from '../owner-page';

/**
 * The Owners grid. Its whole state — page, size, ordering and filter — lives in the URL, so a view can be
 * bookmarked, shared and reached with the Back button. The component reacts to the query params rather than
 * holding a second copy of that state, which is what keeps the URL and the shown page from disagreeing.
 */
@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  errorMessage: string;
  owners: Owner[];
  page: OwnerPage;
  query: OwnerQuery = DEFAULT_OWNER_QUERY;
  /** Bound to the search box; the URL, not this field, is what actually drives the request. */
  lastName = '';
  isOwnersDataReceived = false;
  readonly pageSizes = PAGE_SIZES;

  constructor(private router: Router, private route: ActivatedRoute, private ownerService: OwnerService) {
  }

  ngOnInit() {
    this.route.queryParams.pipe(
      switchMap((params: Params) => {
        this.query = this.toQuery(params);
        this.lastName = this.query.lastName;
        return this.ownerService.getOwners(this.query);
      })
    ).subscribe(
      page => {
        this.page = page;
        this.owners = page.content;
        this.isOwnersDataReceived = true;
      },
      error => {
        this.errorMessage = error as any;
        this.owners = null;
        this.isOwnersDataReceived = true;
      });
  }

  private toQuery(params: Params): OwnerQuery {
    return {
      page: Number(params['page'] ?? DEFAULT_OWNER_QUERY.page),
      size: Number(params['size'] ?? DEFAULT_PAGE_SIZE),
      sort: (params['sort'] ?? DEFAULT_OWNER_QUERY.sort) as OwnerSortField,
      direction: (params['direction'] ?? DEFAULT_OWNER_QUERY.direction) as SortDirection,
      lastName: params['lastName'] ?? '',
    };
  }

  /** A new search term invalidates the page number: page 3 of the old result set means nothing in the new one. */
  searchByLastName(lastName: string) {
    this.navigateTo({lastName, page: 0});
  }

  sortBy(sort: OwnerSortField) {
    if (this.query.sort === sort) {
      this.navigateTo({direction: this.oppositeDirection(), page: 0});
      return;
    }
    this.navigateTo({sort, direction: 'ASC', page: 0});
  }

  private oppositeDirection(): SortDirection {
    if (this.query.direction === 'ASC') {
      return 'DESC';
    }
    return 'ASC';
  }

  isSortedBy(sort: OwnerSortField): boolean {
    return this.query.sort === sort;
  }

  sortIndicator(sort: OwnerSortField): string {
    if (!this.isSortedBy(sort)) {
      return '';
    }
    if (this.query.direction === 'ASC') {
      return '▲';
    }
    return '▼';
  }

  goToPage(page: number) {
    this.navigateTo({page});
  }

  changePageSize(size: number) {
    this.navigateTo({size: Number(size), page: 0});
  }

  get hasPreviousPage(): boolean {
    return this.query.page > 0;
  }

  get hasNextPage(): boolean {
    return !!this.page && this.query.page < this.page.totalPages - 1;
  }

  private navigateTo(changes: Partial<OwnerQuery>) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {...this.query, ...changes},
      queryParamsHandling: 'merge',
    });
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }
}
