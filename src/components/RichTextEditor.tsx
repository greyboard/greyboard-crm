import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold, Italic, UnderlineIcon, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Undo, Redo,
  Heading2, Heading3, Minus,
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

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: placeholder ?? 'E-Mail-Text eingeben…' }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[320px] px-5 py-4 text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed prose prose-sm dark:prose-invert max-w-none',
      },
    },
  })

  if (!editor) return null

  const btn = (label: string, onClick: () => void, active: boolean, Icon: React.ElementType) => (
    <ToolbarBtn key={label} onClick={onClick} active={active} title={label}>
      <Icon size={15} />
    </ToolbarBtn>
  )

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden bg-white dark:bg-zinc-800/40">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 flex-wrap">
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
