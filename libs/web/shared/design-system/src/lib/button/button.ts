import { Component, input } from '@angular/core';

@Component({
  selector: 'ds-button',
  templateUrl: './button.html',
  styleUrl: './button.css',
})
export class Button {
  readonly type = input<'button' | 'submit'>('button');
  readonly disabled = input(false);
}
