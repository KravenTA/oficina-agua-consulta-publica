// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { resolverIp } from './ip-cliente';

const cabeceras = (obj: Record<string, string>) => new Headers(obj);

describe('resolverIp', () => {
  it('usa la IP de X-Forwarded-For', () => {
    expect(resolverIp(cabeceras({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('con varias entradas usa la ultima (las anteriores pudo escribirlas el cliente)', () => {
    expect(resolverIp(cabeceras({ 'x-forwarded-for': '1.2.3.4, 203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('cae en X-Real-IP si no hay X-Forwarded-For', () => {
    expect(resolverIp(cabeceras({ 'x-real-ip': '198.51.100.9' }))).toBe('198.51.100.9');
  });

  it('devuelve null sin ninguna cabecera', () => {
    expect(resolverIp(cabeceras({}))).toBeNull();
  });

  it('ignora valores que no parecen una IP', () => {
    expect(resolverIp(cabeceras({ 'x-forwarded-for': 'no-es-una-ip!' }))).toBeNull();
    expect(resolverIp(cabeceras({ 'x-forwarded-for': ',' }))).toBeNull();
    expect(resolverIp(cabeceras({ 'x-forwarded-for': 'a'.repeat(200) }))).toBeNull();
  });

  it('acepta IPv6', () => {
    expect(resolverIp(cabeceras({ 'x-forwarded-for': '2001:db8::1' }))).toBe('2001:db8::1');
  });
});
