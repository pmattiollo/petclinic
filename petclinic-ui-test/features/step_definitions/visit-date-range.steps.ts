import {Given, Then, When} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from '../support/world';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

function shiftedFromToday(amount: number, unit: 'years' | 'months'): string {
  const date = new Date();
  if (unit === 'years') {
    date.setFullYear(date.getFullYear() + amount);
  } else {
    date.setMonth(date.getMonth() + amount);
  }
  return date.toISOString().slice(0, 10);
}

When(
  'I fill in a visit date {int} {word} in the future and a unique description',
  async function (this: PlaywrightWorld, amount: number, unit: string) {
    this.visitDate = shiftedFromToday(amount, unit as 'years' | 'months');
    this.visitDescription = `Range check ${Date.now()}`;
    await this.page.locator('input[name="date"]').fill(this.visitDate);
    await this.page.locator('input#description').fill(this.visitDescription);
  },
);

Then('the visit date is reported as out of range', async function (this: PlaywrightWorld) {
  const dateField = this.page.locator('input[name="date"]');
  await expect(dateField).toHaveClass(/ng-invalid/, {timeout: 5_000});
  await expect(this.page.locator('.help-block', {hasText: 'Date must be between'})).toBeVisible({timeout: 5_000});
});

Then('the visit form cannot be submitted', async function (this: PlaywrightWorld) {
  await expect(this.page.locator('button[type="submit"]:has-text("Add Visit")')).toBeDisabled({timeout: 5_000});
});

Then("the pet's visit list contains the new visit", async function (this: PlaywrightWorld) {
  const row = this.page.locator('app-pet-list').first()
      .locator('app-visit-list tr')
      .filter({hasText: this.visitDescription!});
  await expect(row).toBeVisible({timeout: 10_000});
});

When('I post a visit dated {string} to the API', async function (this: PlaywrightWorld, date: string) {
  this.apiStatus = await postVisit(this.petId!, date);
});

When(
  'I post a visit dated {int} {word} in the future to the API',
  async function (this: PlaywrightWorld, amount: number, unit: string) {
    this.apiStatus = await postVisit(this.petId!, shiftedFromToday(amount, unit as 'years' | 'months'));
  },
);

Then('the API rejects it with status {int}', function (this: PlaywrightWorld, expectedStatus: number) {
  expect(this.apiStatus).toBe(expectedStatus);
});

async function postVisit(petId: number, date: string): Promise<number> {
  const response = await axios.post(
      `${API_BASE}/visits`,
      {petId, date, description: `Range check ${Date.now()}`},
      {timeout: 10_000, validateStatus: () => true},
  );
  return response.status;
}
