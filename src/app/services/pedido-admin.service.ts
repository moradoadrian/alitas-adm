// src/app/services/pedido-admin.service.ts
import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore, collection, query, where, limit, getDocs
} from '@angular/fire/firestore';

// Usa los tipos “puros” de Firestore para que infiera bien
import type {
  CollectionReference, DocumentData, Query, QuerySnapshot
} from 'firebase/firestore';

import { Observable, timer, switchMap, map, from } from 'rxjs';

export type Pedido = {
  idDoc?: string;
  id: string;
  fecha: string;
  listoA?: string;
  total: number;
  subtotal: number;
  envio: number;
  qty: number;
  nombre?: string;
  metodo: 'pickup' | 'delivery';
  direccion?: string;
  nota?: string;
  status?: 'nuevo'|'confirmado'|'preparando'|'listo'|'entregado'|'cancelado';
  createdAt?: any;
  trackId?: string;
};

@Injectable({ providedIn: 'root' })
export class PedidoAdminService {
  private fs = inject(Firestore);
  private injector = inject(Injector);

  // 👇 se había perdido
  private col(): CollectionReference<DocumentData> {
    return collection(this.fs, 'pedidos') as CollectionReference<DocumentData>;
  }

  listar$(status?: Pedido['status'], pageSize = 25): Observable<Pedido[]> {
    const base = this.col();
    const q: Query<DocumentData> = status
      ? query(base, where('status', '==', status), limit(pageSize))
      : query(base, limit(pageSize));

    return timer(0, 5000).pipe(
      switchMap(() =>
        // ✅ función, no método: corre getDocs dentro del contexto de inyección
        from(
          runInInjectionContext(this.injector, () => getDocs(q)) as
          Promise<QuerySnapshot<DocumentData>>
        )
      ),
      map((snap: QuerySnapshot<DocumentData>) =>
        snap.docs.map(d => ({ idDoc: d.id, ...(d.data() as any) })) as Pedido[]
      )
    );
  }

  // Ping de diagnóstico
  async debugPing(): Promise<void> {
    try {
      const snap = await runInInjectionContext(
        this.injector,
        () => getDocs(query(this.col(), limit(1)))
      ) as QuerySnapshot<DocumentData>;
      console.log('Ping OK. Docs en pedidos:', snap.size);
      if (snap.size) console.log('Ejemplo doc:', snap.docs[0].id, snap.docs[0].data());
    } catch (e: any) {
      console.error('Ping FAIL:', e.code ?? e.name, e.message ?? e);
    }
  }

  async actualizarStatus(idDoc: string, status: Pedido['status']) {
    const { doc, getDoc, updateDoc, setDoc, serverTimestamp } = await import('@angular/fire/firestore');
  
    // 1) Actualiza /pedidos/{idDoc}
    const pedidoRef = doc(this.fs, 'pedidos', idDoc);
    await runInInjectionContext(this.injector, () =>
      updateDoc(pedidoRef, { status, updatedAt: serverTimestamp() })
    );
  
    // 2) Lee el pedido para obtener trackId y demás campos mínimos
    const snap = await runInInjectionContext(this.injector, () => getDoc(pedidoRef));
    const p = snap.data() as Pedido | undefined;
    const trackId = p?.trackId;
  
    if (!trackId) {
      console.warn('[admin] Pedido sin trackId; no se puede reflejar en /seguimiento');
      return;
    }
  
    // 3) Refleja en /seguimiento/{trackId}
    const segRef = doc(this.fs, 'seguimiento', trackId);
    const segSnap = await runInInjectionContext(this.injector, () => getDoc(segRef));
  
    if (segSnap.exists()) {
      // Solo update si ya existe (más barato)
      await runInInjectionContext(this.injector, () =>
        updateDoc(segRef, { status, updatedAt: serverTimestamp() })
      );
    } else {
      // Si no existe, créalo con los campos mínimos que tus reglas aceptan
      await runInInjectionContext(this.injector, () =>
        setDoc(segRef, {
          pedidoDocId: idDoc,
          idFolio: p?.id ?? '',      // folio legible
          status,
          qty: p?.qty ?? 0,
          total: p?.total ?? 0,
          metodo: p?.metodo ?? 'pickup',
          listoA: p?.listoA ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true })
      );
    }
  }
  
}
