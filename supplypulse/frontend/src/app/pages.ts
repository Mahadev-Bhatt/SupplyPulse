import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Alert, Api, Forecast, Item, Shipment, Suggestion, Supplier, errText } from './api.service';

@Component({
  selector: 'app-dashboard', standalone: true, imports: [RouterLink],
  template: `
  <h2>{{ api.role() }} dashboard</h2>
  <p class="mu">As of {{ asOf() }}.</p>
  @if (error()) { <div class="err" role="alert">{{ error() }}</div> }
  <div class="grid">
    <div class="w"><h3>Stock-out risk</h3><div class="big">{{ risk() }} items</div><a routerLink="/inventory">View list</a></div>
    <div class="w"><h3>Suggested orders</h3><div class="big">{{ pending() }}</div><span class="mu">waiting for approval</span><br><a routerLink="/replenishment">View list</a></div>
    <div class="w"><h3>Late shipments</h3><div class="big">{{ late() }}</div><a routerLink="/shipments">View list</a></div>
    <div class="w"><h3>Open alerts</h3><div class="big">{{ openAlerts() }}</div><a routerLink="/alerts">View list</a></div>
  </div>`
})
export class DashboardComponent implements OnInit {
  api = inject(Api);
  risk = signal(0); pending = signal(0); late = signal(0); openAlerts = signal(0); asOf = signal(''); error = signal('');
  ngOnInit() {
    forkJoin({ i: this.api.get<Item[]>('items?size=100'), r: this.api.get<Suggestion[]>('replenishment'),
      s: this.api.get<Shipment[]>('shipments'), a: this.api.get<Alert[]>('alerts') }).subscribe({
      next: d => {
        this.risk.set(d.i.filter(x => x.status === 'STOCK_OUT_RISK').length);
        this.pending.set(d.r.filter(x => x.status === 'PENDING_APPROVAL').length);
        this.late.set(d.s.filter(x => x.exception).length);
        this.openAlerts.set(d.a.filter(x => !x.closed).length);
        this.asOf.set(new Date().toLocaleTimeString());
      }, error: e => this.error.set(errText(e))
    });
  }
}

@Component({
  selector: 'app-inventory', standalone: true, imports: [FormsModule],
  template: `
  <h2>Inventory visibility</h2>
  <div class="bar"><div><label for="q">Search</label><input id="q" [(ngModel)]="q" (ngModelChange)="load()" placeholder="Item, SKU or location"></div></div>
  @if (error()) { <div class="err" role="alert">{{ error() }}</div> }
  <div class="w scroll"><table><thead><tr><th>SKU</th><th>Item</th><th>Location</th><th>On hand</th><th>Inbound</th><th>Age (d)</th><th>Status</th></tr></thead><tbody>
    @for (i of items(); track i.sku) {
      <tr><td>{{ i.sku }}</td><td>{{ i.name }}</td><td>{{ i.location }}</td><td>{{ i.onHand }}</td><td>{{ i.inbound }}</td><td>{{ i.ageDays }}</td>
      <td><span class="tag" [class.b]="i.status==='STOCK_OUT_RISK'" [class.w2]="i.status==='AGEING'">{{ i.status.replace(/_/g,' ').toLowerCase() }}</span></td></tr>
    } @empty { <tr><td colspan="7">No records found</td></tr> }
  </tbody></table></div>`
})
export class InventoryComponent implements OnInit {
  private api = inject(Api);
  q = ''; items = signal<Item[]>([]); error = signal('');
  ngOnInit() { this.load(); }
  load() { this.api.get<Item[]>('items?size=100&q=' + encodeURIComponent(this.q)).subscribe({ next: r => this.items.set(r), error: e => this.error.set(errText(e)) }); }
}

