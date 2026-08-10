import { Page, Locator } from '@playwright/test';

export class OwnersPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly lastNameInput: Locator;
  readonly findOwnerButton: Locator;
  readonly ownerNameCells: Locator;
  readonly ownersTable: Locator;
  readonly errorBanner: Locator;
  readonly nameSortHeader: Locator;
  readonly citySortHeader: Locator;
  readonly nextPageButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h2:has-text("Owners")');
    this.lastNameInput = page.locator('#lastName');
    this.findOwnerButton = page.locator('#search-owner-form button[type="submit"]');
    this.ownerNameCells = page.locator('#ownersTable td.ownerFullName');
    this.ownersTable = page.locator('#ownersTable');
    this.errorBanner = page.locator('#ownersErrorBanner');
    this.nameSortHeader = page.locator('#ownersTable th[mat-sort-header="name"]');
    this.citySortHeader = page.locator('#ownersTable th[mat-sort-header="city"]');
    this.nextPageButton = page.locator('#ownersTable button.mat-mdc-paginator-navigation-next');
  }

  async open(queryString = '') {
    await this.page.goto(`/owners${queryString}`);
    await this.pageTitle.waitFor({ state: 'visible', timeout: 10000 });
  }

  async getOwnerFullNames(): Promise<string[]> {
    await this.page.waitForSelector('#ownersTable td.ownerFullName, #lastName', { timeout: 10000 });

    const elements = await this.ownerNameCells.all();
    const names: string[] = [];

    for (const element of elements) {
      const text = await element.textContent();
      if (text && text.trim()) {
        names.push(text.trim());
      }
    }

    return names;
  }

  async searchByLastNamePrefix(prefix: string) {
    await this.lastNameInput.waitFor({ state: 'visible' });
    await this.lastNameInput.clear();
    await this.lastNameInput.fill(prefix);
    await this.lastNameInput.press('Tab');

    await this.findOwnerButton.waitFor({ state: 'visible' });
    await this.findOwnerButton.click();
  }

  async sortBy(column: 'name' | 'city') {
    const header = column === 'name' ? this.nameSortHeader : this.citySortHeader;
    await header.click();
  }

  async goToNextPage() {
    await this.nextPageButton.click();
  }

  async waitForOwnersCount(expectedCount: number) {
    try {
      await this.page.waitForFunction(
        (count) => {
          const cells = document.querySelectorAll('#ownersTable td.ownerFullName');
          return cells.length === count;
        },
        expectedCount,
        { timeout: 10000 }
      );
    } catch (error) {
      // Let assertions fail with actual values when wait condition is not met
    }
  }
}

