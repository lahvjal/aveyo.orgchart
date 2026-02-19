import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'
import { cn } from '../../lib/utils'

interface JobDescriptionEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  minRows?: number
}

export function JobDescriptionEditor({
  value,
  onChange,
  placeholder = 'Describe your role and responsibilities...',
  className,
  disabled = false,
  minRows = 4,
}: JobDescriptionEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bold: false,
        italic: false,
        strike: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        heading: false,
        horizontalRule: false,
      }),
    ],
    content: value || '',
    editable: !disabled,
    editorProps: {
      attributes: {
        'data-placeholder': placeholder,
        class: 'focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.isEmpty ? '' : editor.getHTML()
      onChange(html)
    },
  })

  // Sync external value changes (e.g. when profile loads asynchronously)
  useEffect(() => {
    if (!editor) return
    const currentHTML = editor.isEmpty ? '' : editor.getHTML()
    if (value !== currentHTML) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [value, editor])

  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled)
    }
  }, [disabled, editor])

  return (
    <div
      className={cn(
        'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
        'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-text',
        'job-description-editor',
        className
      )}
      style={{ minHeight: `${minRows * 1.5 + 0.5}rem` }}
      onClick={() => editor?.commands.focus()}
    >
      <EditorContent editor={editor} className="h-full" />
    </div>
  )
}
