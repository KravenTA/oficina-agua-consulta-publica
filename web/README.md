# web/ — Capa Web con captcha

Página pública y BFF: valida el captcha en el servidor y llama por http al ApiRest.
El navegador nunca conoce la URL interna del ApiRest ni sus credenciales.

| HU | Qué se construye aquí |
|---|---|
| HU-25 | Formulario (código del contador) + widget de captcha, responsive, paleta de agua |
| HU-26 | Validación del token del captcha en servidor y llamada http al ApiRest |
| HU-27 | Visualización del estado de cuenta, recibos vencidos y mensajes de error |
