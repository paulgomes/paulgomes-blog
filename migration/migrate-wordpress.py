#!/usr/bin/env python3
"""
Migracao WordPress -> Astro

Le um export XML do WordPress e gera:
- Arquivos Markdown (.md) com frontmatter compativel com Astro
- Download e otimizacao de imagens (WebP)
- Arquivo de redirects para preservar SEO
- Relatorio de qualidade

Uso: python migrate-wordpress.py
"""

from __future__ import annotations

import io
import logging
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime
from html import unescape
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse
from xml.etree import ElementTree as ET

try:
    import requests
    from bs4 import BeautifulSoup
    from markdownify import markdownify as md
    from PIL import Image
    from slugify import slugify
except ImportError as e:
    print(f"Dependencia faltando: {e}")
    print("Rode: pip install -r requirements.txt")
    sys.exit(1)


# ============================================================
# CONFIGURACAO
# ============================================================

HERE = Path(__file__).parent.resolve()
PROJECT_ROOT = HERE.parent
XML_FILE = HERE / "wordpress-export.xml"
BLOG_DIR = PROJECT_ROOT / "src" / "content" / "blog"
ASSETS_DIR = PROJECT_ROOT / "src" / "assets" / "posts"
PUBLIC_DIR = PROJECT_ROOT / "public"
REPORT_FILE = HERE / "migration-report.md"
LOG_FILE = HERE / "migration.log"

NS = {
    "wp": "http://wordpress.org/export/1.2/",
    "content": "http://purl.org/rss/1.0/modules/content/",
    "dc": "http://purl.org/dc/elements/1.1/",
    "excerpt": "http://wordpress.org/export/1.2/excerpt/",
}

IMAGE_QUALITY = 85
MAX_IMAGE_WIDTH = 1920
DOWNLOAD_TIMEOUT = 30
DOWNLOAD_WORKERS = 10

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("migrate")


# ============================================================
# MODELOS
# ============================================================

@dataclass
class Attachment:
    id: str
    url: str
    title: str
    local_path: Optional[Path] = None
    local_relative: Optional[str] = None


@dataclass
class Post:
    id: str
    title: str
    slug: str
    link: str
    pub_date: datetime
    content_html: str
    excerpt: str
    categories: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    thumbnail_id: Optional[str] = None
    hero_image: Optional[str] = None
    content_md: str = ""
    is_draft: bool = False
    notes: list[str] = field(default_factory=list)


# ============================================================
# PARSING DO XML
# ============================================================

def parse_xml(xml_path: Path) -> tuple[list[Post], dict[str, Attachment]]:
    if not xml_path.exists():
        log.error(f"Arquivo nao encontrado: {xml_path}")
        log.error("Coloque o XML em: migration/wordpress-export.xml")
        sys.exit(1)

    log.info(f"Lendo XML: {xml_path}")
    tree = ET.parse(xml_path)
    channel = tree.getroot().find("channel")

    posts: list[Post] = []
    attachments: dict[str, Attachment] = {}

    for item in channel.findall("item"):
        post_type = item.findtext("wp:post_type", default="", namespaces=NS)
        status = item.findtext("wp:status", default="", namespaces=NS)
        post_id = item.findtext("wp:post_id", default="", namespaces=NS)

        if post_type == "attachment":
            url = item.findtext("wp:attachment_url", default="", namespaces=NS)
            title = item.findtext("title", default="")
            if url:
                attachments[post_id] = Attachment(
                    id=post_id,
                    url=url,
                    title=title or "",
                )

        elif post_type == "post" and status == "publish":
            title = (item.findtext("title", default="") or "").strip()
            slug = (item.findtext("wp:post_name", default="", namespaces=NS) or "").strip()
            link = item.findtext("link", default="") or ""
            pub_date_str = item.findtext("wp:post_date", default="", namespaces=NS) or ""
            content_html = item.findtext("content:encoded", default="", namespaces=NS) or ""
            excerpt = item.findtext("excerpt:encoded", default="", namespaces=NS) or ""

            try:
                pub_date = datetime.strptime(pub_date_str, "%Y-%m-%d %H:%M:%S")
            except (ValueError, TypeError):
                pub_date = datetime(2020, 1, 1)

            categories = [
                c.text for c in item.findall("category")
                if c.get("domain") == "category" and c.text
            ]
            tags = [
                c.text for c in item.findall("category")
                if c.get("domain") == "post_tag" and c.text
            ]

            thumbnail_id = None
            for meta in item.findall("wp:postmeta", NS):
                key = meta.findtext("wp:meta_key", default="", namespaces=NS)
                if key == "_thumbnail_id":
                    thumbnail_id = meta.findtext("wp:meta_value", default="", namespaces=NS)
                    break

            if not slug:
                slug = slugify(title) or f"post-{post_id}"

            posts.append(Post(
                id=post_id,
                title=title,
                slug=slug,
                link=link,
                pub_date=pub_date,
                content_html=content_html,
                excerpt=excerpt,
                categories=categories,
                tags=tags,
                thumbnail_id=thumbnail_id,
            ))

    posts.sort(key=lambda p: p.pub_date, reverse=True)
    log.info(f"{len(posts)} posts publicados")
    log.info(f"{len(attachments)} attachments")
    return posts, attachments


