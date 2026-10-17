import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api, errText } from './api.service';

@Component({
  selector: 'app-login', standalone: true, imports: [FormsModule],
  template: `
  <div style="max-width:400px;margin:6vh auto">
    <h1 style="font-size:34px;margin:0">SupplyPulse</h1>
    <p class="mu">Inventory, orders and shipments in one view. Sign-in is by invitation and needs a second factor.</p>
    <label for="e">Work email</label><input id="e" type="email" [(ngModel)]="email" autocomplete="username">
    <label for="p">Password</label><input id="p" type="password" [(ngModel)]="password" autocomplete="current-password">
    <label for="o">6-digit code</label><input id="o" inputmode="numeric" maxlength="6" [(ngModel)]="otp">
    @if (error()) { <div class="err" role="alert">{{ error() }}</div> }
    <button class="p" style="width:100%;margin-top:14px" [disabled]="busy()" (click)="go()">Sign in</button>
    <p class="mu">Demo: planner@, buyer@, wh@, exec@, steward@, admin@ acme.test. Password 8+ characters, any 6-digit code.</p>
  </div>`
})
export class LoginComponent {
  private api = inject(Api); private router = inject(Router);
  email = 'planner@acme.test'; password = 'Sup-ply-Pulse-26'; otp = '123456';
  error = signal(''); busy = signal(false);
  go() {
    this.busy.set(true); this.error.set('');
    this.api.login(this.email, this.password, this.otp).subscribe({
      next: () => this.router.navigateByUrl('/dashboard'),
      error: e => { this.error.set(errText(e)); this.busy.set(false); }
    });
  }
}
