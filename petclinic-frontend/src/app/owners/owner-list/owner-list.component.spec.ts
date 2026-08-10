/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, fakeAsync, tick, waitForAsync } from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {DebugElement, NO_ERRORS_SCHEMA} from '@angular/core';

import {OwnerListComponent} from './owner-list.component';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import { OwnerService, OwnerQuery } from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage} from '../owner-page';
import {Observable, of, throwError} from 'rxjs';
import {RouterTestingModule} from '@angular/router/testing';
import {CommonModule} from '@angular/common';
import {PartsModule} from '../../parts/parts.module';
import {ActivatedRouteStub} from '../../testing/router-stubs';
import {OwnerDetailComponent} from '../owner-detail/owner-detail.component';
import {OwnersModule} from '../owners.module';
import {DummyComponent} from '../../testing/dummy.component';
import {OwnerAddComponent} from '../owner-add/owner-add.component';
import {OwnerEditComponent} from '../owner-edit/owner-edit.component';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import Spy = jasmine.Spy;

// content is assigned straight into the component, so a shared array would leak mutable state
// between callers.
const emptyOwnerPage = (): OwnerPage => ({content: [], totalElements: 0, totalPages: 0, number: 0, size: 10});

class OwnerServiceStub {
  getOwnersPage(query: OwnerQuery): Observable<OwnerPage> {
    return of(emptyOwnerPage());
  }
}

describe('OwnerListComponent', () => {

  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerService: OwnerServiceStub;
  let getOwnersPageSpy: Spy;
  let router: Router;
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

  beforeEach(waitForAsync(() => {
    ownerService = new OwnerServiceStub();
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
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    ownerService = fixture.debugElement.injector.get(OwnerService);
    router = fixture.debugElement.injector.get(Router);
    getOwnersPageSpy = spyOn(ownerService, 'getOwnersPage')
      .and.returnValue(of({content: [testOwner], totalElements: 1, totalPages: 1, number: 0, size: 10}));
    spyOn(router, 'navigate');
  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('loads the default page on init and shows the name surname-first', () => {
    fixture.detectChanges();

    expect(getOwnersPageSpy).toHaveBeenCalledWith({
      lastName: '', page: 0, size: 10, sortColumn: 'name', sortDirection: 'asc'
    });
    de = fixture.debugElement.query(By.css('.ownerFullName'));
    el = de.nativeElement;
    expect(el.textContent.trim()).toBe('Franklin, George');
  });

  it('shows an error banner (not an empty list) when the reload fails', () => {
    getOwnersPageSpy.and.returnValue(throwError('boom'));

    fixture.detectChanges();

    expect(component.errorMessage).toBe('boom');
    expect(component.owners.length).toBe(0);
  });

  it('searchByLastName debounces ~300ms then navigates to page 0 with the typed term', fakeAsync(() => {
    fixture.detectChanges();

    component.searchByLastName('Fr');
    tick(299);
    expect(router.navigate).not.toHaveBeenCalled();

    tick(1);
    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({lastName: 'Fr', page: 0})
    }));
  }));

  it('onSortChange navigates with the new sort and resets to page 0', () => {
    fixture.detectChanges();

    component.onSortChange({active: 'city', direction: 'desc'});

    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({sort: 'city,desc', page: 0})
    }));
  });

  it('onPageChange resets to page 0 when the page size changes', () => {
    fixture.detectChanges();

    component.onPageChange({pageIndex: 3, pageSize: 20, length: 100} as any);

    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({page: 0, size: 20})
    }));
  });

});