# ============================================================
# DOWNLOAD DE IMAGENS
# ============================================================

def download_image(att: Attachment, target_dir: Path) -> Optional[Attachment]:
    try:
        parsed = urlparse(att.url)
        original_name = Path(parsed.path).name
        if not original_name:
            return None

        stem = Path(original_name).stem
        ext = Path(original_name).suffix.lower()
        safe_stem = slugify(stem) or f"img-{att.id}"

        is_image = ext in {".jpg", ".jpeg", ".png", ".webp", ".gif"}
        out_ext = ".webp" if is_image and ext != ".gif" else ext
        out_name = f"{safe_stem}{out_ext}"
        out_path = target_dir / out_name

        if out_path.exists():
            att.local_path = out_path
            return att

        target_dir.mkdir(parents=True, exist_ok=True)

        resp = requests.get(att.url, timeout=DOWNLOAD_TIMEOUT, headers={
            "User-Agent": "Mozilla/5.0 (compatible; PaulGomesBlogMigrator/1.0)"
        })
        resp.raise_for_status()

        if is_image and ext != ".gif":
            try:
                img = Image.open(io.BytesIO(resp.content))
                if img.mode in ("RGBA", "LA", "P"):
                    img = img.convert("RGBA")
                else:
                    img = img.convert("RGB")

                if img.width > MAX_IMAGE_WIDTH:
                    ratio = MAX_IMAGE_WIDTH / img.width
                    new_size = (MAX_IMAGE_WIDTH, int(img.height * ratio))
                    img = img.resize(new_size, Image.Resampling.LANCZOS)

                img.save(out_path, format="WEBP", quality=IMAGE_QUALITY, method=6)
            except Exception as e:
                log.warning(f"  Otimizacao falhou {att.url}: {e}")
                out_path = target_dir / original_name
                out_path.write_bytes(resp.content)
        else:
            out_path = target_dir / original_name
            out_path.write_bytes(resp.content)

        att.local_path = out_path
        return att

    except Exception as e:
        log.warning(f"  Falhou {att.url}: {e}")
        return None


