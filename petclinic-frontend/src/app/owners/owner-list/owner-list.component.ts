import {Component, OnInit, ViewChild, AfterViewInit} from '@angular/core';
import {OwnerService, PageRequest, PageResponse} from '../owner.service';
import {Owner} from '../owner';
import {Router} from '@angular/router';
import {MatPaginator, PageEvent} from '@angular/material/paginator';
import {MatSort, Sort} from '@angular/material/sort';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, AfterViewInit {
  errorMessage: string;
  lastName: string = '';
  owners: Owner[] = [];
  totalElements: number = 0;
  isOwnersDataReceived: boolean = false;

  displayedColumns: string[] = ['name', 'address', 'city', 'telephone', 'pets'];
  pageSize: number = 10;
  pageIndex: number = 0;
  sortField: string = 'name';
  sortDirection: string = 'asc';

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  constructor(private router: Router, private ownerService: OwnerService) {}

  ngOnInit() {
    this.loadOwners();
  }

  ngAfterViewInit() {}

  loadOwners() {
    const pageRequest: PageRequest = {
      page: this.pageIndex,
      size: this.pageSize,
      sort: this.sortField,
      sortDir: this.sortDirection
    };

    const request$ = this.lastName
      ? this.ownerService.searchOwners(this.lastName, pageRequest)
      : this.ownerService.getOwners(pageRequest);

    request$.subscribe((page: PageResponse<Owner>) => {
      this.owners = page.content;
      this.totalElements = page.totalElements;
      this.isOwnersDataReceived = true;
    });
  }

  onPageChange(event: PageEvent) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadOwners();
  }

  onSortChange(sort: Sort) {
    this.sortField = sort.active || 'name';
    this.sortDirection = sort.direction || 'asc';
    this.pageIndex = 0;
    if (this.paginator) {
      this.paginator.pageIndex = 0;
    }
    this.loadOwners();
  }

  searchByLastName(lastName: string) {
    this.lastName = lastName;
    this.pageIndex = 0;
    if (this.paginator) {
      this.paginator.pageIndex = 0;
    }
    this.loadOwners();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }
}
