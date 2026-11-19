# Paul Car's — Frontend (Angular)

Interfaz web del sistema de alquiler de vehículos **Paul Car's**: catálogo público, reserva en línea, portal del cliente y paneles de trabajo para asesores y administradores.

## Tecnologías

- Angular (componentes *standalone* y *signals*) y Angular Material
- TypeScript · RxJS
- Despliegue en Vercel (`vercel.json` con cabeceras de seguridad y reescritura SPA)

## Requisitos

- Node.js 20 o superior y npm
- El [backend](https://github.com/JeremyMartinezx/paulcars-backend) en `http://localhost:8080`

## Puesta en marcha

```bash
npm install
ng serve
```

Abre `http://localhost:4200/`.

## Entornos

La URL de la API sale de `src/environments/`:

- `environment.ts` → desarrollo (`http://localhost:8080/api`)
- `environment.prod.ts` → producción (servicio del backend en Render)

## Compilar para producción

```bash
ng build --configuration production
```

La salida queda en `dist/alquiler-vehiculos-ui/browser`.

## Módulos

| Carpeta | Contenido |
|---|---|
| `feature/home`, `nosotros`, `contacto` | Páginas públicas |
| `feature/catalogo`, `reservas` | Catálogo con filtros por sede y fechas (solo aparece lo que hay en la sede elegida) y reserva en línea |
| `feature/auth` | Inicio de sesión y solicitud de cuenta |
| `feature/cliente` | Portal del cliente: mis reservas por estado, pago con tarjeta, Yape o Plin, perfil |
| `feature/alquileres` | Alquileres del personal: tabla con orden y filtros, nuevo alquiler (la sede sin stock queda bloqueada), cobro, entrega de llaves con acta, recepción con inspección, daños, cancelación con reembolso y comprobantes PDF |
| `feature/vehiculos` | Flota: modelos con fotos y color, placas por sede |
| `feature/clientes` | Alta, edición e historial de clientes |
| `feature/admin` | Usuarios y roles, catálogos base y reportes con exportación |
| `shared`, `core` | Componentes reutilizables, guards, interceptor de sesión, modelos y servicios |

## Roles

- **Visitante:** catálogo y reserva pública.
- **Cliente:** sus reservas, pagos y comprobantes.
- **Asesor (`EMPLEADO`):** clientes, alquileres, cobro, entrega y recepción.
- **Administrador:** todo lo anterior más flota, usuarios, catálogos y reportes.

## Estructura

```
src/
├── app/          # Configuración raíz y rutas con lazy loading
├── core/         # Guards, interceptor, modelos, servicios y utilidades
├── feature/      # Un directorio por módulo funcional
├── layouts/      # Layout principal
├── shared/       # Componentes reutilizables
└── environments/ # Configuración por entorno
```
