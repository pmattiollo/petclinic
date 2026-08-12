# Visit Date Validation Design

## Scope

Reject visit dates before the pet's birth date or more than one year after the
current date. Both boundaries are inclusive.

## Design

The backend will resolve the visit's pet before saving a new or edited visit
and apply the same date-range rule in one shared validation method. Invalid
requests return the application's standard validation error response, so API
clients cannot bypass the rule.

The New Visit form will validate against the loaded pet's birth date and
today plus one year. An out-of-range value keeps submission unavailable and
shows the form's existing validation feedback.

## Testing

Browser E2E coverage will reproduce the reported pre-birth date and assert
that the New Visit form does not allow submission. Backend tests will cover
pre-birth and more-than-one-year-future API requests, plus valid boundary
dates. Existing component tests will cover frontend validators where needed.
