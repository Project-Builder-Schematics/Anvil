import type { Routes } from '@angular/router';
import { OrderNew } from './order-new/order-new';
import { OrderPage } from './order-page/order-page';

/** Mounted under `orders` by the app. `new` comes first so it is never read as an order id. */
export const orderingRoutes: Routes = [
  { path: 'new', component: OrderNew },
  { path: ':orderId', component: OrderPage },
];
