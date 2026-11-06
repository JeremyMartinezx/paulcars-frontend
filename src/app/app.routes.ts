import { Routes } from '@angular/router';
import { MainLayoutComponent } from '../layouts/main-layout/main-layout.component';
import { authGuard, adminGuard, staffGuard, clienteGuard } from '../core/guard/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('../feature/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'solicitar-cuenta',
    loadComponent: () => import('../feature/auth/solicitar-cuenta/solicitar-cuenta.component').then(m => m.SolicitarCuentaComponent)
  },
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('../feature/home/home.component').then(m => m.HomeComponent)
      },
      {
        path: 'empleado',
        loadComponent: () => import('../feature/empleado/dashboard-empleado/dashboard-empleado.component').then(m => m.DashboardEmpleadoComponent),
        canActivate: [staffGuard]
      },
      {
        path: 'empleado/perfil',
        loadComponent: () => import('../feature/perfil-staff/perfil-staff.component').then(m => m.PerfilStaffComponent),
        canActivate: [staffGuard]
      },
      {
        path: 'empleado/alquileres',
        loadComponent: () => import('../feature/alquileres/listar-alquileres/listar-alquileres.component').then(m => m.ListarAlquileresComponent),
        canActivate: [staffGuard]
      },
      {
        path: 'admin',
        loadComponent: () => import('../feature/admin/dashboard-admin/dashboard-admin.component').then(m => m.DashboardAdminComponent),
        canActivate: [adminGuard]
      },
      {
        path: 'admin/perfil',
        loadComponent: () => import('../feature/perfil-staff/perfil-staff.component').then(m => m.PerfilStaffComponent),
        canActivate: [adminGuard]
      },
      {
        path: 'perfil',
        loadComponent: () => import('../feature/perfil-staff/perfil-staff.component').then(m => m.PerfilStaffComponent),
        canActivate: [staffGuard]
      },
      {
        path: 'admin/usuarios',
        loadComponent: () => import('../feature/admin/usuarios/listar-usuarios/listar-usuarios.component').then(m => m.ListarUsuariosComponent),
        canActivate: [adminGuard]
      },
      {
        path: 'admin/reportes',
        loadComponent: () => import('../feature/admin/reportes/reportes.component').then(m => m.ReportesComponent),
        canActivate: [adminGuard]
      },
      {
        path: 'admin/roles',
        redirectTo: 'admin/usuarios',
        pathMatch: 'full'
      },
      {
        path: 'admin/catalogo',
        loadComponent: () => import('../feature/admin/catalogo-base/catalogo-base.component').then(m => m.CatalogoBaseComponent),
        canActivate: [staffGuard]
      },
      {
        path: 'cliente',
        loadComponent: () => import('../feature/cliente/dashboard-cliente/dashboard-cliente.component').then(m => m.DashboardClienteComponent),
        canActivate: [clienteGuard]
      },
      {
        path: 'cliente/perfil',
        loadComponent: () => import('../feature/cliente/perfil-cliente/perfil-cliente.component').then(m => m.PerfilClienteComponent),
        canActivate: [clienteGuard]
      },
      {
        path: 'cliente/reservas',
        loadComponent: () => import('../feature/cliente/mis-reservas/mis-reservas.component').then(m => m.MisReservasComponent),
        canActivate: [clienteGuard]
      },
      {
        path: 'mis-reservas',
        redirectTo: 'cliente/reservas',
        pathMatch: 'full'
      },
      {
        path: 'reservar',
        loadComponent: () => import('../feature/reservas/reserva-publica/reserva-publica.component').then(m => m.ReservaPublicaComponent)
      },
      {
        path: 'catalogo',
        loadComponent: () => import('../feature/catalogo/catalogo-vehiculos/catalogo-vehiculos.component').then(m => m.CatalogoVehiculosComponent)
      },
      {
        path: 'catalogo/vehiculo/:id',
        loadComponent: () => import('../feature/catalogo/detalle-vehiculo/detalle-vehiculo.component').then(m => m.DetalleVehiculoComponent)
      },
      {
        path: 'vehiculo/:id',
        loadComponent: () => import('../feature/catalogo/detalle-vehiculo/detalle-vehiculo.component').then(m => m.DetalleVehiculoComponent)
      },
      {
        path: 'admin/vehiculos',
        redirectTo: 'vehiculos',
        pathMatch: 'full'
      },
      {
        path: 'vehiculos',
        loadComponent: () => import('../feature/vehiculos/listar-vehiculos/listar-vehiculos.component').then(m => m.ListarVehiculosComponent),
        canActivate: [staffGuard]
      },
      {
        path: 'clientes',
        loadComponent: () => import('../feature/clientes/listar-clientes/listar-clientes.component').then(m => m.ListarClientesComponent),
        canActivate: [staffGuard]
      },
      {
        path: 'alquileres',
        loadComponent: () => import('../feature/alquileres/listar-alquileres/listar-alquileres.component').then(m => m.ListarAlquileresComponent),
        canActivate: [staffGuard]
      },
      {
        path: 'nosotros',
        loadComponent: () => import('../feature/nosotros/nosotros.component').then(m => m.NosotrosComponent)
      },
      {
        path: 'contacto',
        loadComponent: () => import('../feature/contacto/contacto.component').then(m => m.ContactoComponent)
      },
      {
        path: 'contactanos',
        redirectTo: 'contacto',
        pathMatch: 'full'
      },
      {
        path: '**',
        loadComponent: () => import('../shared/components/not-found/not-found.component').then(m => m.NotFoundComponent)
      }
    ]
  }
];