def download_all_images(
    attachments: dict[str, Attachment],
    posts: list[Post],
    images_dir: Path,
) -> int:
    log.info("Baixando imagens (pode demorar)...")

    inline_image_urls = set()
    for post in posts:
        urls = re.findall(
            r'<img[^>]+src=["\']([^"\']+)["\']',
            post.content_html,
        )
        inline_image_urls.update(urls)

    next_id = 900000
    inline_attachments: list[Attachment] = []
    existing_urls = {a.url for a in attachments.values()}
    for url in inline_image_urls:
        if url not in existing_urls:
            inline_attachments.append(Attachment(
                id=f"inline-{next_id}",
                url=url,
                title="",
            ))
            next_id += 1

    to_download: list[tuple[Attachment, Path]] = []
    for att in attachments.values():
        to_download.append((att, images_dir / "library"))
    for att in inline_attachments:
        to_download.append((att, images_dir / "inline"))

    log.info(f"  {len(to_download)} arquivos pra baixar")

    success = 0
    fail = 0
    with ThreadPoolExecutor(max_workers=DOWNLOAD_WORKERS) as pool:
        futures = {
            pool.submit(download_image, att, target_dir): att
            for att, target_dir in to_download
        }
        for i, future in enumerate(as_completed(futures), 1):
            att = futures[future]
            result = future.result()
            if result and result.local_path:
                success += 1
                if att.id.startswith("inline-"):
                    attachments[att.id] = result
            else:
                fail += 1
            if i % 50 == 0:
                log.info(f"  progresso: {i}/{len(to_download)}")

    log.info(f"Imagens: {success} ok, {fail} falhas")

    for att in attachments.values():
        if att.local_path:
            try:
                rel = att.local_path.relative_to(ASSETS_DIR)
                att.local_relative = f"../../assets/posts/{rel.as_posix()}"
            except ValueError:
                pass

    return success


# ============================================================
# LIMPEZA DE HTML
# ============================================================

SHORTCODE_PATTERN = re.compile(
    r"\[/?(?:vc_[a-z_]+|et_pb_[a-z_]+|fusion_[a-z_]+|elementor[a-z_]*|cs_[a-z_]+|caption|gallery|embed|video|audio|playlist)[^\]]*\]",
    re.IGNORECASE,
)
WP_BLOCKS_PATTERN = re.compile(r"<!--\s*/?wp:[^>]+-->", re.IGNORECASE)


def clean_html(html: str, attachments: dict[str, Attachment]) -> str:
    if not html:
        return ""

    html = WP_BLOCKS_PATTERN.sub("", html)
    html = SHORTCODE_PATTERN.sub("", html)

    if "<p>" not in html and "<div" not in html:
        paragraphs = [p.strip() for p in html.split("\n\n") if p.strip()]
        html = "\n\n".join(f"<p>{p}</p>" for p in paragraphs)

    soup = BeautifulSoup(html, "lxml")

    for el in soup.find_all(True):
        for attr in ["class", "id", "style", "data-id", "data-element_type",
                     "data-widget_type", "data-settings", "srcset", "sizes",
                     "loading", "decoding"]:
            if el.has_attr(attr):
                del el[attr]

    for img in soup.find_all("img"):
        src = img.get("src", "")
        for att in attachments.values():
            if att.url == src and att.local_relative:
                img["src"] = att.local_relative
                break

    return str(soup)


def html_to_markdown(html: str) -> str:
    if not html.strip():
        return ""

    md_text = md(
        html,
        heading_style="ATX",
        bullets="-",
        code_language="",
        strip=["script", "style"],
    )

    md_text = unescape(md_text)
    md_text = re.sub(r"\n{3,}", "\n\n", md_text)
    md_text = md_text.strip()

    return md_text


# ============================================================
# GERACAO DE ARQUIVOS
# ============================================================

def yaml_escape(value: str) -> str:
    if not value:
        return '""'
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def generate_excerpt(content_md: str, max_chars: int = 200) -> str:
    text = re.sub(r"[#*_`\[\]()!]", "", content_md)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= max_chars:
        return text
    cut = text[:max_chars].rsplit(" ", 1)[0]
    return cut + "..."


