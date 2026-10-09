import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: 'orders/new' },
  {
    path: 'orders',
    loadChildren: () =>
      import('@demo/web-ordering-feature').then((m) => m.orderingRoutes),
  },
  {
    path: 'stock/:productId',
    loadComponent: () =>
      import('@demo/web-inventory-feature').then((m) => m.StockPage),
  },
];
