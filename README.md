# 📝 Papelitos - Tareas Divertidas en Familia

App para organizar las tareas domésticas de forma divertida. Los padres gestionan tareas y recompensas, los niños reciben papelitos impresos con códigos QR.

## Stack Tecnológico

- **Frontend**: Next.js 16 + React 19 + Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Despliegue Web**: Vercel
- **App Android**: Capacitor

## Desarrollo Local

```bash
cd papelitos
npm install
npm run dev
```

La app estará en `http://localhost:3000`

## Variables de Entorno

Crear `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=tu_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

## Despliegue en Vercel

1. Hacer push a GitHub: `git push origin main`
2. Conectar el repo en [vercel.com](https://vercel.com)
3. Configurar las variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Desplegar

## Generar APK Android

```bash
npm run android:add      # Solo la primera vez
npm run android:build    # Build + sync
npm run android:open     # Abrir en Android Studio
```

Desde Android Studio: Build > Build Bundle(s) / APK(s) > Build APK

## Pantallas

1. **Login** - Iniciar sesión o crear cuenta con email
2. **Menú** - 7 opciones principales
3. **Gestionar Usuarios** - CRUD de niños/usuarios
4. **Gestionar Tareas** - CRUD con filtros, toggle on/off
5. **Crear/Editar Tarea** - Formulario completo
6. **Gestionar Recompensas** - CRUD con filtros, toggle on/off
7. **Crear/Editar Recompensa** - Personal o común
8. **Gestión Papelitos** - Ver papelitos generados, reimprimir
9. **Escanear QR** - Escanear papelitos completados
10. **Configuración** - Impresora Bluetooth + horarios

## Lógica de Negocio

- **Inicio de Día**: Genera papelitos según definiciones de tareas activas y su frecuencia
- **Escaneo**: Marca tareas como hechas y verifica si se consiguen recompensas
- **Puntos KO**: Siempre negativos (se guardan en negativo)
- **Recompensas comunes**: Suman puntos de todos los usuarios
- **Recompensas personales**: Solo puntos del usuario asignado