@Component({
  selector: 'app-forecast', standalone: true, imports: [FormsModule],
  template: `
  <h2>Demand forecast</h2>
  <div class="bar"><div><label for="s">Item</label>
    <select id="s" [ngModel]="sku()" (ngModelChange)="pick($event)">@for (i of items(); track i.sku) { <option [value]="i.sku">{{ i.name }} ({{ i.location }})</option> }</select></div></div>
  @if (error()) { <div class="err" role="alert">{{ error() }}</div> }
  @if (f(); as fc) {
    <div class="w">
      <svg viewBox="0 0 640 220" role="img" [attr.aria-label]="'Demand history and 6 week forecast for ' + sku()" style="width:100%;height:auto">
        <path [attr.d]="path(fc.history, 0, fc)" fill="none" stroke="var(--mu)" stroke-width="2"/>
        <path [attr.d]="path(fc.forecast, 12, fc)" fill="none" stroke="var(--ac)" stroke-width="2.5" stroke-dasharray="6 4"/>
        <text x="30" y="214">12 weeks history</text><text x="400" y="214">6 weeks forecast</text>
      </svg>
      <p class="mu">Error (WAPE) {{ fc.wapePercent }}%. Model: {{ fc.model }}.</p>
      <div class="ai">{{ fc.label }}</div>
    </div>
  }`
})
export class ForecastComponent implements OnInit {
  private api = inject(Api);
  items = signal<Item[]>([]); sku = signal(''); f = signal<Forecast | null>(null); error = signal('');
  ngOnInit() { this.api.get<Item[]>('items?size=100').subscribe({ next: r => { this.items.set(r); if (r.length) this.pick(r[0].sku); }, error: e => this.error.set(errText(e)) }); }
  pick(s: string) { this.sku.set(s); this.api.get<Forecast>(`items/${s}/forecast`).subscribe({ next: r => this.f.set(r), error: e => this.error.set(errText(e)) }); }
  path(a: number[], off: number, fc: Forecast) {
    const mx = Math.max(...fc.history, ...fc.forecast) * 1.3;
    return a.map((v, k) => (k ? 'L' : 'M') + (30 + (k + off) * 610 / 17) + ',' + (196 - v * 176 / mx)).join('');
  }
}

@Component({
  selector: 'app-replenishment', standalone: true,
  template: `
  <h2>Suggested replenishment</h2>
  <p class="mu">Nothing goes to the ERP until a planner approves it.</p>
  @if (error()) { <div class="err" role="alert">{{ error() }}</div> }
  <div class="grid">
    @for (s of rows(); track s.sku) {
      <div class="w"><h3>{{ s.item }}</h3><div class="big">{{ s.quantity }} units</div>
        <div class="mu">Why: {{ s.reasoning }}</div><br>
        @if (s.status === 'APPROVED') { <span class="tag">Approved by {{ s.approvedBy }}</span> }
        @else { <button class="p" [disabled]="!canApprove" (click)="approve(s.sku)">Approve order</button>
                @if (!canApprove) { <span class="tag w2">Planner approval needed</span> } }
      </div>
    } @empty { <div class="w">No records found</div> }
  </div>`
})
export class ReplenishmentComponent implements OnInit {
  private api = inject(Api);
  rows = signal<Suggestion[]>([]); error = signal('');
  get canApprove() { return ['PLANNER', 'ADMIN'].includes(this.api.role()); }
  ngOnInit() { this.load(); }
  load() { this.api.get<Suggestion[]>('replenishment').subscribe({ next: r => this.rows.set(r), error: e => this.error.set(errText(e)) }); }
  approve(sku: string) { this.api.post(`replenishment/${sku}/approve`).subscribe({ next: () => this.load(), error: e => this.error.set(errText(e)) }); }
}

@Component({
  selector: 'app-shipments', standalone: true,
  template: `
  <h2>Shipment tracking</h2>
  <div class="w scroll"><table><thead><tr><th>Shipment</th><th>Supplier</th><th>To</th><th>Status</th><th>Exception</th></tr></thead><tbody>
    @for (s of rows(); track s.id) { <tr><td>{{ s.id }}</td><td>{{ s.supplier }}</td><td>{{ s.to }}</td><td>{{ s.status }}</td><td><span class="tag" [class.b]="s.exception">{{ s.note }}</span></td></tr> }
  </tbody></table></div><div class="ai">Arrival times are estimates, shown as ranges, not promises.</div>`
})
export class ShipmentsComponent implements OnInit {
  private api = inject(Api); rows = signal<Shipment[]>([]);
  ngOnInit() { this.api.get<Shipment[]>('shipments').subscribe(r => this.rows.set(r)); }
}

