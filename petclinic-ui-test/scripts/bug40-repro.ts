import {chromium, Page} from '@playwright/test';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';
const BASE_URL = process.env.BASE_URL || 'http://localhost:4200';
const ABSURD_DATE = '0009-07-20';
const label = process.env.VIDEO_LABEL || 'before';
const videoDir = path.join(__dirname, '..', 'test-results', 'bug40-videos', label);

function oneMonthFromNow(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

async function openNewVisitForm(page: Page, ownerId: number) {
  await page.goto(`/owners/${ownerId}`);
  await page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
  await page.waitForTimeout(1000);
  await page.locator('app-pet-list').first().locator('button:has-text("Add Visit")').click();
  await page.locator('h2:has-text("New Visit")').waitFor({state: 'visible', timeout: 10_000});
  await page.waitForTimeout(1000);
}

async function fillVisit(page: Page, date: string, description: string) {
  await page.locator('input[name="date"]').fill(date);
  await page.locator('input#description').fill(description);
  await page.waitForTimeout(1500);
}

async function main() {
  fs.rmSync(videoDir, {recursive: true, force: true});

  const {data: owners} = await axios.get(`${API_BASE}/owners`, {timeout: 10_000});
  const owner = owners.find((o: any) => Array.isArray(o.pets) && o.pets.length > 0);
  if (!owner) throw new Error('No owner with a pet found');

  const browser = await chromium.launch({headless: false, slowMo: 250});
  const context = await browser.newContext({
    baseURL: BASE_URL,
    recordVideo: {dir: videoDir, size: {width: 1280, height: 720}},
    viewport: {width: 1280, height: 720},
  });
  const page = await context.newPage();

  await openNewVisitForm(page, owner.id);

  const absurdDescription = `BUG-40 absurd date ${Date.now()}`;
  await fillVisit(page, ABSURD_DATE, absurdDescription);

  const submit = page.locator('button[type="submit"]:has-text("Add Visit")');
  const submitBlocked = await submit.isDisabled();
  if (!submitBlocked) {
    await submit.click();
    await page.waitForTimeout(3000);
  }
  await page.waitForTimeout(2500);

  const savedAbsurdVisit = new RegExp(`/owners/${owner.id}$`).test(page.url())
      && await page.locator('app-pet-list').first()
          .locator('app-visit-list tr').filter({hasText: absurdDescription}).count() > 0;

  console.log(savedAbsurdVisit
      ? `BUG REPRODUCED: visit dated ${ABSURD_DATE} was accepted and saved`
      : `FIXED: visit dated ${ABSURD_DATE} rejected by the form (submit disabled=${submitBlocked})`);

  if (!savedAbsurdVisit) {
    const validDate = oneMonthFromNow();
    const validDescription = `Regular check-up ${Date.now()}`;
    await fillVisit(page, validDate, validDescription);
    await submit.click();
    await page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
    const saved = await page.locator('app-pet-list').first()
        .locator('app-visit-list tr').filter({hasText: validDescription}).count() > 0;
    console.log(`In-range visit dated ${validDate} accepted: ${saved}`);
    await page.waitForTimeout(2500);
  }

  await context.close();
  await browser.close();

  const video = fs.readdirSync(videoDir).find(f => f.endsWith('.webm'));
  console.log(`video: ${path.join(videoDir, video!)}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
