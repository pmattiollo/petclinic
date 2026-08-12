/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {DebugElement, NO_ERRORS_SCHEMA} from '@angular/core';

import {OwnerListComponent} from './owner-list.component';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import { OwnerService, PageResponse } from '../owner.service';
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
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import Spy = jasmine.Spy;


class OwnerServiceStub {
  getOwners(): Observable<PageResponse<Owner>> {
    return of({ content: [], totalElements: 0, totalPages: 0, size: 10, number: 0 });
  }

  searchOwners(lastName: string): Observable<PageResponse<Owner>> {
    return of({ content: [], totalElements: 0, totalPages: 0, size: 10, number: 0 });
  }
}

describe('OwnerListComponent', () => {

  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerService: any;
  let getOwnersSpy: Spy;
  let searchOwnersSpy: Spy;
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

  const testPage: PageResponse<Owner> = {
    content: [testOwner],
    totalElements: 1,
    totalPages: 1,
    size: 10,
    number: 0
  };

  const emptyPage: PageResponse<Owner> = {
    content: [],
    totalElements: 0,
    totalPages: 0,
    size: 10,
    number: 0
  };

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [CommonModule, FormsModule, PartsModule, OwnersModule, BrowserAnimationsModule,
        RouterTestingModule.withRoutes(
          [{path: 'owners', component: OwnerListComponent},
            {path: 'owners/add', component: OwnerAddComponent},
            {path: 'owners/:id', component: OwnerDetailComponent},
            {path: 'owners/:id/edit', component: OwnerEditComponent}
          ])],
      providers: [
        {provide: OwnerService, useValue: new OwnerServiceStub()},
        {provide: ActivatedRoute, useClass: ActivatedRouteStub}
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    ownerService = fixture.debugElement.injector.get(OwnerService);
    getOwnersSpy = spyOn(ownerService, 'getOwners')
      .and.returnValue(of(testPage));
    searchOwnersSpy = spyOn(ownerService, 'searchOwners')
      .and.returnValue(of(testPage));
  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should call getOwners on init', () => {
    fixture.detectChanges();
    expect(getOwnersSpy.calls.any()).toBe(true, 'getOwners called');
  });

  it('should display owner name after loading', waitForAsync(() => {
    fixture.detectChanges();
    fixture.whenStable().then(() => {
      fixture.detectChanges();
      de = fixture.debugElement.query(By.css('td a'));
      if (de) {
        el = de.nativeElement;
        expect(el.textContent.trim()).toContain('George');
      }
    });
  }));

  it('searchByLastName with empty string should call getOwners', () => {
    fixture.detectChanges();
    getOwnersSpy.calls.reset();
    searchOwnersSpy.calls.reset();

    component.searchByLastName('');

    expect(getOwnersSpy).toHaveBeenCalled();
    expect(searchOwnersSpy).not.toHaveBeenCalled();
  });

  it('searchByLastName with non-empty string should call searchOwners', () => {
    fixture.detectChanges();
    getOwnersSpy.calls.reset();
    searchOwnersSpy.calls.reset();

    component.searchByLastName('Fr');

    expect(searchOwnersSpy).toHaveBeenCalled();
    expect(getOwnersSpy).not.toHaveBeenCalled();
  });

  it('searchByLastName should reset page index to 0', () => {
    fixture.detectChanges();
    component.pageIndex = 3;
    component.searchByLastName('Fr');
    expect(component.pageIndex).toBe(0);
  });

  it('should not show "No owners" message while still loading', () => {
    getOwnersSpy.and.returnValue(new Observable<PageResponse<Owner>>());
    fixture.detectChanges();

    const noOwnersMessage = fixture.debugElement.query(By.css('.no-owners-message'));
    expect(noOwnersMessage).toBeNull('message should be hidden while loading');
  });

  it('should show "No owners" message after data loaded and empty', () => {
    getOwnersSpy.and.returnValue(of(emptyPage));
    fixture.detectChanges();

    const noOwnersMessage = fixture.debugElement.query(By.css('.no-owners-message'));
    expect(noOwnersMessage).not.toBeNull('message should be shown once loaded and empty');
  });

  it('should render mat-paginator', waitForAsync(() => {
    fixture.detectChanges();
    fixture.whenStable().then(() => {
      fixture.detectChanges();
      const paginator = fixture.debugElement.query(By.css('mat-paginator'));
      expect(paginator).not.toBeNull('mat-paginator should be present');
    });
  }));

  it('onSortChange should reset page index and reload', () => {
    fixture.detectChanges();
    component.pageIndex = 2;
    getOwnersSpy.calls.reset();

    component.onSortChange({ active: 'city', direction: 'desc' });

    expect(component.pageIndex).toBe(0);
    expect(component.sortField).toBe('city');
    expect(component.sortDirection).toBe('desc');
    expect(getOwnersSpy).toHaveBeenCalled();
  });

  it('onPageChange should update pageIndex and pageSize', () => {
    fixture.detectChanges();
    getOwnersSpy.calls.reset();

    component.onPageChange({ pageIndex: 2, pageSize: 20, length: 50 });

    expect(component.pageIndex).toBe(2);
    expect(component.pageSize).toBe(20);
    expect(getOwnersSpy).toHaveBeenCalled();
  });

});
