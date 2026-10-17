# Conectar los recuerdos compartidos

El diario, las dedicatorias y la música usan Supabase para que cualquier visitante pueda ver, agregar y editar recuerdos desde cualquier dispositivo. La página necesita un proyecto Supabase antes de que estas funciones se activen en Vercel.

## 1. Crear el proyecto

1. Entra a [Supabase](https://supabase.com/) y crea una cuenta o inicia sesión.
2. Crea un proyecto nuevo y guarda la contraseña de la base de datos en un lugar seguro.
3. Espera a que el proyecto termine de prepararse.

## 2. Crear la tabla y el espacio para fotos

1. Abre **SQL Editor** en el panel de Supabase y crea una consulta nueva.
2. Copia y ejecuta todo el contenido de [`supabase/setup.sql`](supabase/setup.sql).
3. Confirma que la consulta termine sin errores. Crea o actualiza la tabla `memories` y el bucket `shared-memories`.

Si Supabase ya estaba conectado, ejecuta [`supabase/enable-public-dedications-edits.sql`](supabase/enable-public-dedications-edits.sql) para activar las dedicatorias con foto y los permisos de editar y borrar. También puedes volver a ejecutar `setup.sql`; actualiza las políticas y conserva los recuerdos guardados.

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

## Acceso público

- Cualquier visitante puede leer, agregar, editar y borrar registros del diario, poemas y canciones.
- Los visitantes pueden subir fotos JPEG para canciones y dedicatorias; el diario no usa fotos.
- Las fotos se reducen en el navegador y el bucket limita cada imagen a 1 MB.
- No hay cuentas, contraseña ni CAPTCHA: los permisos de escritura, edición y borrado son abiertos para todos, tal como se solicitó.
- Las imágenes quedan en el almacenamiento público. Al borrar una publicación, la página también intenta borrar su foto.

Los registros que quedaron en el almacenamiento local de un dispositivo no se copiarán automáticamente a la base de datos; seguirán en ese navegador. Las publicaciones nuevas sí se compartirán con todos cuando el proyecto esté conectado y desplegado.