def write_post(post: Post, attachments: dict[str, Attachment]) -> None:
    cleaned = clean_html(post.content_html, attachments)
    post.content_md = html_to_markdown(cleaned)

    description = post.excerpt.strip() if post.excerpt else ""
    if not description and post.content_md:
        description = generate_excerpt(post.content_md)
    if not description:
        description = post.title
        post.notes.append("description gerada do titulo (vazio)")

    if post.thumbnail_id and post.thumbnail_id in attachments:
        att = attachments[post.thumbnail_id]
        if att.local_relative:
            post.hero_image = att.local_relative

    if not post.content_md or len(post.content_md) < 50:
        post.is_draft = True
        post.notes.append("conteudo vazio ou muito curto")

    fm_lines = ["---"]
    fm_lines.append(f"title: {yaml_escape(post.title)}")
    fm_lines.append(f"description: {yaml_escape(description)}")
    fm_lines.append(f"pubDate: {post.pub_date.strftime('%Y-%m-%d')}")
    if post.hero_image:
        fm_lines.append(f"heroImage: {yaml_escape(post.hero_image)}")
    fm_lines.append("---")
    fm_lines.append("")

    frontmatter = "\n".join(fm_lines)
    body = post.content_md or ""

    BLOG_DIR.mkdir(parents=True, exist_ok=True)
    out_path = BLOG_DIR / f"{post.slug}.md"
    out_path.write_text(frontmatter + "\n" + body + "\n", encoding="utf-8")


def write_redirects(posts: list[Post]) -> None:
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    lines = ["# Redirects WordPress -> Astro"]
    lines.append("")

    for post in posts:
        if not post.link:
            continue
        old_path = urlparse(post.link).path
        if not old_path.startswith("/"):
            continue
        old_path = old_path.rstrip("/") or "/"
        new_path = f"/blog/{post.slug}"
        if old_path != new_path:
            lines.append(f"{old_path} {new_path} 301")
            lines.append(f"{old_path}/ {new_path} 301")

    out = PUBLIC_DIR / "_redirects"
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    log.info(f"Redirects: {out}")


def write_report(posts: list[Post], attachments: dict[str, Attachment], duration: float) -> None:
    drafts = [p for p in posts if p.is_draft]
    with_hero = [p for p in posts if p.hero_image]
    with_notes = [p for p in posts if p.notes]

    lines = [
        "# Relatorio de Migracao",
        "",
        f"**Data:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"**Duracao:** {duration:.1f}s",
        "",
        "## Resumo",
        "",
        f"- Posts migrados: **{len(posts)}**",
        f"- Marcados como draft: {len(drafts)}",
        f"- Com hero image: {len(with_hero)}",
        f"- Com avisos: {len(with_notes)}",
        f"- Imagens baixadas: {len([a for a in attachments.values() if a.local_path])}",
        "",
        "## Posts marcados como draft",
        "",
    ]

    if drafts:
        for p in drafts:
            lines.append(f"- `{p.slug}` - {p.title}")
            for note in p.notes:
                lines.append(f"  - {note}")
    else:
        lines.append("_Nenhum_")

    lines.extend(["", "## Categorias", ""])
    cats = {}
    for p in posts:
        for c in p.categories:
            cats[c] = cats.get(c, 0) + 1
    for c, n in sorted(cats.items(), key=lambda x: -x[1]):
        lines.append(f"- {c}: {n}")

    REPORT_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
    log.info(f"Relatorio: {REPORT_FILE}")


# ============================================================
# MAIN
# ============================================================

def main() -> int:
    start = time.time()
    log.info("=" * 60)
    log.info("Iniciando migracao WordPress -> Astro")
    log.info("=" * 60)

    posts, attachments = parse_xml(XML_FILE)
    download_all_images(attachments, posts, ASSETS_DIR)

    log.info("Gerando Markdown...")
    for i, post in enumerate(posts, 1):
        try:
            write_post(post, attachments)
            if i % 25 == 0:
                log.info(f"  progresso: {i}/{len(posts)}")
        except Exception as e:
            log.error(f"  Erro em {post.slug}: {e}")

    log.info(f"{len(posts)} posts gerados em {BLOG_DIR}")

    write_redirects(posts)

    duration = time.time() - start
    write_report(posts, attachments, duration)

    log.info("=" * 60)
    log.info(f"Concluido em {duration:.1f}s")
    log.info(f"  Posts:   {len(posts)}")
    log.info(f"  Imagens: {sum(1 for a in attachments.values() if a.local_path)}")
    log.info(f"  Veja:    migration-report.md")
    log.info("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
