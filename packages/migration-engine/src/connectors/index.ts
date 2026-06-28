/**
 * Registry de conectores: ConnectorId -> factory.
 * Adicionar um conector novo = registrar aqui + implementar SourceConnector.
 * Nenhuma outra parte do sistema muda (objetivo do epico).
 */
import type { SourceConnector } from '../core/types/connector.js';
import { WordPressXmlConnector } from './wordpress/xml.js';

export type ConnectorFactory = () => SourceConnector;

export const CONNECTORS: Record<string, ConnectorFactory> = {
  'wordpress-xml': () => new WordPressXmlConnector(),
  // 'ghost': () => new GhostConnector(),
  // 'rss': () => new RssConnector(),
  // ... (Fase 5)
};

export function createConnector(id: string): SourceConnector {
  const factory = CONNECTORS[id];
  if (!factory) throw new Error(`Conector desconhecido: "${id}". Disponiveis: ${Object.keys(CONNECTORS).join(', ')}`);
  return factory();
}
