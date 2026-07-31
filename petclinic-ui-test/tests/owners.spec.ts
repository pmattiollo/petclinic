import { test, expect } from './support/trace-fixture';
import { OwnersPage } from './pages/OwnersPage';
import { ApiClient } from './support/api-client';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Owners Page', () => {
  let apiClient: ApiClient;
  let screenshotDir: string;

  test.beforeAll(() => {
    apiClient = new ApiClient();
    screenshotDir = path.join(__dirname, '..', 'test-results', 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Capture screenshot after each test
    const sanitizedTitle = testInfo.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(screenshotDir, `${sanitizedTitle}_${timestamp}.png`);

    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPath}`);
  });

  test('shows the first page of owners, sorted by name, on initial load', async ({ page }) => {
    const ownersPage = new OwnersPage(page);

    // The default page size is 10 and the default sort is name ascending - the same order
    // and page size the API uses when called with no query params.
    const allOwnersByName = await apiClient.fetchAllOwners();
    const expectedFirstPage = ApiClient.getDisplayNames(allOwnersByName.slice(0, 10));

    // Open the owners page
    await ownersPage.open();

    // Wait for the expected number of owners
    await ownersPage.waitForOwnersCount(expectedFirstPage.length);

    // Get actual owner names from the page
    const actualFullNames = await ownersPage.getOwnerFullNames();

    // The grid must render exactly the first page, in the API's name-ascending order -
    // NOT just the same set in any order, since the whole point of sorting is the order.
    expect(actualFullNames).toEqual(expectedFirstPage);
  });

  test('filters owners by last name prefix', async ({ page }) => {
    // Fetch a page of owners and choose a last name to search for
    const someOwners = await apiClient.fetchOwners();
    const prefix = ApiClient.choosePrefixFrom(someOwners);

    // The grid shows one page, so compare against the API's first page of matches - not the
    // full walk, which a 2-letter prefix can easily push past a single page.
    const expectedFirstPage = await apiClient.fetchOwnersPage({lastName: prefix});
    const expectedFilteredFullNames = ApiClient.getDisplayNames(expectedFirstPage.content);

    // Open the owners page
    const ownersPage = new OwnersPage(page);
    await ownersPage.open();

    // Perform search
    await ownersPage.searchByLastNamePrefix(prefix);
    await ownersPage.waitForOwnersCount(expectedFilteredFullNames.length);

    // Get filtered results
    const actualFilteredFullNames = await ownersPage.getOwnerFullNames();

    // Assertions
    expect(actualFilteredFullNames.length).toBeGreaterThan(0);

    // Verify all results match the prefix
    for (const fullName of actualFilteredFullNames) {
      const lastName = ApiClient.extractLastName(fullName);
      expect(lastName.toLowerCase()).toMatch(new RegExp(`^${prefix.toLowerCase()}`));
    }

    // Verify exact match with the API's first page, in the same (name ascending) order
    expect(actualFilteredFullNames).toEqual(expectedFilteredFullNames);
  });

  test('paginates through owners and can change page size', async ({ page }) => {
    const ownersPage = new OwnersPage(page);
    const allOwnersByName = await apiClient.fetchAllOwners();
    test.skip(allOwnersByName.length <= 10, 'Needs more than one page of owners to test paging');

    await ownersPage.open();

    // Page 1 (default size 10)
    await expect.poll(() => ownersPage.getOwnerFullNames()).toEqual(ApiClient.getDisplayNames(allOwnersByName.slice(0, 10)));
    expect(ownersPage.currentPageIndex()).toBe(0);

    // Next page carries the page index through and shows the next 10 owners
    await ownersPage.goToNextPage();
    await expect.poll(() => ownersPage.currentPageIndex()).toBe(1);
    await expect.poll(() => ownersPage.getOwnerFullNames()).toEqual(
      ApiClient.getDisplayNames(allOwnersByName.slice(10, 20))
    );

    // Changing the page size resets to page 1 (index 0) with the new size
    await ownersPage.choosePageSize(20);
    await expect.poll(() => ownersPage.currentPageIndex()).toBe(0);
    const expectedFirst20 = ApiClient.getDisplayNames(allOwnersByName.slice(0, 20));
    await expect.poll(() => ownersPage.getOwnerFullNames()).toEqual(expectedFirst20);
  });

  test('sorts owners by name and by city', async ({ page }) => {
    const ownersPage = new OwnersPage(page);

    const byNameAsc = await apiClient.fetchOwnersPage({sort: 'name,asc', size: 20});
    const byNameDesc = await apiClient.fetchOwnersPage({sort: 'name,desc', size: 20});
    const byCityAsc = await apiClient.fetchOwnersPage({sort: 'city,asc', size: 20});

    await ownersPage.open();
    await ownersPage.choosePageSize(20);
    await expect.poll(() => ownersPage.getOwnerFullNames()).toEqual(ApiClient.getDisplayNames(byNameAsc.content));

    // Clicking the Name header again reverses the direction
    await ownersPage.sortByName();
    await expect.poll(() => ownersPage.getOwnerFullNames()).toEqual(ApiClient.getDisplayNames(byNameDesc.content));

    // Clicking City sorts by city (ascending, name stays ascending within each city)
    await ownersPage.sortByCity();
    await expect.poll(() => ownersPage.getOwnerFullNames()).toEqual(ApiClient.getDisplayNames(byCityAsc.content));
  });

  test('changing sort or page size from page 3 lands back on page 1', async ({ page }) => {
    const ownersPage = new OwnersPage(page);
    const allOwnersByCity = await apiClient.fetchAllOwners();
    test.skip(allOwnersByCity.length <= 10, 'Needs more than one page of owners to test paging');

    // Start on page 3 (index 2) via a direct deep link - the state lives entirely in the URL.
    await page.goto('/owners?page=2&size=5&sort=name,asc');
    await ownersPage.pageTitle.waitFor({ state: 'visible', timeout: 10000 });
    await expect.poll(() => ownersPage.currentPageIndex()).toBe(2);

    // Changing the sort column resets to page 1
    await ownersPage.sortByCity();
    await expect.poll(() => ownersPage.currentPageIndex()).toBe(0);

    // Go back to page 3, then changing sort direction (clicking the same header again) resets too
    await page.goto('/owners?page=2&size=5&sort=city,asc');
    await ownersPage.pageTitle.waitFor({ state: 'visible', timeout: 10000 });
    await expect.poll(() => ownersPage.currentPageIndex()).toBe(2);
    await ownersPage.sortByCity();
    await expect.poll(() => ownersPage.currentPageIndex()).toBe(0);

    // Go back to page 3, then changing the page size resets too
    await page.goto('/owners?page=2&size=5&sort=name,asc');
    await ownersPage.pageTitle.waitFor({ state: 'visible', timeout: 10000 });
    await expect.poll(() => ownersPage.currentPageIndex()).toBe(2);
    await ownersPage.choosePageSize(20);
    await expect.poll(() => ownersPage.currentPageIndex()).toBe(0);
  });

  test('only Name and City columns expose a sort control', async ({ page }) => {
    const ownersPage = new OwnersPage(page);
    await ownersPage.open();
    await ownersPage.waitForOwnersCount(10);

    await expect(ownersPage.nameSortHeader).toHaveAttribute('role', 'columnheader');
    await expect(ownersPage.nameSortHeader.locator('.mat-sort-header-container')).toBeVisible();
    await expect(ownersPage.citySortHeader.locator('.mat-sort-header-container')).toBeVisible();

    // Address, Telephone and Pets are plain (non-sortable) headers - no sort-header container
    await expect(ownersPage.addressHeader.locator('.mat-sort-header-container')).toHaveCount(0);
    await expect(ownersPage.telephoneHeader.locator('.mat-sort-header-container')).toHaveCount(0);
    await expect(ownersPage.petsHeader.locator('.mat-sort-header-container')).toHaveCount(0);
  });
});