@Component({
  selector: 'app-suppliers', standalone: true,
  template: `
  <h2>Supplier scorecards</h2>
  <div class="grid">@for (s of rows(); track s.name) {
    <div class="w"><h3>{{ s.name }}</h3><div class="big">{{ s.onTime }}%</div>
    <div class="mu">on-time · quality {{ s.quality }}% · cost trend {{ s.costTrend > 0 ? '+' : '' }}{{ s.costTrend }}%</div></div> }</div>`
})
export class SuppliersComponent implements OnInit {
  private api = inject(Api); rows = signal<Supplier[]>([]);
  ngOnInit() { this.api.get<Supplier[]>('suppliers').subscribe(r => this.rows.set(r)); }
}

@Component({
  selector: 'app-scenarios', standalone: true, imports: [FormsModule],
  template: `
  <h2>What-if scenarios</h2>
  <div class="bar">
    <div><label for="a">Demand spike: +{{ spike }}%</label><input id="a" type="range" min="0" max="80" [(ngModel)]="spike"></div>
    <div><label for="b">Lead time: +{{ lead }} wk</label><input id="b" type="range" min="0" max="4" [(ngModel)]="lead"></div>
    <div><label for="c">Ganga Packaging outage</label><select id="c" [(ngModel)]="outage"><option [ngValue]="false">No</option><option [ngValue]="true">Yes</option></select></div>
  </div>
  <button class="p" (click)="run()">Run scenario</button>
  @if (error()) { <div class="err" role="alert">{{ error() }}</div> }
  @if (res(); as r) {
    <div class="grid" style="margin-top:14px">
      <div class="w"><h3>Baseline at risk</h3><div class="big">{{ r.baselineAtRisk }}</div></div>
      <div class="w"><h3>Scenario at risk</h3><div class="big">{{ r.scenarioAtRisk }}</div><span class="mu">{{ r.scenarioAtRiskSkus.join(', ') }}</span></div>
    </div>
  }`
})
export class ScenariosComponent {
  private api = inject(Api);
  spike = 20; lead = 1; outage = false; res = signal<any>(null); error = signal('');
  run() { this.api.post('scenarios', { demandSpikePct: this.spike, leadTimeWeeksAdded: this.lead, supplierOutage: this.outage })
    .subscribe({ next: r => this.res.set(r), error: e => this.error.set(errText(e)) }); }
}

@Component({
  selector: 'app-alerts', standalone: true,
  template: `
  <h2>Alerts and exceptions</h2>
  @if (error()) { <div class="err" role="alert">{{ error() }}</div> }
  <div class="w scroll"><table><thead><tr><th>ID</th><th>Alert</th><th>Severity</th><th>Owner</th><th>Action</th></tr></thead><tbody>
    @for (a of rows(); track a.id) {
      <tr [style.opacity]="a.closed ? .5 : 1"><td>{{ a.id }}</td><td>{{ a.text }}</td>
      <td><span class="tag" [class.b]="a.severity==='High'" [class.w2]="a.severity!=='High'">{{ a.severity }}</span></td>
      <td>@if (a.owner) { {{ a.owner }} } @else { <button (click)="claim(a.id)">Take ownership</button> }</td>
      <td>@if (a.closed) { Closed } @else { <button (click)="close(a.id)">Close with note</button> }</td></tr>
    }
  </tbody></table></div>`
})
export class AlertsComponent implements OnInit {
  private api = inject(Api);
  rows = signal<Alert[]>([]); error = signal('');
  ngOnInit() { this.load(); }
  load() { this.api.get<Alert[]>('alerts').subscribe({ next: r => this.rows.set(r), error: e => this.error.set(errText(e)) }); }
  claim(id: string) { this.api.post(`alerts/${id}/claim`).subscribe(() => this.load()); }
  close(id: string) { const n = prompt('What action was taken?'); if (n) this.api.post(`alerts/${id}/close`, { action: n }).subscribe({ next: () => this.load(), error: e => this.error.set(errText(e)) }); }
}
