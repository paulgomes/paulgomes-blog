# Migração WordPress → Astro

Este pacote migra todos os posts e imagens de um export XML do WordPress
para o formato Astro (Markdown + frontmatter + WebP).

## Como usar

1. Coloque o XML do WordPress nesta pasta com o nome `wordpress-export.xml`

2. Crie um ambiente virtual Python:

   ```bash
   python -m venv venv
   source venv/Scripts/activate   # Windows Git Bash
   ```

3. Instale as dependências:

   ```bash
   pip install -r requirements.txt
   ```

4. Execute o script:

   ```bash
   python migrate-wordpress.py
   ```

5. Veja o relatório em `migration-report.md`

## O que é gerado

- `../src/content/blog/<slug>.md` — posts em Markdown com frontmatter
- `../src/assets/posts/library/` — imagens otimizadas (WebP)
- `../public/_redirects` — redirecionamentos 301 (SEO)
- `migration-report.md` — relatório de qualidade
- `migration.log` — log detalhado
