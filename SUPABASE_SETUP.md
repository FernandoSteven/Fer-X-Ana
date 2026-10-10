# Conectar los recuerdos compartidos

El diario y la música usan Supabase para que cualquier visitante pueda ver las publicaciones y agregar nuevas desde cualquier dispositivo. La página necesita un proyecto Supabase gratuito o de pago antes de que estas funciones se activen en Vercel.

## 1. Crear el proyecto

1. Entra a [Supabase](https://supabase.com/) y crea una cuenta o inicia sesión.
2. Crea un proyecto nuevo y guarda la contraseña de la base de datos en un lugar seguro.
3. Espera a que el proyecto termine de prepararse.

## 2. Crear la tabla y el espacio para fotos

1. Abre **SQL Editor** en el panel de Supabase y crea una consulta nueva.
2. Copia y ejecuta todo el contenido de [`supabase/setup.sql`](supabase/setup.sql).
3. Confirma que la consulta termine sin errores. Crea la tabla `memories` y el bucket `shared-memories`.

Si la tabla ya existe pero las fotos indican que falta el bucket, puedes volver a ejecutar el SQL completo: está preparado para volver a crear sus políticas y completar el bucket que falte.

## 3. Conectar la página

1. En Supabase abre **Project Settings > API Keys**.
2. Copia la **Project URL** y la clave **publishable** que comienza con `sb_publishable_`.
3. En `config.js`, completa estos dos campos:

```js
window.APP_CONFIG = {
    supabaseUrl: "https://TU-PROYECTO.supabase.co",
    supabasePublishableKey: "sb_publishable_TU_CLAVE_PUBLICABLE"
};
```

4. Guarda y publica los cambios del repositorio GitHub conectado a Vercel. Vercel desplegará la página con la conexión configurada.

La clave `sb_publishable_` está pensada para usarse en la página. **Nunca** pegues una clave `sb_secret_`, `service_role` ni la contraseña de la base de datos en `config.js` o en el repositorio.

## Qué podrán hacer los visitantes

- Leer los registros del diario y las canciones publicadas.
- Agregar registros y canciones con una foto JPEG.
- Las fotos se reducen en el navegador y el bucket limita cada imagen a 1 MB.
- No hay botones ni permisos públicos para editar o borrar publicaciones.
- Como publicar es abierto, cualquier persona que encuentre la página podrá enviar contenido. No hay cuentas ni CAPTCHA en esta configuración.

Los registros que quedaron en el almacenamiento local de un dispositivo no se copiarán automáticamente a la base de datos; seguirán en ese navegador. Las publicaciones nuevas sí se compartirán con todos cuando el proyecto esté conectado y desplegado.
