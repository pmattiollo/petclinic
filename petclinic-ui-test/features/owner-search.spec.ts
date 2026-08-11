import {test} from './dsl/trace-fixture';
import {GENERATE_SEQUENCE_TAG} from '../src/trace-diagram/sequence-tag';
import {
  expectOnlyOwnersWhoseLastNameStartsWithThatPart,
  openOwnersPage,
  pickLastNamePartOfAnExistingOwner,
  searchOwnersByLastNamePart,
} from './dsl/owner-search.dsl';

// The plain-TypeScript twin of owner-search.feature, driving the very same glue
// functions its step_definitions call. This is the scenario whose
// @generate_sequence tag now lives *only* here: the .feature still runs, but
// the sequence diagram is produced from this side.

test.describe('Search owners by last name', () => {

  test('Filter owners by a last name part', {tag: GENERATE_SEQUENCE_TAG}, async ({page}) => {
    const search = await pickLastNamePartOfAnExistingOwner();

    await openOwnersPage(page);
    await searchOwnersByLastNamePart(page, search);

    await expectOnlyOwnersWhoseLastNameStartsWithThatPart(page, search);
  });
});
