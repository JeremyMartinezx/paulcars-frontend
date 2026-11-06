# Paul Car's — Frontend (Angular)

Interfaz web del sistema de alquiler de vehículos **Paul Car's**: catálogo público de vehículos, reservas, y paneles internos para empleados y administradores.

## Tecnologías

- Angular 19 (standalone components, signals)
- Angular Material
- TypeScript
- RxJS

## Requisitos previos

- Node.js 20 o superior
- npm
- El [backend](../alquiler_de_vehiculos) corriendo en `http://localhost:8080` (ver su propio README para levantarlo)

## Instalación

```bash
npm install
```

## Configuración de entornos

Las URLs del backend salen de `src/environments/`, no están escritas a mano en cada servicio:

- `src/environments/environment.ts` → usado en desarrollo (`apiUrl: 'http://localhost:8080/api'`)
- `src/environments/environment.prod.ts` → usado al compilar con `--configuration production`

Si tu backend corre en otra URL o puerto, solo cambia `apiUrl` en el archivo correspondiente.

## Levantar en desarrollo

```bash
ng serve
```

Abre `http://localhost:4200/`. La app recarga sola al guardar cambios.

## Compilar para producción

```bash
ng build --configuration production
```

Los archivos compilados quedan en `dist/alquiler-vehiculos-ui/`, ya usando `environment.prod.ts`.

## Correr pruebas

```bash
ng test
```

## Usuarios de prueba

| Usuario | Rol | Acceso |
|---|---|---|
| (el primero que se registre por `/solicitar-cuenta`) | ADMIN | Panel completo (`/admin`) |
| Empleados creados desde `/admin/usuarios` | EMPLEADO | Panel operativo (`/empleado`) |

## Estructura del proyecto

```
src/
├── app/            # Configuración raíz y rutas
├── core/           # Guards, interceptores, modelos y servicios compartidos
├── feature/        # Un subdirectorio por módulo funcional
│   ├── admin/          # Dashboard admin, usuarios, reportes, catálogo base
│   ├── alquileres/     # Listado y formulario de alquileres
│   ├── auth/            # Login, solicitud de cuenta
│   ├── catalogo/        # Catálogo público de vehículos
│   ├── clientes/        # Gestión de clientes
│   ├── empleado/        # Dashboard de empleado
│   ├── reservas/        # Flujo público de reserva
│   └── vehiculos/       # Gestión de vehículos
├── layouts/        # Layout principal (header + footer)
├── shared/         # Componentes reutilizables (confirmación, back-button, etc.)
└── environments/   # Configuración por entorno (dev/prod)
```

## Roles y accesos

- **Público / no autenticado:** home, catálogo, nosotros, contacto, reservar.
- **EMPLEADO:** Vehículos, Clientes, Alquileres (crear y editar; no puede eliminar).
- **ADMIN:** todo lo anterior, más eliminar registros, y el panel `/admin` (usuarios, reportes, catálogo base).