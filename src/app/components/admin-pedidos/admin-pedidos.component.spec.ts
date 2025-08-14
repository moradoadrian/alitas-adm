import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminPedidosComponent } from './admin-pedidos.component';

describe('AdminPedidosComponent', () => {
  let component: AdminPedidosComponent;
  let fixture: ComponentFixture<AdminPedidosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPedidosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminPedidosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
