import {Locator, Page} from '@playwright/test';

/** The "New Visit" form reached from Owner detail → Add Visit (/pets/:id/visits/add). */
export class VisitAddPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly dateInput: Locator;
  readonly descriptionInput: Locator;
  readonly submitButton: Locator;
  readonly dateMinError: Locator;
  readonly dateMaxError: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h2:has-text("New Visit")');
    this.dateInput = page.locator('input[name="date"]');
    this.descriptionInput = page.locator('#description');
    this.submitButton = page.locator('button[type="submit"]');
    this.dateMinError = page.locator('#date-min-error');
    this.dateMaxError = page.locator('#date-max-error');
  }

  async open(petId: number): Promise<void> {
    await this.page.goto(`/pets/${petId}/visits/add`);
    await this.pageTitle.waitFor({state: 'visible', timeout: 10000});
  }

  /** Types a date in the datepicker's own display format (yyyy/MM/dd) and blurs it. */
  async fillForm(date: string, description: string): Promise<void> {
    await this.dateInput.fill(date);
    await this.dateInput.blur();
    await this.descriptionInput.fill(description);
    await this.descriptionInput.blur();
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }
}
