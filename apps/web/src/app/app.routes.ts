import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: 'orders/new' },
  {
    path: 'orders',
    loadChildren: () =>
      import('@demo/web-ordering-feature').then((m) => m.orderingRoutes),
  },
];
