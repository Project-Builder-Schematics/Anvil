/* eslint-disable @typescript-eslint/no-unused-vars -- pending bindings keep their arguments until the scenarios are implemented */
import { Then, When, type DataTable } from 'quickpickle';

When('the order is requested', () => 'skipped');

Then('the order shown is {string}', (_world, arg0: string) => 'skipped');

Then('the order shown lists no lines', () => 'skipped');

Then('the order shown has the lines', (_world, table: DataTable) => 'skipped');
