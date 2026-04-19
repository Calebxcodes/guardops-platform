import { useEffect, useState } from 'react'
import { documentsApi } from '../../api'
import { Download, FolderOpen, Loader, RefreshCw } from 'lucide-react'
import Card from '../../components/ui/Card'

interface Doc {
  id: number
  name: string
  original_name: string
  category: string
  site_name: string | null
  mime_type: string
  size: number
  description: string | null
  created_at: string
}

const CATEGORY_LABELS: Record<string, string> = {
  policy:     'Policy',
  training:   'Training',
  sop:        'SOP',
  compliance: 'Compliance',
  general:    'General',
}

const CATEGORY_COLORS: Record<string, string> = {
  policy:     'bg-blue-600/20 text-blue-300',
  training:   'bg-green-600/20 text-green-300',
  sop:        'bg-purple-600/20 text-purple-300',
  compliance: 'bg-orange-600/20 text-orange-300',
  general:    'bg-white/10 text-white/50',
}

function fileIcon(mime: string) {
  if (mime?.startsWith('image/'))   return '🖼️'
  if (mime === 'application/pdf')   return '📄'
  if (mime?.includes('word'))       return '📝'
  if (mime?.includes('sheet'))      return '📊'
  return '📎'
}

function formatSize(bytes: number) {
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

export default function DocumentsPage() {
  const [docs, setDocs]       = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    try { setDocs(await documentsApi.list()) }
    catch { /* no docs */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleDownload = async (doc: Doc) => {
    setDownloading(doc.id)
    try { await documentsApi.download(doc.id, doc.original_name) }
    catch { /* ignore */ }
    finally { setDownloading(null) }
  }

  const categories = Object.keys(CATEGORY_LABELS).filter(cat =>
    docs.some(d => d.category === cat)
  )

  return (
    <div className="min-h-screen bg-surface px-4 pt-14 pb-4 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Documents</h1>
        <button onClick={load} className="text-white/30 hover:text-white/60 p-1">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader size={24} className="text-white/20 animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <Card className="p-10 text-center">
          <FolderOpen size={36} className="text-white/10 mx-auto mb-3" />
          <p className="text-white/30">No documents available</p>
          <p className="text-white/20 text-xs mt-1">Your manager hasn't shared any documents yet.</p>
        </Card>
      ) : (
        <div className="space-y-5">
          {categories.map(cat => {
            const catDocs = docs.filter(d => d.category === cat)
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[cat] || 'bg-white/10 text-white/50'}`}>
                    {CATEGORY_LABELS[cat] || cat}
                  </span>
                  <span className="text-white/20 text-xs">{catDocs.length} {catDocs.length === 1 ? 'file' : 'files'}</span>
                </div>
                <div className="space-y-2">
                  {catDocs.map(doc => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-3.5 rounded-2xl bg-surface-elevated border border-white/5"
                    >
                      <span className="text-2xl shrink-0">{fileIcon(doc.mime_type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-white truncate">{doc.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-white/30 text-xs flex-wrap">
                          {doc.site_name && <span className="text-brand-400/70">{doc.site_name}</span>}
                          {doc.site_name && <span>·</span>}
                          <span>{formatSize(doc.size)}</span>
                          {doc.description && <><span>·</span><span className="truncate">{doc.description}</span></>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownload(doc)}
                        disabled={downloading === doc.id}
                        className="shrink-0 p-2 rounded-xl bg-brand-600/20 text-brand-400 hover:bg-brand-600/30 disabled:opacity-50 transition-colors"
                      >
                        {downloading === doc.id
                          ? <Loader size={16} className="animate-spin" />
                          : <Download size={16} />
                        }
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
