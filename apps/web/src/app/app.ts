import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Button, DsVariant } from '@demo/web-shared-design-system';

@Component({
  imports: [RouterOutlet, Button, DsVariant],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected title = 'web';
}
