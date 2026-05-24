import type { Env } from './db';

export type MenuItem = {
  id: string;
  menu_type: 'header' | 'footer';
  parent_id: string | null;
  label: string;
  url: string;
  sort_order: number;
  open_new_tab: number;
  is_hidden: number;
  created_at: number;
  updated_at: number;
};

export type MenuItemNode = MenuItem & { children: MenuItemNode[] };

/**
 * Monta árvore hierárquica a partir de lista flat de itens.
 * Itens orfãos (parent_id aponta pra ID inexistente) viram raiz.
 * Ordena por sort_order em cada nível.
 */
export function buildTree(items: MenuItem[]): MenuItemNode[] {
  const byId = new Map<string, MenuItemNode>();
  for (const it of items) {
    byId.set(it.id, { ...it, children: [] });
  }
  const roots: MenuItemNode[] = [];
  for (const it of items) {
    const node = byId.get(it.id)!;
    if (it.parent_id && byId.has(it.parent_id)) {
      byId.get(it.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (nodes: MenuItemNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    for (const n of nodes) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

/**
 * Detecta se setar `newParentId` como pai de `itemId` criaria ciclo.
 * Sobe a árvore via parent_id até NULL; se encontrar itemId → ciclo.
 * Também detecta ciclos pré-existentes via Set de visitados.
 */
export async function detectCycle(
  env: Env,
  itemId: string,
  newParentId: string | null,
): Promise<boolean> {
  if (!newParentId) return false;
  if (newParentId === itemId) return true;

  let current: string | null = newParentId;
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current)) return true;
    visited.add(current);
    if (current === itemId) return true;

    const row = await env.DB
      .prepare('SELECT parent_id FROM menu_items WHERE id = ?')
      .bind(current)
      .first<{ parent_id: string | null }>();
    if (!row) return false;
    current = row.parent_id;
  }
  return false;
}
