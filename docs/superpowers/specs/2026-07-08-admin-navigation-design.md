# Especificación de Diseño: Navegación Dinámica del Administrador (Desktop Dropdowns y Mobile Accordion)

**Fecha:** 2026-07-08  
**Estado:** Propuesto (Pendiente de Aprobación del Usuario)  
**Autor:** Antigravity (AI Coding Assistant)  

---

## 1. Introducción y Objetivos
El objetivo principal es mejorar la navegación de la interfaz de administración (`/admin/*`) de VERUM. Actualmente, los submenús de cada categoría (como Inventario, Producción, Asistencia y Checklists) solo son accesibles una vez que el usuario ingresa al panel principal de esa sección. 

Esta especificación describe el rediseño para:
- Incorporar menús desplegables (**Dropdowns**) en la barra de navegación horizontal de escritorio.
- Reemplazar la barra horizontal en móviles con un botón de menú de hamburguesa que abra un panel lateral (**Drawer**) con secciones colapsables (**Accordions**).
- Mejorar la usabilidad permitiendo el acceso directo a cualquier subsección desde cualquier parte del administrador.

---

## 2. Requerimientos de UX/UI y Flujo de Interacción

### 2.1. Vista Desktop (Escritorio, `md` y pantallas superiores)
- **Visualización**: Barra horizontal de pestañas (layout actual) con flechas hacia abajo (`ChevronDown`) para indicar que hay submenús.
- **Accionamiento**: Al hacer clic en una categoría (ej. "Inventario"), se abre el menú desplegable relativo a ese botón. Al hacer clic nuevamente o en otra categoría, se cierra.
- **Enlace "Dashboard"**: Como la categoría ahora abre el menú desplegable en lugar de navegar de inmediato, el submenú incluirá un elemento inicial llamado "Dashboard" o "Inicio" que llevará a la página principal de la categoría (ej. `/admin/inventory`).
- **Cierre**:
  - Al hacer clic en un enlace de submenú.
  - Al hacer clic en cualquier lugar fuera del menú activo (Click Outside detection).
  - Al presionar la tecla `Escape`.
- **Estilo Activo**: La categoría principal mostrará el borde inferior azul/primario y texto azul si la ruta actual coincide con la base de la categoría o cualquiera de sus hijos (ej. `/admin/inventory/utensils` mantiene activa la pestaña **Inventario**).

### 2.2. Vista Mobile (Móvil, pantallas menores a `md`)
- **Top Bar**: Se incorpora un botón de menú (icono `Menu` de Lucide) a la izquierda del logo/título "VERUM Admin".
- **Cajón de Navegación (Sidebar Drawer)**:
  - Al hacer clic en el botón de hamburguesa, un panel de `72px` de ancho se desliza suavemente desde la izquierda.
  - Un fondo oscurecido semitransparente con desenfoque (`backdrop-blur-sm bg-black/40`) cubre el resto de la pantalla. Al tocarlo, se cierra la barra de navegación.
- **Secciones Colapsables (Acordeones)**:
  - Las categorías con submenús tendrán un indicador visual de expansión (flecha que gira 90 grados al abrirse).
  - Al presionar una categoría, el submenú se despliega verticalmente hacia abajo con una transición animada.
  - El primer elemento del acordeón de submenús también será la ruta de "Dashboard / Inicio".

---

## 3. Arquitectura y Estructura de Datos
Se actualizará la estructura de `NAV_ITEMS` en [layout.tsx](file:///C:/Users/dmj-travel/proyectos/verum/frontend/src/app/admin/layout.tsx) para incluir el arreglo opcional `items`:

```typescript
interface SubnavItem {
  href: string;
  label: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<any>;
  items?: SubnavItem[];
}
```

### Configuración de Rutas y Submenús
1. **Dashboard** (`/admin/dashboard`): Sin submenús.
2. **Checklists** (`/admin/checklists`):
   - Dashboard: `/admin/checklists/dashboard`
   - Plantillas: `/admin/templates`
   - Envíos: `/admin/submissions`
3. **Inventario** (`/admin/inventory`):
   - Dashboard: `/admin/inventory`
   - Documentos: `/admin/inventory/documents`
   - Activos Fijos: `/admin/inventory/assets`
   - Utensilios: `/admin/inventory/utensils`
   - Artículos: `/admin/inventory/items`
   - Almacenes: `/admin/inventory/warehouses`
   - Kardex: `/admin/inventory/kardex`
   - Historial de Inventario: `/admin/inventory/snapshot`
4. **Producción** (`/admin/production`):
   - Dashboard: `/admin/production`
   - Tablero KDS: `/production/kds` (ruta global)
   - Recetas: `/admin/production/recipes`
   - Órdenes: `/admin/production/orders`
   - Catering & MRP: `/admin/production/catering`
5. **Asistencia** (`/admin/attendance`):
   - Dashboard: `/admin/attendance`
   - Reportes: `/admin/attendance/reports`
   - Turnos: `/admin/attendance/shifts`
   - Ausencias: `/admin/attendance/absences`
6. **Empresa** (`/admin/venues`): Sin submenús.
7. **Equipo** (`/admin/team`): Sin submenús.

---

## 4. Detalles de Implementación en React y CSS

### 4.1. Manejo de Estados
En el componente `AdminLayout` se definirán los siguientes estados:
- `isMobileOpen: boolean` - Controla si el Drawer móvil está abierto.
- `activeDropdown: string | null` - Guarda el `href` de la categoría principal que tiene su dropdown abierto en Desktop.
- `expandedMobileItems: Record<string, boolean>` - Almacena qué acordeones móviles están expandidos (ej. `{"/admin/inventory": true}`).

### 4.2. Animaciones y Clases Tailwind (Estética Rich)
- **Dropdowns Desktop**: 
  `animate-in fade-in slide-in-from-top-2 duration-200 ease-out`
- **Sidebar Drawer**: 
  `transition-transform duration-300 ease-in-out` con estados `translate-x-0` y `-translate-x-full`.
- **Fondo Oscuro (Backdrop)**: 
  `transition-opacity duration-300 ease-in-out` con estados `opacity-100` y `opacity-0`.

---

## 5. Pruebas y Criterios de Aceptación
Para considerar el trabajo como completado, se deben validar los siguientes comportamientos:
1. **Navegación Desktop**: Al hacer clic en "Inventario", el menú se despliega. Al hacer clic fuera de él, se cierra de inmediato.
2. **Navegación Móvil**: En pantallas móviles (<768px), la barra horizontal desaparece y se muestra el menú de hamburguesa. Al abrirlo, desplegar "Asistencia" muestra correctamente Reportes, Turnos y Ausencias.
3. **Resistencia de Rutas Activas**: Al estar en la ruta `/admin/production/recipes`, el indicador azul de "Producción" en la barra superior debe permanecer iluminado.
4. **Preservación de Estado de Usuario**: El Selector de Sedes, cambio de tema (Sol/Luna) y el perfil del administrador deben seguir funcionando normalmente.
