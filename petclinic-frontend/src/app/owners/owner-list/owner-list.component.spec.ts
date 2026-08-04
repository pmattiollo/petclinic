/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {DebugElement, NO_ERRORS_SCHEMA} from '@angular/core';

import {OwnerListComponent} from './owner-list.component';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import { OwnerService } from '../owner.service';
import {Owner, OwnerPage} from '../owner';
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
  let router: Router;
  let navigateSpy: Spy;
  let activatedRouteStub: ActivatedRouteStub;
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
  let testOwners: Owner[];
  let testOwnerPage: OwnerPage;

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
    testOwners = [testOwner];
    testOwnerPage = {
      content: testOwners, totalElements: testOwners.length, totalPages: 1, number: 0, size: 10
    };

    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    ownerService = fixture.debugElement.injector.get(OwnerService);
    activatedRouteStub = fixture.debugElement.injector.get(ActivatedRoute) as unknown as ActivatedRouteStub;
    router = fixture.debugElement.injector.get(Router);
    navigateSpy = spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    getOwnersSpy = spyOn(ownerService, 'getOwners')
      .and.returnValue(of(testOwnerPage));
  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should call ngOnInit() method', () => {
    fixture.detectChanges();
    expect(getOwnersSpy.calls.any()).toBe(true, 'getOwners called');
  });

  it('reads the initial grid state from the URL query params', () => {
    activatedRouteStub.testQueryParams = {lastName: 'Pot', page: '2', size: '20', sort: 'city,desc'};

    fixture.detectChanges();

    expect(getOwnersSpy).toHaveBeenCalledWith({lastName: 'Pot', page: 2, size: 20, sort: 'city,desc'});
  });

  it('defaults to page 0, size 10, sort name,asc when the URL has no query params', () => {
    fixture.detectChanges();

    expect(getOwnersSpy).toHaveBeenCalledWith({lastName: '', page: 0, size: 10, sort: 'name,asc'});
  });

  it(' should show "Last, First" after getOwners observable (async) ', waitForAsync(() => {
    fixture.detectChanges();
    fixture.whenStable().then(() => { // wait for async getOwners
      fixture.detectChanges();        // update view with name
      de = fixture.debugElement.query(By.css('.owner-full-name'));
      el = de.nativeElement;
      expect(el.innerText).toBe((testOwner.lastName.toString() + ', ' + testOwner.firstName.toString()));
    });
  }));

  it('searchByLastName navigates with the new lastName and resets to page 0', () => {
    fixture.detectChanges();
    component.page = 3;

    component.searchByLastName('Fr');

    expect(navigateSpy).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({lastName: 'Fr', page: 0})
    }));
  });

  it('sortBy starts a new column ascending', () => {
    fixture.detectChanges();

    component.sortBy('city');

    expect(navigateSpy).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({sort: 'city,asc', page: 0})
    }));
  });

  it('sortBy toggles the active column to descending', () => {
    activatedRouteStub.testQueryParams = {sort: 'name,asc'};
    fixture.detectChanges();

    component.sortBy('name');

    expect(navigateSpy).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({sort: 'name,desc', page: 0})
    }));
  });

  it('goToPage navigates to a valid page', () => {
    activatedRouteStub.testQueryParams = {page: '0'};
    getOwnersSpy.and.returnValue(of({...testOwnerPage, totalPages: 3}));
    fixture.detectChanges();

    component.goToPage(1);

    expect(navigateSpy).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({page: 1})
    }));
  });

  it('goToPage ignores an out-of-range page', () => {
    activatedRouteStub.testQueryParams = {page: '0'};
    getOwnersSpy.and.returnValue(of({...testOwnerPage, totalPages: 1}));
    fixture.detectChanges();
    navigateSpy.calls.reset();

    component.goToPage(5);

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('changePageSize keeps the first visible row in view', () => {
    // page 2, size 10 -> first visible row is index 20; with size 20, that's page 1
    activatedRouteStub.testQueryParams = {page: '2', size: '10'};
    fixture.detectChanges();

    component.changePageSize(20);

    expect(navigateSpy).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({size: 20, page: 1})
    }));
  });

  it('navigates back to the last non-empty page when the requested page comes back empty', () => {
    activatedRouteStub.testQueryParams = {page: '5'};
    getOwnersSpy.and.returnValue(of({content: [], totalElements: 12, totalPages: 2, number: 5, size: 10}));

    fixture.detectChanges();

    expect(navigateSpy).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({page: 1})
    }));
  });

});
