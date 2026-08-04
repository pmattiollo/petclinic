import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {Subscription} from 'rxjs';
import {finalize} from 'rxjs/operators';

export const DEFAULT_PAGE_SIZE = 10;
export const DEFAULT_SORT = 'name,asc';

type SortColumn = 'name' | 'city';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  errorMessage: string;
  owners: Owner[] = [];
  isOwnersDataReceived = false;

  // Grid state, sourced from the URL query params (source of truth).
  lastName = '';
  page = 0;
  size = DEFAULT_PAGE_SIZE;
  sort = DEFAULT_SORT;

  totalElements = 0;
  totalPages = 0;

  // Local draft for the "Last name" input, so typing doesn't itself trigger a search/navigation.
  lastNameDraft = '';

  private queryParamsSubscription: Subscription;

  constructor(private router: Router, private route: ActivatedRoute, private ownerService: OwnerService) {
  }

  ngOnInit() {
    this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
      this.lastName = params['lastName'] ?? '';
      this.lastNameDraft = this.lastName;
      this.page = params['page'] !== undefined ? Number(params['page']) : 0;
      this.size = params['size'] !== undefined ? Number(params['size']) : DEFAULT_PAGE_SIZE;
      this.sort = params['sort'] ?? DEFAULT_SORT;
      this.load();
    });
  }

  ngOnDestroy() {
    this.queryParamsSubscription?.unsubscribe();
  }

  get sortColumn(): SortColumn {
    return this.sort.split(',')[0] as SortColumn;
  }

  get sortDirection(): 'asc' | 'desc' {
    return this.sort.endsWith('desc') ? 'desc' : 'asc';
  }

  ariaSortFor(column: SortColumn): 'ascending' | 'descending' | 'none' {
    if (this.sortColumn !== column) {
      return 'none';
    }
    return this.sortDirection === 'asc' ? 'ascending' : 'descending';
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  searchByLastName(lastName: string) {
    this.navigate({lastName, page: 0});
  }

  sortBy(column: SortColumn) {
    const nextDirection = this.sortColumn === column && this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.navigate({sort: `${column},${nextDirection}`, page: 0});
  }

  goToPage(page: number) {
    if (page < 0 || page >= this.totalPages) {
      return;
    }
    this.navigate({page});
  }

  changePageSize(size: number) {
    // Keep the first row currently on screen in view under the new page size.
    const firstVisibleRowIndex = this.page * this.size;
    const newPage = Math.floor(firstVisibleRowIndex / size);
    this.navigate({size, page: newPage});
  }

  private load() {
    this.ownerService.getOwners({lastName: this.lastName, page: this.page, size: this.size, sort: this.sort})
      .pipe(finalize(() => this.isOwnersDataReceived = true))
      .subscribe(
        result => {
          this.owners = result.content;
          this.totalElements = result.totalElements;
          this.totalPages = result.totalPages;
          // The requested page turned out to be empty (e.g. a stale/bookmarked page number,
          // or the result set shrank) — fall back to the last page that actually has results.
          if (result.content.length === 0 && result.number > 0 && result.totalPages > 0) {
            this.navigate({page: result.totalPages - 1});
          }
        },
        error => this.errorMessage = error as any);
  }

  private navigate(changes: Partial<{ lastName: string; page: number; size: number; sort: string }>) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        lastName: this.lastName,
        page: this.page,
        size: this.size,
        sort: this.sort,
        ...changes
      }
    });
  }
}
