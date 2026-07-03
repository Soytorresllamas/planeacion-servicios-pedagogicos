import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import modeloMd from '../docs/modelo.md?raw'
import planMd from '../docs/plan.md?raw'

type DocId = 'modelo' | 'plan'
interface Doc { id: DocId; label: string; md: string }

const DOCS: Doc[] = [
  { id: 'modelo', label: 'Nuevo modelo de campaña', md: modeloMd },
  { id: 'plan', label: 'Plan 26-27 · marketing y servicios', md: planMd },
]

export default function Documentos() {
  const [id, setId] = useState<DocId>('modelo')
  const doc = DOCS.find((d) => d.id === id) ?? DOCS[0]
  return (
    <div>
      <h1>Documentos</h1>
      <div className="sub">Referencia viva del modelo y del plan. La fuente editable vive en la carpeta del comité.</div>
      <div className="seg" style={{ maxWidth: 460 }}>
        {DOCS.map((d) => (
          <button key={d.id} className={d.id === id ? 'on' : ''} onClick={() => setId(d.id)}>{d.label}</button>
        ))}
      </div>
      <div className="md">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.md}</ReactMarkdown>
      </div>
    </div>
  )
}
