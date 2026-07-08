# Plan de Implementación: Navegación Dinámica del Administrador (Desktop Dropdowns y Mobile Accordion)

Este plan describe el desarrollo secuencial para implementar la navegación mejorada en el área de administración (`/admin/*`) de VERUM, incluyendo menús desplegables para pantallas de escritorio y un cajón lateral colapsable (acordeón) para dispositivos móviles.

---

## Fases y Tareas de Desarrollo

### 📊 Fase 1: Estructuración de Datos
*   **Tarea 1.1: Modificar `NAV_ITEMS` en el Layout**
    *   Archivo: [layout.tsx](file:///C:/Users/dmj-travel/proyectos/verum/frontend/src/app/admin/layout.tsx)
    *   Definir tipos/interfaces para los elementos principales y submenús.
    *   Incorporar la propiedad `items` en las categorías: **Checklists**, **Inventario**, **Producción** y **Asistencia** con sus respectivas subrutas y textos descriptivos en español.

### 🖥️ Fase 2: Componente Desktop (Menús Desplegables)
*   **Tarea 2.1: Implementar Estados de Apertura/Cierre**
    *   Archivo: [layout.tsx](file:///C:/Users/dmj-travel/proyectos/verum/frontend/src/app/admin/layout.tsx)
    *   Añadir el estado `activeDropdown: string | null` para rastrear qué menú está abierto.
*   **Tarea 2.2: Construir la UI del Dropdown Flotante**
    *   Archivo: [layout.tsx](file:///C:/Users/dmj-travel/proyectos/verum/frontend/src/app/admin/layout.tsx)
    *   Diseñar el contenedor del menú absoluto con clases Tailwind premium (sombra, bordes redondeados, fondo de superficie y animaciones de escala/opacidad).
    *   Incluir flechas indicadoras (`ChevronDown`) al lado de las categorías principales con submenús.
*   **Tarea 2.3: Implementar la Lógica de Cierre ("Click Outside" y Escape)**
    *   Archivo: [layout.tsx](file:///C:/Users/dmj-travel/proyectos/verum/frontend/src/app/admin/layout.tsx)
    *   Crear una referencia `useRef` para el contenedor de navegación.
    *   Añadir un event listener de clics a nivel de documento (`mousedown` / `touchstart`) para cerrar el menú activo cuando se hace clic fuera.
    *   Escuchar la tecla `Escape` para cerrar los menús abiertos de inmediato.
*   **Tarea 2.4: Actualizar Resaltado de Ruta Activa**
    *   Archivo: [layout.tsx](file:///C:/Users/dmj-travel/proyectos/verum/frontend/src/app/admin/layout.tsx)
    *   Modificar la lógica de activación (`active`) para comprobar si la ruta actual coincide con la base o con cualquiera de las subrutas de la categoría.

### 📱 Fase 3: Componente Móvil (Drawer y Acordeón)
*   **Tarea 3.1: Agregar Botón Hamburguesa en el Top Bar**
    *   Archivo: [layout.tsx](file:///C:/Users/dmj-travel/proyectos/verum/frontend/src/app/admin/layout.tsx)
    *   Incorporar un botón con el icono `Menu` visible solo en pantallas pequeñas (`md:hidden`) en la cabecera.
*   **Tarea 3.2: Implementar el Drawer Lateral con Backdrop**
    *   Archivo: [layout.tsx](file:///C:/Users/dmj-travel/proyectos/verum/frontend/src/app/admin/layout.tsx)
    *   Crear el panel lateral (`fixed left-0 top-0 bottom-0 w-72 z-50 bg-surface shadow-2xl`) con transiciones suaves de entrada y salida (`translate-x-0` vs `-translate-x-full`).
    *   Añadir un overlay oscuro con desenfoque de fondo (`bg-black/40 backdrop-blur-sm z-40`) que cierre el menú al hacer clic.
*   **Tarea 3.3: Implementar Menús Colapsables (Acordeones)**
    *   Archivo: [layout.tsx](file:///C:/Users/dmj-travel/proyectos/verum/frontend/src/app/admin/layout.tsx)
    *   Crear una lista vertical dentro del Drawer con el estado `expandedMobileItems`.
    *   Al hacer clic en una categoría con submenús, expandir/colapsar verticalmente con suavidad (`grid grid-rows-[0fr] -> grid-rows-[1fr]` o una transición de altura).
    *   Girar la flecha del indicador visual 90 o 180 grados según el estado de apertura.

### 🧪 Fase 4: Pruebas y Validación
*   **Tarea 4.1: Pruebas de Usabilidad Responsiva**
    *   Redimensionar la ventana del navegador para verificar el comportamiento de la barra horizontal (desktop) y del Drawer (móvil).
    *   Verificar que al hacer clic en las subopciones navegue correctamente y cierre los menús.
*   **Tarea 4.2: Compilación de Frontend**
    *   Ejecutar comprobación de TypeScript y linting para asegurar que no se introducen regresiones ni errores estáticos.

---

## Criterios de Aceptación
1.  La barra de navegación horizontal es completamente responsiva y no se corta en desktop.
2.  Al hacer clic fuera de un desplegable desktop, este se cierra automáticamente.
3.  En pantallas móviles, el menú hamburguesa abre el Drawer lateral y permite expandir y colapsar secciones sin saltos visuales.
4.  La compilación de TypeScript (`npm run build` o `npx tsc --noEmit`) en `frontend` es exitosa.
