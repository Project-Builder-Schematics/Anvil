/* eslint-disable @typescript-eslint/no-unused-vars -- pending bindings keep their arguments until the scenarios are implemented */
import { Given, Then, When, type DataTable } from 'quickpickle';

Given(
  'the catalog prices {string} at {int} {string}',
  (_world, arg0: string, arg1: number, arg2: string) => 'skipped',
);

Given('a draft order', () => 'skipped');

When(
  '{int} of {string} is added to the order',
  (_world, arg0: number, arg1: string) => 'skipped',
);

Then('the order lines are', (_world, table: DataTable) => 'skipped');

Then('it is refused with {string}', (_world, arg0: string) => 'skipped');

Given('the order has been placed', () => 'skipped');

Given('the order has been cancelled', () => 'skipped');

Given('an order id that names no order', () => 'skipped');
