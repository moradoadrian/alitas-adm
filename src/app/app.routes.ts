import { Routes } from '@angular/router';
import { AdminPedidosComponent } from './components/admin-pedidos/admin-pedidos.component';

export const routes: Routes = [
    {path: '', component: AdminPedidosComponent},
    {path: '**', redirectTo:''}
];
