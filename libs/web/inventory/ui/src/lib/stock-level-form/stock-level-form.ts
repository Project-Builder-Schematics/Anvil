import { Component, computed, output, signal } from '@angular/core';
import { form, FormField, FormRoot, validate } from '@angular/forms/signals';
import { isOnHand } from '@anvil/web-inventory-domain';
import { Button } from '@anvil/web-shared-design-system';

@Component({
  imports: [FormField, FormRoot, Button],
  selector: 'inventory-stock-level-form',
  templateUrl: './stock-level-form.html',
  styleUrl: './stock-level-form.css',
})
export class StockLevelForm {
  readonly levelSet = output<number>();

  protected readonly form = form(
    signal({ onHand: 0 }),
    (path) => {
      validate(path.onHand, ({ value }) =>
        isOnHand(value())
          ? undefined
          : {
              kind: 'onHand',
              message: 'Enter a whole number of 0 or more.',
            },
      );
    },
    {
      submission: {
        action: (field) => {
          this.levelSet.emit(field().value().onHand);
          return Promise.resolve();
        },
        onInvalid: (field) => {
          field().errorSummary()[0]?.fieldTree().focusBoundControl();
        },
      },
    },
  );

  protected readonly levelError = computed(() => {
    const field = this.form.onHand();
    return field.touched() ? (field.errors()[0]?.message ?? '') : '';
  });
}
