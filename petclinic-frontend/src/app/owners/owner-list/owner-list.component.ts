import {Component, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {Router} from '@angular/router';
import {EMPTY, Subject} from 'rxjs';
import {catchError, finalize, switchMap} from 'rxjs/operators';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  errorMessage: string;
  lastName: string;
  owners: Owner[];
  listOfOwnersWithLastName: Owner[];
  isOwnersDataReceived: boolean = false;

  // Emits each search term (empty string == "list all"). switchMap cancels
  // any still-pending previous request so an out-of-order response from an
  // earlier search can never overwrite the result of a more recent one.
  private searchTerms = new Subject<string>();

  constructor(private router: Router, private ownerService: OwnerService) {
    this.searchTerms.pipe(
      switchMap((lastName: string) => {
        if (lastName) {
          return this.ownerService.searchOwners(lastName).pipe(
            finalize(() => this.isOwnersDataReceived = true),
            catchError(() => {
              this.owners = null;
              return EMPTY;
            })
          );
        }
        return this.ownerService.getOwners().pipe(
          finalize(() => this.isOwnersDataReceived = true),
          catchError((error) => {
            this.errorMessage = error as any;
            return EMPTY;
          })
        );
      })
    ).subscribe(owners => this.owners = owners);
  }

  ngOnInit() {
    this.searchTerms.next('');
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  searchByLastName(lastName: string) {
    this.searchTerms.next(lastName);
  }

}
