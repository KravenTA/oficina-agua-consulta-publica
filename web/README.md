# web/ — Capa Web con captcha (Next.js)

Página pública donde el cliente consulta su estado de cuenta con el código de su contador,
sin iniciar sesión. Next.js hace dos papeles: sirve la página y actúa de **BFF** (Backend for
Frontend): el navegador nunca habla con el ApiRest, solo con Next.js.

| HU | Qué se construye aquí | Estado |
|---|---|---|
| HU-25 | Formulario con validación + captcha, responsive, paleta de agua | Hecha |
| HU-26 | Validar el captcha en servidor y llamar por http al ApiRest | Pendiente (`/api/consulta` responde 501) |
| HU-27 | Mostrar el estado de cuenta, vencidos y mensajes de error | Pendiente |

## Cómo correrla

Con todo el sistema (lo normal):

```bash
docker compose up --build -d
```

Abrir <http://localhost:3000>.

Solo la capa Web, para desarrollar (necesita Node.js 22):

```bash
cd web
npm install
```

Crear `web/.env.local` (no se sube a git) con las claves del captcha:

```
CAPTCHA_PROVIDER=recaptcha
CAPTCHA_SITE_KEY=6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI
```

```bash
npm run dev
```

Abrir <http://localhost:3000>. Esas son las claves de **prueba** de Google (el captcha siempre
se aprueba y muestra un aviso). Para producción hay que registrar el sitio y usar claves reales.

## Variables de entorno

| Variable | Dónde se lee | Para qué |
|---|---|---|
| `CAPTCHA_PROVIDER` | servidor | `recaptcha` (por defecto) o `hcaptcha` |
| `CAPTCHA_SITE_KEY` | servidor, en cada petición | Clave pública. Llega al navegador como dato de la página |
| `CAPTCHA_SECRET_KEY` | servidor | Clave secreta. **No se usa todavía**; la usará la HU-26. Nunca llega al navegador |
| `API_INTERNAL_URL` | servidor | URL interna del ApiRest. La usará la HU-26. Nunca llega al navegador |

La clave pública se lee al responder cada petición, no al compilar la imagen. Por eso se puede
cambiar en el `.env` y reiniciar el contenedor sin reconstruir.

## Cómo funciona el formulario

- El código del contador se valida con la misma regla del ApiRest: 3 a 30 caracteres, solo
  letras, números y guiones. El error aparece al salir del campo o al intentar enviar.
- El botón **Consultar** está deshabilitado hasta que el código es válido **y** el captcha está
  resuelto. Si el captcha expira, vuelve a bloquearse.
- Un token del captcha sirve una sola vez: después de cada envío el captcha se reinicia.
- Si falta `CAPTCHA_SITE_KEY`, la página avisa y no permite enviar.

## Pruebas

```bash
cd web
npm test            # pruebas automáticas (no necesitan internet ni el ApiRest)
npm run typecheck   # revisión de tipos de TypeScript
```

## Estructura

```
web/
├── src/app/                 Páginas (App Router), estilos globales y /api/consulta
├── src/components/          ConsultaForm (formulario) y Captcha (widget)
├── src/lib/                 Validación del código y lectura de la configuración
├── public/                  Logo
├── Dockerfile               Imagen en tres etapas (dependencias, compilación, ejecución)
└── next.config.ts           Salida "standalone" para Docker y cabeceras de seguridad
```
