/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {DebugElement, NO_ERRORS_SCHEMA} from '@angular/core';

import {OwnerListComponent} from './owner-list.component';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import { OwnerService } from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage} from '../owner-page';
import {Observable, of} from 'rxjs';
import {RouterTestingModule} from '@angular/router/testing';
import {CommonModule} from '@angular/common';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {PartsModule} from '../../parts/parts.module';
import {ActivatedRouteStub} from '../../testing/router-stubs';
import {OwnerDetailComponent} from '../owner-detail/owner-detail.component';
import {OwnersModule} from '../owners.module';
import {DummyComponent} from '../../testing/dummy.component';
import {OwnerAddComponent} from '../owner-add/owner-add.component';
import {OwnerEditComponent} from '../owner-edit/owner-edit.component';
import Spy = jasmine.Spy;


class OwnerServiceStub {
  getOwners(query?: any): Observable<OwnerPage> {
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
  let activatedRoute: ActivatedRouteStub;
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
  let testOwnerPage: OwnerPage;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [CommonModule, FormsModule, PartsModule, OwnersModule, NoopAnimationsModule,
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
    testOwnerPage = {content: [testOwner], totalElements: 1, totalPages: 1, number: 0, size: 10};

    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    ownerService = fixture.debugElement.injector.get(OwnerService);
    getOwnersSpy = spyOn(ownerService, 'getOwners')
      .and.returnValue(of(testOwnerPage));

    activatedRoute = fixture.debugElement.injector.get(ActivatedRoute) as any;
    activatedRoute.testQueryParams = {};

    router = TestBed.inject(Router);
    navigateSpy = spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should call ngOnInit() method and load owners with default query params', () => {
    fixture.detectChanges();

    expect(getOwnersSpy).toHaveBeenCalledWith({lastName: '', page: 0, size: 10, sort: 'name,asc'});
  });

  it('should load owners using the route query params', () => {
    activatedRoute.testQueryParams = {lastName: 'Fra', page: '2', size: '20', sort: 'city,desc'};

    fixture.detectChanges();

    expect(getOwnersSpy).toHaveBeenCalledWith({lastName: 'Fra', page: 2, size: 20, sort: 'city,desc'});
  });

  it('should fall back to the default page size for an unsupported size query param', () => {
    activatedRoute.testQueryParams = {size: '1000'};

    fixture.detectChanges();

    expect(getOwnersSpy).toHaveBeenCalledWith({lastName: '', page: 0, size: 10, sort: 'name,asc'});
  });

  it('should render the owner name as "Last, First"', waitForAsync(() => {
    fixture.detectChanges();
    fixture.whenStable().then(() => {
      fixture.detectChanges();
      de = fixture.debugElement.query(By.css('.ownerFullName'));
      el = de.nativeElement;
      expect(el.innerText).toBe(`${testOwner.lastName}, ${testOwner.firstName}`);
    });
  }));

  it('searchByLastName should navigate back to page 0 with the new lastName', () => {
    fixture.detectChanges();

    component.searchByLastName('Fr');

    expect(navigateSpy).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({lastName: 'Fr', page: 0})
    }));
  });

  it('onSortChange should navigate back to page 0 with the new sort', () => {
    fixture.detectChanges();

    component.onSortChange({active: 'city', direction: 'desc'});

    expect(navigateSpy).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({sort: 'city,desc', page: 0})
    }));
  });

  it('onSortChange should fall back to the default sort when the direction is cleared', () => {
    fixture.detectChanges();

    component.onSortChange({active: 'city', direction: ''});

    expect(navigateSpy).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({sort: 'name,asc', page: 0})
    }));
  });

  it('onPageChange should navigate back to page 0 when the page size changes', () => {
    fixture.detectChanges();

    component.onPageChange({pageIndex: 3, pageSize: 20, length: 100, previousPageIndex: 0});

    expect(navigateSpy).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({size: 20, page: 0})
    }));
  });

  it('onPageChange should preserve the other params and only change the page when the size is unchanged', () => {
    fixture.detectChanges();

    component.onPageChange({pageIndex: 3, pageSize: 10, length: 100, previousPageIndex: 0});

    expect(navigateSpy).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({page: 3, size: 10, lastName: '', sort: 'name,asc'})
    }));
  });

});
