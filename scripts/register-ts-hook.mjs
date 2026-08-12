// Registra o hook de resolução de .ts para os testes.
// Uso: node --experimental-strip-types --import ./scripts/register-ts-hook.mjs <teste>
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./ts-resolve-hook.mjs', pathToFileURL(import.meta.dirname + '/'));
