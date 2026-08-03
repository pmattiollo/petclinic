import {expect, test} from './support/trace-fixture';
import {ApiClient} from './support/api-client';
import {VisitAddPage} from './pages/VisitAddPage';

/**
 * Regression suite for issue #40: the visit date must sit between the pet's birth
 * date and one year from today. Both the Angular form and the REST API must say no —
 * the API checks are here (not only in the backend unit tests) because the UI is not
 * the only client of /api/visits.
 */

const PET_BIRTH_DATE = '2018-12-24';

/** yyyy/MM/dd — the format the Material datepicker itself renders. */
function slashed(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

function daysFromToday(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function isoDate(date: Date): string {
  return slashed(date).replace(/\//g, '-');
}

test.describe('Visit date range (issue #40)', () => {
  const api = new ApiClient();
  let ownerId: number;
  let petId: number;

  test.beforeAll(async () => {
    ownerId = await api.createOwner({
      firstName: 'DateRange',
      lastName: `Tester${Date.now()}`,
      address: '1 Test Street',
      city: 'Testville',
      telephone: '0700000000',
    });
    petId = await api.addPet(ownerId, {
      name: `RangePet${Date.now()}`,
      birthDate: PET_BIRTH_DATE,
      typeId: await api.firstPetTypeId(),
    });
  });

  test.afterAll(async () => {
    const pet = await api.fetchPet(petId);
    for (const visit of pet.visits ?? []) {
      await api.deleteVisit(visit.id);
    }
    await api.deleteOwner(ownerId);
  });

  test('form rejects a date before the pet was born', async ({page}) => {
    const visitAddPage = new VisitAddPage(page);
    await visitAddPage.open(petId);

    await visitAddPage.fillForm('0009/07/20', 'absurdly old date');

    await expect(visitAddPage.dateMinError).toBeVisible();
    await expect(visitAddPage.submitButton).toBeDisabled();
  });

  test('form rejects a date more than a year ahead', async ({page}) => {
    const visitAddPage = new VisitAddPage(page);
    await visitAddPage.open(petId);

    await visitAddPage.fillForm(slashed(daysFromToday(400)), 'too far in the future');

    await expect(visitAddPage.dateMaxError).toBeVisible();
    await expect(visitAddPage.submitButton).toBeDisabled();
  });

  test('form still accepts a date inside the allowed range', async ({page}) => {
    const visitAddPage = new VisitAddPage(page);
    await visitAddPage.open(petId);

    await visitAddPage.fillForm(slashed(daysFromToday(7)), 'routine check-up');

    await expect(visitAddPage.dateMinError).toBeHidden();
    await expect(visitAddPage.dateMaxError).toBeHidden();
    await expect(visitAddPage.submitButton).toBeEnabled();

    await visitAddPage.submit();
    await expect(page).toHaveURL(new RegExp(`/owners/${ownerId}$`));
  });

  test('API rejects a date before the pet was born', async () => {
    const result = await api.postVisit({
      petId,
      date: '0009-07-20',
      description: 'absurdly old date',
    });

    expect(result.status).toBe(400);
  });

  test('API rejects a date more than a year ahead', async () => {
    const result = await api.postVisit({
      petId,
      date: isoDate(daysFromToday(400)),
      description: 'too far in the future',
    });

    expect(result.status).toBe(400);
  });

  test('API rejects an out-of-range date on the owner-scoped endpoint', async () => {
    const result = await api.postVisitForOwnersPet(ownerId, petId, {
      date: '0009-07-20',
      description: 'absurdly old date',
    });

    expect(result.status).toBe(400);
  });

  test('API rejects an out-of-range date when updating a visit', async () => {
    const created = await api.postVisit({
      petId,
      date: isoDate(daysFromToday(3)),
      description: 'to be edited',
    });
    expect(created.status).toBe(201);
    const visitId = Number(created.location!.split('/').pop());

    const result = await api.putVisit(visitId, {
      date: '0009-07-20',
      description: 'to be edited',
    });

    expect(result.status).toBe(400);
  });
});
