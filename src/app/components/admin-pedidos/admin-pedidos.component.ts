// admin-pedidos.component.ts
import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PedidoAdminService, Pedido } from '../../services/pedido-admin.service';
import { Auth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from '@angular/fire/auth';
import { Subscription } from 'rxjs';



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
    effect(() => {
      if (!this.user()) return;
      const f = this.filtroStatus();
      this.subscribePedidos(f);
    });
    
  }


  loginGoogle() { signInWithPopup(this.auth, new GoogleAuthProvider()); }
  logout() { signOut(this.auth); }

  async setStatus(p: Pedido, status: Pedido['status']) {
    if (!p.idDoc) return;
    await this.srv.actualizarStatus(p.idDoc, status);
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
  
}
