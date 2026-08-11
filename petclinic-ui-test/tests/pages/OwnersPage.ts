import { Page, Locator } from '@playwright/test';

export class OwnersPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly lastNameInput: Locator;
  readonly findOwnerButton: Locator;
  readonly ownerNameCells: Locator;
  readonly ownersTable: Locator;
  readonly sortByNameHeader: Locator;
  readonly sortByCityHeader: Locator;
  readonly pageSizeSelect: Locator;
  readonly nextPageButton: Locator;
  readonly previousPageButton: Locator;
  readonly pageIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h2:has-text("Owners")');
    this.lastNameInput = page.locator('#lastName');
    this.findOwnerButton = page.locator('#search-owner-form button[type="submit"]');
    this.ownerNameCells = page.locator('#ownersTable td.ownerFullName');
    this.ownersTable = page.locator('#ownersTable');
    this.sortByNameHeader = page.locator('#sortByName');
    this.sortByCityHeader = page.locator('#sortByCity');
    this.pageSizeSelect = page.locator('#pageSize');
    this.nextPageButton = page.locator('#nextPage');
    this.previousPageButton = page.locator('#previousPage');
    this.pageIndicator = page.locator('#pageIndicator');
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

  async sortByName() {
    await this.sortByNameHeader.click();
    await this.page.waitForLoadState('networkidle');
  }

  async sortByCity() {
    await this.sortByCityHeader.click();
    await this.page.waitForLoadState('networkidle');
  }

  async getCities(): Promise<string[]> {
    const rows = await this.page.locator('#ownersTable tbody tr').all();
    const cities: string[] = [];
    for (const row of rows) {
      const city = await row.locator('td').nth(2).textContent();
      if (city && city.trim()) {
        cities.push(city.trim());
      }
    }
    return cities;
  }

  async setPageSize(size: number) {
    await this.pageSizeSelect.selectOption(String(size));
    await this.page.waitForLoadState('networkidle');
  }

  async goToNextPage() {
    await this.nextPageButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async goToPreviousPage() {
    await this.previousPageButton.click();
    await this.page.waitForLoadState('networkidle');
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
}
