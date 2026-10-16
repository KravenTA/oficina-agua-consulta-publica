'use strict';
/**
 * Se ejecuta con:  node --require ./ip-del-socket.cjs server.js
 *
 * Next.js, cuando alguien se conecta directo, rellena X-Forwarded-For con la IP de la conexion;
 * pero si el cliente manda esa cabecera por su cuenta, Next la deja tal cual. Entonces un scraper
 * podria inventar una IP distinta en cada consulta y esquivar el rate limit del ApiRest.
 *
 * Este archivo reemplaza X-Forwarded-For por la IP real de la conexion antes de que Next la lea.
 *
 * Si Next esta detras de un proxy de confianza que ya pone la IP correcta (nginx, un balanceador),
 * se arranca con TRUST_PROXY_HEADERS=true y este archivo no hace nada.
 */
if (process.env.TRUST_PROXY_HEADERS !== 'true') {
  const http = require('node:http');
  const crearServidor = http.createServer;

  http.createServer = function crearServidorConIpReal(...args) {
    const servidor = crearServidor.apply(this, args);
    servidor.prependListener('request', (req) => {
      const ip = req.socket && req.socket.remoteAddress;
      if (ip) {
        req.headers['x-forwarded-for'] = ip;
      } else {
        delete req.headers['x-forwarded-for'];
      }
      delete req.headers['x-real-ip'];
    });
    return servidor;
  };
}
