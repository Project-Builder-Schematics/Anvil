/* eslint-disable @typescript-eslint/no-unused-vars -- pending bindings keep their arguments until the scenarios are implemented */
import { Then, When } from 'quickpickle';

When('the stock of {string} is requested', (_world, arg0: string) => {
  throw new Error('step not implemented: the stock of "keyboard" is requested');
});

Then(
  'the stock shown is {int} on hand and {int} reserved',
  (_world, arg0: number, arg1: number) => {
    throw new Error(
      'step not implemented: the stock shown is 10 on hand and 4 reserved',
    );
  },
);
