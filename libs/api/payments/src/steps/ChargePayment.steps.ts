/* eslint-disable @typescript-eslint/no-unused-vars -- pending bindings keep their arguments until the scenarios are implemented */
import { Given, Then, When } from 'quickpickle';

When(
  'order {string} is charged {int} {string} with token {string}',
  (_world, arg0: string, arg1: number, arg2: string, arg3: string) => {
    throw new Error(
      'step not implemented: order "o1" is charged 4500 "USD" with token "tok_visa"',
    );
  },
);

Then(
  'the payment of order {string} is {string} for {int} {string}',
  (_world, arg0: string, arg1: string, arg2: number, arg3: string) => {
    throw new Error(
      'step not implemented: the payment of order "o1" is "Captured" for 4500 "USD"',
    );
  },
);

Then('it is refused with {string}', (_world, arg0: string) => {
  throw new Error('step not implemented: it is refused with "INVALID_AMOUNT"');
});

Then('order {string} has no payment', (_world, arg0: string) => {
  throw new Error('step not implemented: order "o1" has no payment');
});

Given(
  'order {string} has been charged {int} {string} with token {string}',
  (_world, arg0: string, arg1: number, arg2: string, arg3: string) => {
    throw new Error(
      'step not implemented: order "o1" has been charged 4500 "USD" with token "tok_visa"',
    );
  },
);

Then('the gateway has been charged {int} in total', (_world, arg0: number) => {
  throw new Error(
    'step not implemented: the gateway has been charged 1 in total',
  );
});

Then(
  'the gateway was asked to charge {int} {string} with token {string}',
  (_world, arg0: number, arg1: string, arg2: string) => {
    throw new Error(
      'step not implemented: the gateway was asked to charge 4500 "USD" with token "tok_visa"',
    );
  },
);

When(
  'order {string} is charged {float} {string} with token {string}',
  (_world, arg0: string, arg1: number, arg2: string, arg3: string) => {
    throw new Error(
      'step not implemented: order "o1" is charged 10.5 "USD" with token "tok_visa"',
    );
  },
);

Given(
  'order {string} has been declined with token {string}',
  (_world, arg0: string, arg1: string) => {
    throw new Error(
      'step not implemented: order "o1" has been declined with token "tok_decline"',
    );
  },
);

Given('order {string} has been refunded', (_world, arg0: string) => {
  throw new Error('step not implemented: order "o1" has been refunded');
});
