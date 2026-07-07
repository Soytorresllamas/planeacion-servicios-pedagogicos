import { describe, expect, it } from 'vitest';
import { urlRecargaFresca } from './recarga';

describe('urlRecargaFresca', () => {
  it('agrega el parámetro de caché y preserva el hash de HashRouter', () => {
    expect(urlRecargaFresca({ pathname: '/planeacion-servicios-pedagogicos/', search: '', hash: '#/simulador' }, 123))
      .toBe('/planeacion-servicios-pedagogicos/?v=123#/simulador');
  });

  it('reemplaza un v anterior en vez de acumular parámetros', () => {
    expect(urlRecargaFresca({ pathname: '/app/', search: '?v=99', hash: '#/plan' }, 123))
      .toBe('/app/?v=123#/plan');
  });

  it('conserva otros query params y funciona sin hash', () => {
    expect(urlRecargaFresca({ pathname: '/app/', search: '?a=1', hash: '' }, 5))
      .toBe('/app/?a=1&v=5');
  });
});
