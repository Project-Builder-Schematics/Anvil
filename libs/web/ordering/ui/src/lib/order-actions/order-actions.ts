import { Component, computed, input, output, signal } from '@angular/core';
import {
  disabled,
  form,
  FormField,
  FormRoot,
  validate,
} from '@angular/forms/signals';
import { Button, DsVariant } from '@anvil/web-shared-design-system';

@Component({
  imports: [FormField, FormRoot, Button, DsVariant],
  selector: 'ordering-order-actions',
  templateUrl: './order-actions.html',
  styleUrl: './order-actions.css',
})
export class OrderActions {
  readonly canPlace = input.required<boolean>();
  readonly canCancel = input.required<boolean>();
  readonly busy = input.required<boolean>();
  readonly placeOrder = output<string>();
  readonly cancelOrder = output();

  protected readonly form = form(
    signal({ paymentMethodToken: '' }),
    (path) => {
      validate(path.paymentMethodToken, ({ value }) =>
        value().trim()
          ? undefined
          : { kind: 'required', message: 'Enter a payment token.' },
      );
      disabled(path.paymentMethodToken, { when: () => !this.canPlace() });
    },
    {
      submission: {
        action: (field) => {
          this.placeOrder.emit(field().value().paymentMethodToken.trim());
          return Promise.resolve();
        },
        onInvalid: (field) => {
          field().errorSummary()[0]?.fieldTree().focusBoundControl();
        },
      },
    },
  );

  protected readonly tokenError = computed(() => {
    const token = this.form.paymentMethodToken();
    return token.touched() ? (token.errors()[0]?.message ?? '') : '';
  });
}
