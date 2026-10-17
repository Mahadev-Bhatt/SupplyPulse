import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Api } from './api.service';

@Component({
  selector: 'app-root', standalone: true, imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
  @if (api.token()) {
    <header style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;padding:10px 20px;background:var(--sf);border-bottom:1px solid var(--ln)">
      <strong style="font-size:20px">SupplyPulse</strong>
      <span class="mu">{{ api.email() }} · {{ api.role() }}</span>
      <button (click)="api.logout()">Log out</button>
    </header>
    <nav aria-label="Main" style="display:flex;gap:4px;overflow-x:auto;padding:8px 20px;background:var(--sf);border-bottom:1px solid var(--ln)">
      @for (p of pages; track p) {
        @if (api.can(p)) {
          <a [routerLink]="'/' + p" routerLinkActive="on" style="padding:8px 12px;border-radius:6px;color:var(--mu);text-decoration:none;text-transform:capitalize">{{ p }}</a>
        }
      }
    </nav>
  }
  <main style="max-width:1180px;margin:0 auto;padding:20px"><router-outlet /></main>`,
  styles: [`.on{background:var(--ac2);color:var(--ac)!important;font-weight:600}`]
})
export class AppComponent {
  api = inject(Api);
  pages = ['dashboard', 'inventory', 'forecast', 'replenishment', 'shipments', 'suppliers', 'scenarios', 'alerts'];
}
