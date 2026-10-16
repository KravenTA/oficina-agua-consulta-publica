# web/ — Capa Web con captcha (Next.js)

Página pública donde el cliente consulta su estado de cuenta con el código de su contador,
sin iniciar sesión. Next.js hace dos papeles: sirve la página y actúa de **BFF** (Backend for
Frontend): el navegador nunca habla con el ApiRest, solo con Next.js.

| HU | Qué se construye aquí | Estado |
|---|---|---|
| HU-25 | Formulario con validación + captcha, responsive, paleta de agua | Hecha |
| HU-26 | Validar el captcha en servidor y llamar por http al ApiRest | Hecha |
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

## Cómo funciona la consulta (BFF)

El navegador solo habla con `POST /api/consulta` de Next.js. Ese endpoint, en el servidor:

1. Valida el pedido y el código del contador (el servidor no se fía de lo que validó el navegador).
2. **Verifica el token del captcha con el proveedor, usando la clave secreta.**
3. Solo si el captcha es válido, llama por http al ApiRest, enviando la IP real del cliente.
4. Devuelve al navegador el estado de cuenta o un error claro.

Si el captcha no es válido, el ApiRest **no se llama**. La URL del ApiRest y la clave secreta
nunca llegan al navegador.

| Respuesta | Cuándo |
|---|---|
| `200` | Estado de cuenta (el JSON del ApiRest) |
| `400` | Pedido mal formado o código del contador inválido (`SOLICITUD_INVALIDA`, `SERIE_INVALIDA`) |
| `403` | Captcha ausente o inválido (`CAPTCHA_INVALIDO`) |
| `404` | El ApiRest no encontró el contador |
| `429` | El ApiRest limitó las consultas de esa IP; se reenvía el `Retry-After` |
| `500` | Captcha mal configurado (`ERROR_CONFIGURACION`), por ejemplo falta la clave secreta |
| `503` | El proveedor del captcha o el ApiRest no responden |

## Variables de entorno

| Variable | Dónde se lee | Para qué |
|---|---|---|
| `CAPTCHA_PROVIDER` | servidor | `recaptcha` (por defecto) o `hcaptcha` |
| `CAPTCHA_SITE_KEY` | servidor, en cada petición | Clave pública. Llega al navegador como dato de la página |
| `CAPTCHA_SECRET_KEY` | servidor | Clave secreta para verificar el token. Nunca llega al navegador |
| `API_INTERNAL_URL` | servidor | URL interna del ApiRest. En Docker Compose es `http://api:8081`. Nunca llega al navegador |
| `TRUST_PROXY_HEADERS` | arranque del contenedor | Ver "IP real del cliente" |
| `CAPTCHA_VERIFY_URL` | servidor | **Solo para pruebas:** apunta la verificación a un servidor falso. No poner en producción |

Las claves se leen al responder cada petición, no al compilar la imagen. Por eso se pueden
cambiar en el `.env` y reiniciar el contenedor sin reconstruir.

## IP real del cliente

El ApiRest limita las consultas por IP (HU-24), y para eso la capa Web le envía la IP real del
cliente en `X-Forwarded-For`, reemplazando lo que traiga el navegador.

Hay un detalle: cuando alguien se conecta directo, Next.js rellena esa cabecera con la IP de la
conexión, pero **si el cliente manda la suya, Next la deja tal cual**. Un scraper podría inventar
una IP distinta en cada consulta y esquivar el límite. Por eso la imagen arranca con
`ip-del-socket.cjs` (`node --require ./ip-del-socket.cjs server.js`), que reemplaza la cabecera
por la IP real de la conexión antes de que Next la lea.

- `TRUST_PROXY_HEADERS=false` (por defecto): se usa la IP real de la conexión. Es lo correcto
  cuando el navegador se conecta directo a Next.js.
- `TRUST_PROXY_HEADERS=true`: solo si hay un proxy de confianza delante (nginx, un balanceador)
  que ya pone la IP correcta. Con `true` y sin proxy, cualquiera podría falsear su IP.

En Docker Desktop (Windows) la conexión del navegador llega desde la puerta de enlace de Docker,
así que todas las consultas de tu máquina comparten una sola IP y, por tanto, un solo cupo del
rate limit (10 por minuto por defecto). Es lo esperado en local.

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
