/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {DebugElement, NO_ERRORS_SCHEMA} from '@angular/core';

import {OwnerListComponent} from './owner-list.component';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {OwnerPage} from '../owner-page';
import { OwnerService } from '../owner.service';
import {Owner} from '../owner';
import {Observable, of} from 'rxjs';
import {RouterTestingModule} from '@angular/router/testing';
import {CommonModule} from '@angular/common';
import {PartsModule} from '../../parts/parts.module';
import {ActivatedRouteStub} from '../../testing/router-stubs';
import {OwnerDetailComponent} from '../owner-detail/owner-detail.component';
import {OwnersModule} from '../owners.module';
import {DummyComponent} from '../../testing/dummy.component';
import {OwnerAddComponent} from '../owner-add/owner-add.component';
import {OwnerEditComponent} from '../owner-edit/owner-edit.component';
import Spy = jasmine.Spy;


class OwnerServiceStub {
  getOwners(): Observable<OwnerPage> {
    return of();
  }

  searchOwners(lastName: string): Observable<OwnerPage> {
    return of();
  }
}

describe('OwnerListComponent', () => {

  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerService = new OwnerServiceStub();
  let getOwnersSpy: Spy;
  let searchOwnersSpy: Spy;
  let router: Router;
  let navigateSpy: Spy;
  let de: DebugElement;
  let el: HTMLElement;


  const testOwner: Owner = {
    id: 1,
    firstName: 'George',
    lastName: 'Franklin',
    address: '110 W. Liberty St.',
    city: 'Madison',
    telephone: '6085551023',
    pets: []
  };
  let testPage: OwnerPage;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [CommonModule, FormsModule, PartsModule, OwnersModule,
        RouterTestingModule.withRoutes(
          [{path: 'owners', component: OwnerListComponent},
            {path: 'owners/add', component: OwnerAddComponent},
            {path: 'owners/:id', component: OwnerDetailComponent},
            {path: 'owners/:id/edit', component: OwnerEditComponent}
          ])],
      providers: [
        {provide: OwnerService, useValue: ownerService},
        {provide: ActivatedRoute, useClass: ActivatedRouteStub}
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    testPage = {
      content: [testOwner],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 10
    };

    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    ownerService = fixture.debugElement.injector.get(OwnerService);
    getOwnersSpy = spyOn(ownerService, 'getOwners')
      .and.returnValue(of(testPage));
    searchOwnersSpy = spyOn(ownerService, 'searchOwners')
      .and.returnValue(of(testPage));
    router = TestBed.inject(Router);
    navigateSpy = spyOn(router, 'navigate');
  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should call ngOnInit() method', () => {
    fixture.detectChanges();
    expect(getOwnersSpy.calls.any()).toBe(true, 'getOwners called');
  });


  it(' should show full name after getOwners observable (async) ', waitForAsync(() => {
    fixture.detectChanges();
    fixture.whenStable().then(() => { // wait for async getOwners
      fixture.detectChanges();        // update view with name
      de = fixture.debugElement.query(By.css('.ownerFullName'));
      el = de.nativeElement;
      // Surname first, so that the alphabetical ordering is visible in the column being read.
      expect(el.innerText).toBe((testOwner.lastName.toString() + ', ' + testOwner.firstName.toString()));
    });
  }));

  // Searching, sorting and paging all go through the URL — the component reacts to query params rather than
  // calling the service directly, which is what makes the view shareable and the Back button work.

  it('searchByLastName should put the term in the URL and return to the first page', () => {
    component.searchByLastName('Fr');

    const queryParams = navigateSpy.calls.mostRecent().args[1].queryParams;
    expect(queryParams.lastName).toBe('Fr');
    expect(queryParams.page).toBe(0);
  });

  it('sortBy should reverse the direction when the same column is clicked twice', () => {
    component.query = {page: 0, size: 10, sort: 'NAME', direction: 'ASC', lastName: ''};

    component.sortBy('NAME');

    expect(navigateSpy.calls.mostRecent().args[1].queryParams.direction).toBe('DESC');
  });

  it('sortBy should start ascending when a different column is clicked', () => {
    component.query = {page: 0, size: 10, sort: 'NAME', direction: 'DESC', lastName: ''};

    component.sortBy('CITY');

    const queryParams = navigateSpy.calls.mostRecent().args[1].queryParams;
    expect(queryParams.sort).toBe('CITY');
    expect(queryParams.direction).toBe('ASC');
  });

  it('changing the page size should return to the first page', () => {
    component.query = {page: 3, size: 10, sort: 'NAME', direction: 'ASC', lastName: ''};

    component.changePageSize(5);

    const queryParams = navigateSpy.calls.mostRecent().args[1].queryParams;
    expect(queryParams.size).toBe(5);
    expect(queryParams.page).toBe(0);
  });

});
