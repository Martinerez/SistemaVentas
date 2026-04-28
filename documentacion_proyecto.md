# Documentación Técnica: Sistema de Gestión de Ventas e Inventario

## 1. Introducción
El **Sistema de Gestión de Ventas e Inventario** es una plataforma integral diseñada para optimizar las operaciones comerciales de una empresa. Permite el control total del ciclo de vida de los productos, desde su adquisición a proveedores hasta su venta final, incluyendo la gestión de devoluciones, pérdidas y reportes gerenciales avanzados.

El enfoque principal del desarrollo ha sido la **eficiencia en el procesamiento de datos** y una **experiencia de usuario fluida**, delegando la lógica de negocio pesada a la base de datos y manteniendo un frontend reactivo y moderno.

---

## 2. Arquitectura del Sistema
El sistema sigue una arquitectura de **N-Capas** moderna:

*   **Capa de Presentación (Frontend):** Construida con **React** y **Vite**, utilizando **Tailwind CSS** para un diseño responsivo y profesional.
*   **Capa de Lógica (Backend):** Implementada en **Django REST Framework (DRF)**, actuando como un puente robusto entre el cliente y los datos.
*   **Capa de Datos (Base de Datos):** Basada en **PostgreSQL**, donde no solo se almacenan datos, sino que se ejecuta lógica compleja mediante funciones y vistas SQL.

---

## 3. Stack Tecnológico
| Componente | Tecnología | Propósito |
| :--- | :--- | :--- |
| **Frontend** | React 18 / TypeScript | Interfaz de usuario dinámica y tipado seguro. |
| **Estilos** | Tailwind CSS | Diseño modular y responsivo. |
| **Backend** | Django 4 / Python 3 | API robusta y administración eficiente. |
| **API** | Django REST Framework | Exposición de servicios web JSON. |
| **Autenticación** | JWT (Simple JWT) | Seguridad basada en tokens para sesiones. |
| **Base de Datos** | PostgreSQL | Almacenamiento relacional y lógica en el servidor. |
| **Cliente HTTP** | Axios | Comunicación asíncrona con el backend. |

---

## 4. Estructura de la Base de Datos (PostgreSQL)
La base de datos es el núcleo inteligente del sistema. A diferencia de las aplicaciones tradicionales, aquí se maneja gran parte del procesamiento analítico.

### Tablas Principales
*   **`Usuario`**: Almacena perfiles, credenciales (hasheadas) y roles.
*   **`Producto` / `Categoria`**: Catálogo maestro de artículos y sus clasificaciones.
*   **`Inventario`**: Registro individual de cada ítem en stock, permitiendo trazabilidad por unidad.
*   **`Venta` / `DetalleVenta`**: Historial de transacciones y desglose de artículos vendidos.
*   **`SolicitudDevolucion`**: Control de productos retornados por clientes.
*   **`Perdida`**: Registro de mermas, daños o vencimientos.

### Lógica Almacenada
El sistema utiliza funciones SQL para generar reportes en tiempo real, evitando la sobrecarga del servidor Python:
*   **Reporte Gerencial**: Calcula KPI clave (ventas totales, productos más vendidos) directamente en el motor de DB.
*   **Pivot Table**: Genera matrices de ventas mensuales por producto de forma eficiente.

---

## 5. Backend: Desglose de Módulos
El backend está organizado en aplicaciones modulares para facilitar el mantenimiento.

### Módulo de Configuración (`config`)
*   **`settings.py`**: Configuración central del proyecto (conexión a DB, middleware, seguridad).
*   **`urls.py`**: Enrutador principal que deriva el tráfico a las aplicaciones específicas.
*   **`Reportes.py`**: Archivo especializado que ejecuta consultas SQL complejas para el dashboard administrativo.

### Aplicaciones de Negocio
1.  **`usuarios`**: Gestiona la autenticación, creación de cuentas y permisos de acceso.
2.  **`catalogo`**: Mantiene la información estática de productos, categorías y proveedores.
3.  **`inventario`**: Controla el stock, las entradas de pedidos (compras) y la gestión de pérdidas.
4.  **`ventas`**: Orquestador de transacciones comerciales, generación de totales y actualización de stock.

