import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import { useEffect, useRef, useState } from 'react';

// Ponte com o script inline da página (editor.astro)
declare global {
  interface Window {
    __editorGetHTML?: () => string;
    __editorGetMarkdown?: () => string;
  }
}

// Converte HTML do TipTap pra markdown simples
function htmlToMarkdown(html: string): string {
  let md = html;
  md = md.replace(/<h1>(.*?)<\/h1>/g, '# $1\n\n');
  md = md.replace(/<h2>(.*?)<\/h2>/g, '## $1\n\n');
  md = md.replace(/<h3>(.*?)<\/h3>/g, '### $1\n\n');
  md = md.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
  md = md.replace(/<em>(.*?)<\/em>/g, '*$1*');
  md = md.replace(/<code>(.*?)<\/code>/g, '`$1`');
  md = md.replace(/<a href="(.*?)"[^>]*>(.*?)<\/a>/g, '[$2]($1)');
  md = md.replace(/<img src="(.*?)" alt="(.*?)"[^>]*>/g, '![$2]($1)');
  md = md.replace(/<blockquote><p>(.*?)<\/p><\/blockquote>/g, '> $1\n\n');
  md = md.replace(/<ul>([\s\S]*?)<\/ul>/g, (_, items) => items.replace(/<li>(.*?)<\/li>/g, '- $1\n') + '\n');
  md = md.replace(/<ol>([\s\S]*?)<\/ol>/g, (_, items) => {
    let i = 1;
    return items.replace(/<li>(.*?)<\/li>/g, () => `${i++}. $1\n`) + '\n';
  });
  md = md.replace(/<p>(.*?)<\/p>/g, '$1\n\n');
  md = md.replace(/<br\s*\/?>/g, '\n');
  md = md.replace(/&nbsp;/g, ' ');
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  return md.trim();
}

// Upload de imagem pro R2 via /api/upload
async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'upload failed');
  return data.url;
}

export default function Editor() {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ HTMLAttributes: { class: 'editor-image' } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'editor-link' } }),
      Placeholder.configure({ placeholder: 'Comece a escrever...' }),
      Typography,
    ],
    content: '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const md = htmlToMarkdown(html);
      window.dispatchEvent(new CustomEvent('editor:change', { detail: { html, md } }));
    },
  });

  // Ponte com script inline da página: expõe getters + escuta set-content + sinaliza ready
  useEffect(() => {
    if (!editor) return;

    window.__editorGetHTML = () => editor.getHTML();
    window.__editorGetMarkdown = () => htmlToMarkdown(editor.getHTML());

    const setContentHandler = (e: Event) => {
      const ev = e as CustomEvent<{ html?: string }>;
      editor.commands.setContent(ev.detail?.html || '', { emitUpdate: false });
    };
    window.addEventListener('editor:set-content', setContentHandler);

    // Sinaliza que o editor já está pronto pra receber conteúdo
    window.dispatchEvent(new Event('editor:ready'));

    return () => {
      window.removeEventListener('editor:set-content', setContentHandler);
      delete window.__editorGetHTML;
      delete window.__editorGetMarkdown;
    };
  }, [editor]);

  const handleImageUpload = async (file: File) => {
    if (!editor) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } catch (err) {
      alert('Erro ao subir imagem');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const setLink = () => {
    const url = prompt('URL do link:');
    if (!url) return;
    editor?.chain().focus().setLink({ href: url }).run();
  };

  if (!editor) return <div>Carregando editor...</div>;

  return (
    <div className="editor-wrapper">
      <div className="editor-toolbar">
        <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'is-active' : ''}>B</button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'is-active' : ''}><i>i</i></button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}>H2</button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}>H3</button>
        <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'is-active' : ''}>•</button>
        <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'is-active' : ''}>1.</button>
        <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={editor.isActive('blockquote') ? 'is-active' : ''}>"</button>
        <button onClick={() => editor.chain().focus().toggleCode().run()} className={editor.isActive('code') ? 'is-active' : ''}>{'<>'}</button>
        <button onClick={setLink}>🔗</button>
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? '⏳' : '🖼️'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageUpload(file);
            e.target.value = '';
          }}
        />
      </div>
      <EditorContent editor={editor} className="editor-content" />
    </div>
  );
}
