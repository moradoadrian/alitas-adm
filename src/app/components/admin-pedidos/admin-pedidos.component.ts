import { Component, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PedidoAdminService, Pedido } from '../../services/pedido-admin.service';
import { Auth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from '@angular/fire/auth';
import { Subscription } from 'rxjs';

type Dir = 'asc'|'desc';
type SortKey = 'fecha'|'total'|'status';

@Component({
  selector: 'app-admin-pedidos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-pedidos.component.html',
})
export class AdminPedidosComponent {
  private srv = inject(PedidoAdminService);
  private auth = inject(Auth);
  sub?: Subscription;

  user = signal<User | null>(null);
  filtroStatus = signal<Pedido['status'] | undefined>(undefined);
  pedidos = signal<Pedido[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  // UI state
  q = '';
  sortBy: SortKey = 'fecha';
  sortDir: Dir = 'desc';
  page = 1;
  pageSize = 20;
  toast = signal<string | null>(null);

  // Chips
  statusChips = [
    { val: 'nuevo' as Pedido['status'], label: 'Nuevo' },
    { val: 'confirmado' as Pedido['status'], label: 'Confirmado' },
    { val: 'preparando' as Pedido['status'], label: 'Preparando' },
    { val: 'listo' as Pedido['status'], label: 'Listo' },
    { val: 'entregado' as Pedido['status'], label: 'Entregado' },
    { val: 'cancelado' as Pedido['status'], label: 'Cancelado' },
  ];

  private subscribePedidos(status?: Pedido['status']) {
    this.sub?.unsubscribe();
    this.cargando.set(true);
    this.sub = this.srv.listar$(status).subscribe({
      next: rows => { this.pedidos.set(rows); this.cargando.set(false); },
      error: e => { console.error(e); this.error.set('No se pudieron cargar los pedidos'); this.cargando.set(false); }
    });
  }

  constructor() {
    onAuthStateChanged(this.auth, async u => {
      this.user.set(u);
      if (u) {
        console.log('AUTH -> email:', u.email, 'uid:', u.uid);
        await this.srv.debugPing();
        this.subscribePedidos(this.filtroStatus()); // primera carga
      } else {
        this.sub?.unsubscribe();
        this.pedidos.set([]); this.cargando.set(false);
      }
    });

    // Re-suscribir cuando cambia el filtro de status (servidor)
    effect(() => {
      if (!this.user()) return;
      const f = this.filtroStatus();
      this.page = 1; // reset de paginación al cambiar filtro
      this.subscribePedidos(f);
    });
  }

  loginGoogle() { signInWithPopup(this.auth, new GoogleAuthProvider()); }
  logout() { signOut(this.auth); }

  // ==== Helpers de UI ====

  // Conteos por status (sobre el conjunto actual)
  counts = computed(() => {
    const acc: Record<string, number> = {};
    for (const p of this.pedidos()) {
      const k = (p.status ?? 'nuevo').toLowerCase();
      acc[k] = (acc[k] || 0) + 1;
    }
    return acc as Record<NonNullable<Pedido['status']>, number> & Record<string, number>;
  });

  // Filtrado + búsqueda + ordenamiento (cliente)
  visiblePedidos = computed(() => {
    const term = this.q.trim().toLowerCase();
    const arr = this.pedidos().filter(p => {
      if (!term) return true;
      const hay = [
        p.id?.toLowerCase() ?? '',
        p.nombre?.toLowerCase() ?? '',
        p.nota?.toLowerCase() ?? '',
      ];
      return hay.some(x => x.includes(term));
    });

    // Orden
    const dir = this.sortDir === 'asc' ? 1 : -1;
    const key = this.sortBy;
    arr.sort((a, b) => {
      let va: any, vb: any;
      if (key === 'total') { va = a.total ?? 0; vb = b.total ?? 0; }
      else if (key === 'status') { va = (a.status ?? 'nuevo'); vb = (b.status ?? 'nuevo'); }
      else { va = a.fecha ?? ''; vb = b.fecha ?? ''; } // fecha string
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });

    return arr;
  });

  // Paginación sobre visiblePedidos
  pagedPedidos() {
    const start = (this.page - 1) * this.pageSize;
    return this.visiblePedidos().slice(start, start + this.pageSize);
  }
  totalPages() { return Math.max(1, Math.ceil(this.visiblePedidos().length / this.pageSize)); }
  nextPage() { if (this.page < this.totalPages()) this.page++; }
  prevPage() { if (this.page > 1) this.page--; }
  startIndex() { return Math.min((this.page - 1) * this.pageSize, Math.max(this.visiblePedidos().length - 1, 0)); }
  endIndex() { return Math.min(this.startIndex() + this.pageSize, this.visiblePedidos().length); }
  toggleDir() { this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc'; }
  quickFilter(val: Pedido['status'] | undefined) { this.filtroStatus.set(val); }

  async setStatus(p: Pedido, status: Pedido['status']) {
    if (!p.idDoc) return;
    await this.srv.actualizarStatus(p.idDoc, status);
    this.flash(`Pedido ${p.id}: status → ${status}`);
  }

  // Avanzar status en un clic
  advance(p: Pedido) {
    const next = this.nextStatus(p.status);
    if (!next) return;
    this.setStatus(p, next);
  }

  nextStatus(s?: Pedido['status']): Pedido['status'] | null {
    const order: Pedido['status'][] = ['nuevo','confirmado','preparando','listo','entregado'];
    if (s === 'cancelado') return null;
    const i = Math.max(0, order.indexOf(s ?? 'nuevo'));
    return order[i + 1] ?? null;
  }

  onCancel(p: Pedido) {
    if (!p.idDoc) return;
    const ok = confirm(`¿Cancelar el pedido ${p.id}?`);
    if (!ok) return;
    this.setStatus(p, 'cancelado');
  }

  statusClass(s?: string): string {
    const k = (s ?? 'nuevo').toLowerCase();
    const map: Record<string, string> = {
      nuevo:       'bg-sky-50 text-sky-700 ring-sky-200',
      confirmado:  'bg-amber-50 text-amber-800 ring-amber-200',
      preparando:  'bg-indigo-50 text-indigo-700 ring-indigo-200',
      listo:       'bg-emerald-50 text-emerald-700 ring-emerald-200',
      entregado:   'bg-slate-100 text-slate-700 ring-slate-200',
      cancelado:   'bg-rose-50 text-rose-700 ring-rose-200',
    };
    return map[k] ?? 'bg-slate-100 text-slate-700 ring-slate-200';
  }

  statusProgress(s?: string): number {
    const order = ['nuevo','confirmado','preparando','listo','entregado'];
    const k = (s ?? 'nuevo').toLowerCase();
    if (k === 'cancelado') return 100;
    const i = Math.max(0, order.indexOf(k));
    return (i / (order.length - 1)) * 100;
  }

  private flash(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(null), 1800);
  }
}
