/* eslint-disable @typescript-eslint/no-unused-vars -- pending bindings keep their arguments until the scenarios are implemented */
import { Given, Then, When, type DataTable } from 'quickpickle';

Given(
  'the stock level of {string} is set to {int}',
  (_world, arg0: string, arg1: number) => {
    throw new Error(
      'step not implemented: the stock level of "keyboard" is set to 10',
    );
  },
);

When(
  'the lines of order {string} are reserved',
  (_world, arg0: string, table: DataTable) => {
    throw new Error(
      'step not implemented: the lines of order "o1" are reserved',
    );
  },
);

Then(
  'the stock of {string} is {int} on hand and {int} reserved',
  (_world, arg0: string, arg1: number, arg2: number) => {
    throw new Error(
      'step not implemented: the stock of "keyboard" is 10 on hand and 4 reserved',
    );
  },
);

Then('it is refused with {string}', (_world, arg0: string) => {
  throw new Error(
    'step not implemented: it is refused with "INSUFFICIENT_STOCK"',
  );
});

Then('the reservation lists', (_world, table: DataTable) => {
  throw new Error('step not implemented: the reservation lists');
});

Given(
  'the reservation of order {string} is committed',
  (_world, arg0: string) => {
    throw new Error(
      'step not implemented: the reservation of order "o1" is committed',
    );
  },
);

Given(
  'the reservation of order {string} is released',
  (_world, arg0: string) => {
    throw new Error(
      'step not implemented: the reservation of order "o1" is released',
    );
  },
);
