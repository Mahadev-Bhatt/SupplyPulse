import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, tap, throwError } from 'rxjs';

export interface Item { sku: string; name: string; location: string; onHand: number; inbound: number; ageDays: number; status: string; }
export interface Forecast { sku: string; history: number[]; forecast: number[]; wapePercent: number; model: string; label: string; }
export interface Suggestion { sku: string; item: string; quantity: number; reasoning: string; status: string; approvedBy?: string; }
export interface Shipment { id: string; supplier: string; to: string; status: string; exception: boolean; note: string; }
export interface Supplier { name: string; onTime: number; quality: number; costTrend: number; }
export interface Alert { id: string; text: string; severity: string; owner?: string; action?: string; closed: boolean; }

export function errText(e: any): string {
  const b = e?.error;
  return b?.message ? `${b.message} (trace ${b.traceId})` : 'Could not reach the server.';
}

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  private router = inject(Router);
  // Token is kept in memory only: a page refresh signs the user out.
  token = signal<string | null>(null);
  role = signal('');
  email = signal('');

  login(email: string, password: string, otp: string) {
    return this.http.post<{ token: string; role: string }>('/api/auth/login', { email, password, otp })
      .pipe(tap(r => { this.token.set(r.token); this.role.set(r.role); this.email.set(email); }));
  }
  logout() { this.http.post('/api/auth/logout', {}).subscribe({ complete: () => this.clear(), error: () => this.clear() }); }
  clear() { this.token.set(null); this.role.set(''); this.router.navigateByUrl('/login'); }
  get<T>(path: string) { return this.http.get<T>('/api/' + path); }
  post<T>(path: string, body: unknown = {}) { return this.http.post<T>('/api/' + path, body); }
  can(path: string): boolean {
    const r = this.role();
    if (r === 'EXECUTIVE') return ['dashboard', 'suppliers', 'shipments', 'alerts'].includes(path);
    if (r === 'STEWARD') return ['dashboard', 'inventory', 'alerts'].includes(path);
    if (r === 'BUYER') return path !== 'scenarios';
    return true;
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const api = inject(Api);
  const t = api.token();
  const r = t ? req.clone({ setHeaders: { Authorization: 'Bearer ' + t } }) : req;
  return next(r).pipe(catchError(e => {
    if (e.status === 401 && !req.url.endsWith('/auth/login')) api.clear();
    return throwError(() => e);
  }));
};