---

## 6. Frontend: Experiencia de Usuario
La interfaz ha sido diseñada para ser intuitiva y reducir la curva de aprendizaje.

### Organización de Código
*   **API Service (`axiosInstance.ts`)**: Configuración centralizada para peticiones. Maneja automáticamente los encabezados `Authorization` con tokens JWT y gestiona la interceptación de errores.
*   **Rutas (`routes.tsx`)**: Definición de la navegación segura del sitio, protegiendo páginas que requieren autenticación.

### Vistas Principales (Pages)
*   **`Login.tsx`**: Acceso seguro con validación de credenciales.
*   **`Dashboard.tsx`**: Vista panorámica con métricas visuales del estado del negocio.
*   **`Ventas.tsx`**: Terminal de punto de venta (POS) optimizado para rapidez.
*   **`Reportes.tsx`**: Centro analítico con capacidades de exportación a PDF y Excel.
*   **`Pedidos.tsx`**: Gestión de abastecimiento con entrada masiva de inventario.
*   **`Devoluciones.tsx`**: Flujo de aprobación para el retorno de mercancía al stock.
*   **`Productos.tsx`**: Gestión centralizada del catálogo maestro.

---

## 7. Flujos de Datos Típicos

### A. El Ciclo de una Venta (Transaccional)
1.  **Interfaz**: El usuario selecciona productos en `Ventas.tsx` y confirma la operación.
2.  **Transmisión**: El frontend envía un objeto JSON con el detalle a la API de Django.
3.  **Validación**: El backend verifica el stock disponible y la autenticidad del usuario.
4.  **Persistencia**:
    *   Se crea el registro en `Venta`.
    *   Se asocian los ítems en `DetalleVenta`.
    *   Se actualiza el estado de los ítems en `Inventario` de 'Disponible' a 'Vendido'.
5.  **Cierre**: El backend retorna un estado de éxito y el frontend limpia el carrito, notificando al usuario.

### B. Generación de Reporte Gerencial (Analítico)
1.  **Solicitud**: El administrador accede a `Reportes.tsx` y solicita el "Resumen Gerencial".
2.  **Consulta**: Django recibe la petición y, en lugar de procesar datos en Python, ejecuta una llamada a una **función almacenada** en PostgreSQL (`SELECT * FROM reporte_gerencial()`).
3.  **Cómputo**: La base de datos calcula promedios, sumatorias y comparativos de forma ultra-rápida.
4.  **Entrega**: El backend recibe el set de datos ya procesado, lo serializa a JSON y lo envía al cliente.
5.  **Visualización**: React utiliza estos datos para renderizar tablas dinámicas y gráficos de rendimiento.

---

## 8. Seguridad y Mejores Prácticas
*   **Tokens JWT**: Los tokens se almacenan en el estado de la aplicación/memoria, reduciendo riesgos de XSS.
*   **Variables de Entorno**: Datos sensibles como claves de DB y Secret Keys de Django se manejan en archivos `.env`.
*   **Separación de Responsabilidades**: El frontend nunca accede directamente a la DB; siempre lo hace a través de una API controlada.
*   **Logs de Error**: Registro detallado de fallos en el servidor para facilitar el soporte técnico.

---

## 9. Instrucciones de Configuración (Resumen)
Para poner en marcha el sistema, se requieren los siguientes pasos generales:

1.  **Configuración de DB**: Crear una base de datos PostgreSQL y ejecutar el script de esquema/funciones.
2.  **Entorno Backend**: Instalar dependencias mediante `pip install -r requirements.txt` y configurar el archivo `.env`.
3.  **Migraciones**: Ejecutar `python manage.py migrate` para preparar las tablas.
4.  **Entorno Frontend**: Instalar dependencias con `npm install` y ejecutar el servidor de desarrollo con `npm run dev`.

---
*Este documento es una guía técnica para desarrolladores y administradores del sistema.*
