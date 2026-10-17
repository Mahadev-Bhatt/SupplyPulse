import { ApplicationConfig } from '@angular/core';
import { provideRouter, CanActivateFn, Router } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { inject } from '@angular/core';
import { Api, authInterceptor } from './api.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideHttpClient(withInterceptors([authInterceptor]))]
};

export const guard: CanActivateFn = route => {
  const api = inject(Api), router = inject(Router);
  if (!api.token()) return router.parseUrl('/login');
  const p = route.routeConfig?.path ?? '';
  return api.can(p) ? true : router.parseUrl('/dashboard');
};
