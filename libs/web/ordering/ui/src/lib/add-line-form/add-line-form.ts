import { Component, computed, input, output, signal } from '@angular/core';
import {
  disabled,
  form,
  FormField,
  FormRoot,
  validate,
} from '@angular/forms/signals';
import { isQuantity, type AddLine } from '@demo/web-ordering-domain';
import { Button } from '@demo/web-shared-design-system';

const firstMessage = (field: {
  touched(): boolean;
  errors(): readonly { message?: string }[];
}): string => (field.touched() ? (field.errors()[0]?.message ?? '') : '');

@Component({
  imports: [FormField, FormRoot, Button],
  selector: 'ordering-add-line-form',
  templateUrl: './add-line-form.html',
  styleUrl: './add-line-form.css',
})
export class AddLineForm {
  readonly disabled = input.required<boolean>();
  readonly lineAdded = output<AddLine>();

  protected readonly form = form(
    signal({ productId: '', quantity: 1 }),
    (path) => {
      validate(path.productId, ({ value }) =>
        value().trim()
          ? undefined
          : { kind: 'required', message: 'Enter a product id.' },
      );
      validate(path.quantity, ({ value }) =>
        isQuantity(value())
          ? undefined
          : { kind: 'quantity', message: 'Enter a whole number from 1 to 99.' },
      );
      disabled(path.productId, { when: () => this.disabled() });
      disabled(path.quantity, { when: () => this.disabled() });
    },
    {
      submission: {
        action: (field) => {
          const { productId, quantity } = field().value();
          this.lineAdded.emit({ productId: productId.trim(), quantity });
          return Promise.resolve();
        },
        onInvalid: (field) => {
          field().errorSummary()[0]?.fieldTree().focusBoundControl();
        },
      },
    },
  );

  protected readonly productError = computed(() =>
    firstMessage(this.form.productId()),
  );
  protected readonly quantityError = computed(() =>
    firstMessage(this.form.quantity()),
  );
}
