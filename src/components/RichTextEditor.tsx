import { useState, useRef, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import {
  Bold, Italic, UnderlineIcon, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Undo, Redo,
  Heading2, Heading3, Minus, Link2, Link2Off, ExternalLink,
} from 'lucide-react'

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

function ToolbarBtn({
  onClick, active, title, children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-zinc-200 dark:bg-zinc-600 text-zinc-900 dark:text-zinc-100'
          : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-100'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />
}

// Encode UTM values but leave {{placeholders}} unencoded so substitute() can resolve them
function encUTM(v: string): string {
  return v.replace(/\{\{[\w.]+\}\}|[^{}]+/g, seg =>
    seg.startsWith('{{') ? seg : encodeURIComponent(seg)
  )
}

function buildUrl(base: string, utm: { source: string; medium: string; campaign: string; content: string }) {
  if (!base) return ''
  const b = base.startsWith('http') ? base : `https://${base}`
  const parts: string[] = []
  if (utm.source)   parts.push(`utm_source=${encUTM(utm.source)}`)
  if (utm.medium)   parts.push(`utm_medium=${encUTM(utm.medium)}`)
  if (utm.campaign) parts.push(`utm_campaign=${encUTM(utm.campaign)}`)
  if (utm.content)  parts.push(`utm_content=${encUTM(utm.content)}`)
  if (!parts.length) return b
  return b + (b.includes('?') ? '&' : '?') + parts.join('&')
}

// ── Link-Panel ─────────────────────────────────────────────────────────────────
function LinkPanel({
  initialUrl,
  onApply,
  onRemove,
  onClose,
}: {
  initialUrl: string
  onApply: (url: string) => void
  onRemove: () => void
  onClose: () => void
}) {
  const [base, setBase] = useState(() => {
    if (!initialUrl) return ''
    return initialUrl
      .replace(/[?&]utm_(?:source|medium|campaign|content)=[^&]*/g, '')
      .replace(/[?&]$/, '')
      || initialUrl
  })
  const [utm, setUtm] = useState(() => {
    const get = (name: string) => {
      const m = initialUrl.match(new RegExp(`[?&]${name}=([^&]*)`))
      return m ? decodeURIComponent(m[1]) : ''
    }
    return {
      source:   get('utm_source'),
      medium:   get('utm_medium'),
      campaign: get('utm_campaign'),
      content:  get('utm_content'),
    }
  })

  const preview = buildUrl(base, utm)
  const inputCls = 'w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors font-mono'
  const labelCls = 'text-xs text-zinc-400 dark:text-zinc-500 mb-1'

  return (
    <div
      className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-4 w-[380px] flex flex-col gap-3"
    >
      {/* URL */}
      <div>
        <p className={labelCls}>URL</p>
        <input
          autoFocus
          type="text"
          value={base}
          onChange={e => setBase(e.target.value)}
          placeholder="https://beispiel.de/seite"
          className={inputCls}
        />
      </div>

      {/* UTM */}
      <div>
        <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">UTM-Parameter</p>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['source',   'utm_source',   'z.B. newsletter'],
            ['medium',   'utm_medium',   'z.B. email'],
            ['campaign', 'utm_campaign', 'z.B. herbst-2025'],
            ['content',  'utm_content',  'z.B. cta-button'],
          ] as const).map(([key, param, ph]) => (
            <div key={key}>
              <p className="text-xs text-zinc-400 dark:text-zinc-600 mb-1">{param}</p>
              <input
                type="text"
                value={utm[key]}
                onChange={e => setUtm(p => ({ ...p, [key]: e.target.value }))}
                placeholder={ph}
                className={inputCls}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Vorschau */}
      {preview && (
        <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-700 rounded-lg px-3 py-2">
          <p className="text-xs text-zinc-400 mb-1">Ziel-URL</p>
          <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400 break-all">{preview}</p>
        </div>
      )}

      {/* Aktionen */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-red-500 transition-colors"
        >
          <Link2Off size={13} />
          Link entfernen
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors border border-zinc-200 dark:border-zinc-700"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => { if (preview) { onApply(preview); onClose() } }}
            disabled={!preview}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition-colors"
          >
            Übernehmen
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Hauptkomponente ────────────────────────────────────────────────────────────
export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const [linkOpen, setLinkOpen] = useState(false)
  const linkBtnRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: placeholder ?? 'E-Mail-Text eingeben…' }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer' } }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[320px] px-5 py-4 text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed prose prose-sm dark:prose-invert max-w-none',
      },
    },
  })

  // Panel schließen bei Klick außerhalb
  useEffect(() => {
    if (!linkOpen) return
    function handler(e: MouseEvent) {
      if (linkBtnRef.current && !linkBtnRef.current.contains(e.target as Node)) {
        setLinkOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [linkOpen])

  if (!editor) return null

  const btn = (label: string, onClick: () => void, active: boolean, Icon: React.ElementType) => (
    <ToolbarBtn key={label} onClick={onClick} active={active} title={label}>
      <Icon size={15} />
    </ToolbarBtn>
  )

  const currentUrl = editor.getAttributes('link').href ?? ''
  const isLinkActive = editor.isActive('link')

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-visible bg-white dark:bg-zinc-800/40">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 flex-wrap rounded-t-xl">
        {btn('Fett', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'), Bold)}
        {btn('Kursiv', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'), Italic)}
        {btn('Unterstrichen', () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'), UnderlineIcon)}
        <Divider />
        {btn('Überschrift 2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }), Heading2)}
        {btn('Überschrift 3', () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }), Heading3)}
        <Divider />
        {btn('Aufzählung', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'), List)}
        {btn('Nummerierte Liste', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'), ListOrdered)}
        <Divider />
        {btn('Linksbündig', () => editor.chain().focus().setTextAlign('left').run(), editor.isActive({ textAlign: 'left' }), AlignLeft)}
        {btn('Zentriert', () => editor.chain().focus().setTextAlign('center').run(), editor.isActive({ textAlign: 'center' }), AlignCenter)}
        {btn('Rechtsbündig', () => editor.chain().focus().setTextAlign('right').run(), editor.isActive({ textAlign: 'right' }), AlignRight)}
        <Divider />
        {btn('Trennlinie', () => editor.chain().focus().setHorizontalRule().run(), false, Minus)}
        <Divider />

        {/* Link */}
        <div className="relative" ref={linkBtnRef}>
          <ToolbarBtn
            onClick={() => setLinkOpen(o => !o)}
            active={isLinkActive || linkOpen}
            title="Link bearbeiten"
          >
            <Link2 size={15} />
          </ToolbarBtn>
          {linkOpen && (
            <LinkPanel
              initialUrl={currentUrl}
              onApply={url => {
                editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
              }}
              onRemove={() => {
                editor.chain().focus().extendMarkRange('link').unsetLink().run()
                setLinkOpen(false)
              }}
              onClose={() => setLinkOpen(false)}
            />
          )}
        </div>

        {/* Link-Vorschau wenn aktiv */}
        {isLinkActive && currentUrl && (
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-mono text-emerald-600 dark:text-emerald-400 hover:underline truncate max-w-[200px] px-1"
            title={currentUrl}
          >
            <ExternalLink size={11} className="shrink-0" />
            <span className="truncate">{currentUrl.replace(/^https?:\/\//, '')}</span>
          </a>
        )}

        <Divider />
        {btn('Rückgängig', () => editor.chain().focus().undo().run(), false, Undo)}
        {btn('Wiederholen', () => editor.chain().focus().redo().run(), false, Redo)}

        <Divider />
        <div className="relative group">
          <button
            type="button"
            className="px-2 py-1 text-xs font-mono rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
            title="Platzhalter einfügen"
          >
            {'{{ }}'}
          </button>
          <div className="absolute top-full left-0 mt-1 hidden group-focus-within:flex group-hover:flex flex-col bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-10 min-w-[180px] py-1">
            {[
              ['{{anrede}}',       'Dynamische Anrede'],
              ['{{salutation}}',   'Anrede (Du/Sie)'],
              ['{{first_name}}',   'Vorname'],
              ['{{last_name}}',    'Nachname'],
              ['{{full_name}}',    'Vollständiger Name'],
              ['{{company_name}}', 'Firmenname'],
              ['{{industry}}',     'Branche'],
              ['{{website}}',      'Website'],
              ['{{email}}',        'E-Mail'],
              ['{{phone}}',        'Telefon'],
              ['{{city}}',         'Stadt'],
              ['{{postal_code}}',  'PLZ'],
              ['{{country}}',      'Land'],
              ['{{address}}',      'Straße'],
              ['{{icebreaker}}',   'Eisbrecher-Text'],
              ['{{id}}',           'Contact ID'],
              ['{{ghl_id}}',       'GHL ID'],
            ].map(([tag, label]) => (
              <button
                key={tag}
                type="button"
                onMouseDown={e => {
                  e.preventDefault()
                  editor.chain().focus().insertContent(tag).run()
                }}
                className="text-left px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
              >
                <span className="font-mono text-emerald-600 dark:text-emerald-400">{tag}</span>
                <span className="text-zinc-400 ml-2">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  )
}
