// export for convenience.
export {ActivatedRoute, Router, RouterLink, RouterOutlet} from '@angular/router';

import {Component, Directive, HostListener, Injectable, Input} from '@angular/core';
import {NavigationExtras} from '@angular/router';
// Only implements params and part of snapshot.params
import {BehaviorSubject} from 'rxjs';

@Directive({
  selector: '[appRouterLink]',
})
export class RouterLinkStubDirective {
  @Input() linkParams: any;
  navigatedTo: any = null;

  @HostListener('click', ['$event'])
  onClick() {
    this.navigatedTo = this.linkParams;
  }
}

@Component({selector: 'app-router-outlet', template: ''})
export class RouterOutletStubComponent {
}

@Injectable()
export class RouterStub {
  navigate(commands: any[], extras?: NavigationExtras) {
  }
}


@Injectable()
export class ActivatedRouteStub {

  // ActivatedRoute.params is Observable
  private subject = new BehaviorSubject(this.testParams);
  params = this.subject.asObservable();

  // ActivatedRoute.queryParams is a separate Observable from `params` in the real router, so it
  // gets its own subject here: a spec must be able to say "path param id=5, no query params",
  // and a component reading the wrong one must fail rather than silently see the same object.
  private querySubject = new BehaviorSubject(this.testQueryParams);
  queryParams = this.querySubject.asObservable();

  // Test parameters
  // tslint:disable-next-line:variable-name
  private _testParams: {};
  get testParams() {
    return this._testParams;
  }

  set testParams(params: {}) {
    this._testParams = params;
    this.subject.next(params);
  }

  // tslint:disable-next-line:variable-name
  private _testQueryParams: {} = {};
  get testQueryParams() {
    return this._testQueryParams;
  }

  set testQueryParams(params: {}) {
    this._testQueryParams = params;
    this.querySubject.next(params);
  }

  // ActivatedRoute.snapshot
  // Note: this must NOT go through the `testParams` setter - that setter also emits through
  // `subject`, and any consumer already subscribed to `params` (e.g. a component's ngOnInit)
  // would receive an unwanted extra emission every time something merely reads `.snapshot`
  // (as `routerLink` does internally).
  get snapshot() {
    return {params: {id: 1}, queryParams: this._testQueryParams};
  }
}
