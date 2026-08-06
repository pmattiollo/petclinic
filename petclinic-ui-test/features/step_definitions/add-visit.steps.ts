import {Given, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import axios from 'axios';
import {PlaywrightWorld} from '../support/world';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

function shiftDate(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function fillVisitForm(world: PlaywrightWorld, date: string, descriptionPrefix: string) {
  world.visitDescription = `${descriptionPrefix} ${Date.now()}`;
  await world.page.locator('input[name="date"]').fill(date);
  await world.page.locator('input#description').fill(world.visitDescription);
}

Given('an owner with at least one pet exists', async function (this: PlaywrightWorld) {
  const {data: owners} = await axios.get(`${API_BASE}/owners`, {timeout: 10_000});
  const ownerWithPet = owners.find((o: any) => Array.isArray(o.pets) && o.pets.length > 0);
  if (!ownerWithPet) {
    throw new Error('No owner with a pet found in the system; cannot run add-visit scenario');
  }
  this.ownerId = ownerWithPet.id;
  this.petId = ownerWithPet.pets[0].id;
  this.petBirthDate = ownerWithPet.pets[0].birthDate;
});

When("I open that owner's detail page", async function (this: PlaywrightWorld) {
  await this.page.goto(`/owners/${this.ownerId}`);
  await this.page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
});

When('I click {string} for the first pet', async function (this: PlaywrightWorld, buttonLabel: string) {
  await this.page.locator('app-pet-list').first().locator(`button:has-text("${buttonLabel}")`).click();
  await this.page.locator('h2:has-text("New Visit")').waitFor({state: 'visible', timeout: 10_000});
});

When(
  'I fill in the visit date {string} and a unique description',
  async function (this: PlaywrightWorld, date: string) {
    await fillVisitForm(this, date, 'Annual check-up');
  },
);

When(
  'I fill in a visit date before the pet birth date and a unique description',
  async function (this: PlaywrightWorld) {
    if (!this.petBirthDate) {
      throw new Error('Expected pet birth date to be available from Given step');
    }
    const invalidDate = shiftDate(this.petBirthDate, -1);
    await fillVisitForm(this, invalidDate, 'Invalid-date-before-birth');
  },
);

When(
  'I fill in a visit date more than one year in the future and a unique description',
  async function (this: PlaywrightWorld) {
    const tomorrowPlusOneYear = new Date();
    tomorrowPlusOneYear.setDate(tomorrowPlusOneYear.getDate() + 366);
    const invalidFutureDate = tomorrowPlusOneYear.toISOString().slice(0, 10);
    await fillVisitForm(this, invalidFutureDate, 'Invalid-date-far-future');
  },
);

When('I submit the visit form', async function (this: PlaywrightWorld) {
  await this.page.locator('button[type="submit"]:has-text("Add Visit")').click();
});

Then("I am back on the owner's detail page", async function (this: PlaywrightWorld) {
  await this.page.waitForURL(new RegExp(`/owners/${this.ownerId}$`), {timeout: 10_000});
  await this.page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
});

Then(
  "the pet's visit list contains the new visit dated {string}",
  async function (this: PlaywrightWorld, date: string) {
    if (!this.visitDescription) {
      throw new Error('Expected a unique description to have been generated earlier in the scenario');
    }
    const petBlock = this.page.locator('app-pet-list').first();
    const row = petBlock.locator('app-visit-list tr').filter({hasText: date}).filter({hasText: this.visitDescription});
    await expect(row).toBeVisible({timeout: 10_000});
  },
);

Then('the {string} button is disabled', async function (this: PlaywrightWorld, buttonLabel: string) {
  await expect(this.page.getByRole('button', {name: buttonLabel})).toBeDisabled();
});

Then('I stay on the visit form page', async function (this: PlaywrightWorld) {
  await expect(this.page).toHaveURL(/\/pets\/\d+\/visits\/add$/);
  await expect(this.page.locator('h2:has-text("New Visit")')).toBeVisible();
});
