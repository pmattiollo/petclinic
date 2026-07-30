import { Page, Locator } from '@playwright/test';

export class OwnersPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly lastNameInput: Locator;
  readonly findOwnerButton: Locator;
  readonly ownerNameCells: Locator;
  readonly ownersTable: Locator;
  readonly paginator: Locator;
  readonly nextPageButton: Locator;
  readonly previousPageButton: Locator;
  readonly pageSizeSelect: Locator;
  readonly nameSortHeader: Locator;
  readonly citySortHeader: Locator;
  readonly addressHeader: Locator;
  readonly telephoneHeader: Locator;
  readonly petsHeader: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h2:has-text("Owners")');
    this.lastNameInput = page.locator('#lastName');
    this.findOwnerButton = page.locator('#search-owner-form button[type="submit"]');
    this.ownerNameCells = page.locator('#ownersTable td.ownerFullName');
    this.ownersTable = page.locator('#ownersTable');
    this.paginator = page.locator('mat-paginator');
    this.nextPageButton = page.locator('button.mat-mdc-paginator-navigation-next');
    this.previousPageButton = page.locator('button.mat-mdc-paginator-navigation-previous');
    this.pageSizeSelect = page.locator('.mat-mdc-paginator-page-size-select');
    this.nameSortHeader = page.locator('th[mat-sort-header]:has-text("Name")');
    this.citySortHeader = page.locator('th[mat-sort-header]:has-text("City")');
    this.addressHeader = page.locator('th:has-text("Address")');
    this.telephoneHeader = page.locator('th:has-text("Telephone")');
    this.petsHeader = page.locator('th:has-text("Pets")');
  }

  async open() {
    await this.page.goto('/owners');
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

  /** Reads the current page index straight from the URL's `page` query param (0-based; absent means 0). */
  currentPageIndex(): number {
    const url = new URL(this.page.url());
    const page = url.searchParams.get('page');
    return page ? Number(page) : 0;
  }

  async goToNextPage() {
    await this.nextPageButton.click();
  }

  async sortByName() {
    await this.nameSortHeader.click();
  }

  async sortByCity() {
    await this.citySortHeader.click();
  }

  async choosePageSize(size: 5 | 10 | 20) {
    await this.pageSizeSelect.click();
    await this.page.locator(`mat-option:has-text("${size}")`).click();
  }
}

