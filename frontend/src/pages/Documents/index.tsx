import { useEffect, useState, useRef } from 'react'
import { documentsApi, sitesApi } from '../../api'
import { Site } from '../../types'
import Modal from '../../components/Modal'
import {
  Upload, Trash2, Download, FolderOpen, FileText, Search,
  Plus, Eye, EyeOff, Filter, File,
} from 'lucide-react'

interface Document {
  id: number
  name: string
  original_name: string
  category: string
  site_id: number | null
  site_name: string | null
  mime_type: string
  size: number
  description: string | null
  is_guard_visible: number
  created_at: string
  uploaded_by_name: string | null
}

const CATEGORIES = [
  { value: 'policy',     label: 'Policy',        color: 'bg-blue-100 text-blue-700' },
  { value: 'training',   label: 'Training',      color: 'bg-green-100 text-green-700' },
  { value: 'sop',        label: 'SOP',           color: 'bg-purple-100 text-purple-700' },
  { value: 'compliance', label: 'Compliance',    color: 'bg-orange-100 text-orange-700' },
  { value: 'general',    label: 'General',       color: 'bg-gray-100 text-gray-700' },
]

function categoryStyle(cat: string) {
  return CATEGORIES.find(c => c.value === cat)?.color ?? 'bg-gray-100 text-gray-600'
}
function categoryLabel(cat: string) {
  return CATEGORIES.find(c => c.value === cat)?.label ?? cat
}

function formatSize(bytes: number) {
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

function fileIcon(mime: string) {
  if (mime?.startsWith('image/'))              return '🖼️'
  if (mime === 'application/pdf')              return '📄'
  if (mime?.includes('word'))                  return '📝'
  if (mime?.includes('excel') || mime?.includes('spreadsheet')) return '📊'
  return '📎'
}

export default function Documents() {
  const [docs, setDocs]       = useState<Document[]>([])
  const [sites, setSites]     = useState<Site[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch]   = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [showUpload, setShowUpload] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [d, s] = await Promise.all([documentsApi.list(), sitesApi.list()])
      setDocs(d)
      setSites(s)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = docs.filter(d => {
    if (filterCat && d.category !== filterCat) return false
    if (search) {
      const q = search.toLowerCase()
      return d.name.toLowerCase().includes(q) ||
             d.site_name?.toLowerCase().includes(q) ||
             d.category.toLowerCase().includes(q)
    }
    return true
  })

  const grouped = CATEGORIES.reduce<Record<string, Document[]>>((acc, cat) => {
    acc[cat.value] = filtered.filter(d => d.category === cat.value)
    return acc
  }, {})

  const deleteDoc = async (doc: Document) => {
    if (!confirm(`Delete "${doc.name}"? This cannot be undone.`)) return
    await documentsApi.delete(doc.id)
    load()
  }

  const toggleVisibility = async (doc: Document) => {
    await documentsApi.update(doc.id, { is_guard_visible: !doc.is_guard_visible })
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, is_guard_visible: d.is_guard_visible ? 0 : 1 } : d))
  }

  const downloadToken = (id: number) => {
    const base = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'
    const token = localStorage.getItem('admin_token')
    // Open download in new tab — browser will send cookie/header; we use a fetch workaround
    return `${base}/documents/${id}/download?token=${token}`
  }

  const handleDownload = async (doc: Document) => {
    const base = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'
    const token = localStorage.getItem('admin_token')
    const res = await fetch(`${base}/documents/${doc.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return alert('Download failed')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = doc.original_name; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Documents</h1>
          <p className="text-gray-500 text-sm mt-0.5">{docs.length} documents · {docs.filter(d => d.is_guard_visible).length} guard-visible</p>
        </div>
        <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={() => setShowUpload(true)}>
          <Plus size={15} /> Upload
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 text-sm" placeholder="Search documents…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${!filterCat ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            onClick={() => setFilterCat('')}
          >
            <Filter size={13} /> All
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${filterCat === c.value ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              onClick={() => setFilterCat(v => v === c.value ? '' : c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <FolderOpen size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No documents found</p>
          <p className="text-gray-400 text-sm mt-1">Upload training materials, policies, or SOPs for your team.</p>
          <button className="btn-primary mt-4 text-sm" onClick={() => setShowUpload(true)}>
            <Upload size={14} className="inline mr-1.5" />Upload Document
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {CATEGORIES.map(cat => {
            const catDocs = grouped[cat.value]
            if (filterCat && filterCat !== cat.value) return null
            if (catDocs.length === 0) return null
            return (
              <div key={cat.value}>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.color}`}>{cat.label}</span>
                  <span className="text-gray-300">·</span>
                  <span>{catDocs.length} {catDocs.length === 1 ? 'file' : 'files'}</span>
                </h2>
                <div className="card overflow-hidden divide-y divide-gray-100">
                  {catDocs.map(doc => (
                    <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 group">
                      <span className="text-xl shrink-0">{fileIcon(doc.mime_type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{doc.name}</span>
                          {doc.site_name && (
                            <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded shrink-0">{doc.site_name}</span>
                          )}
                          {!doc.is_guard_visible && (
                            <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                              <EyeOff size={10} /> Hidden
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>{doc.original_name}</span>
                          <span>·</span>
                          <span>{formatSize(doc.size)}</span>
                          {doc.description && <><span>·</span><span className="truncate max-w-xs">{doc.description}</span></>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          title={doc.is_guard_visible ? 'Hide from guards' : 'Show to guards'}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
                          onClick={() => toggleVisibility(doc)}
                        >
                          {doc.is_guard_visible ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button
                          title="Download"
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          onClick={() => handleDownload(doc)}
                        >
                          <Download size={14} />
                        </button>
                        <button
                          title="Delete"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          onClick={() => deleteDoc(doc)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showUpload && (
        <Modal title="Upload Document" onClose={() => setShowUpload(false)}>
          <UploadForm sites={sites} onDone={() => { setShowUpload(false); load() }} />
        </Modal>
      )}
    </div>
  )
}

function UploadForm({ sites, onDone }: { sites: Site[]; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile]           = useState<File | null>(null)
  const [name, setName]           = useState('')
  const [category, setCategory]   = useState('general')
  const [siteId, setSiteId]       = useState('')
  const [description, setDesc]    = useState('')
  const [guardVisible, setGuardVisible] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState('')

  const handleFile = (f: File) => {
    setFile(f)
    if (!name) setName(f.name.replace(/\.[^.]+$/, ''))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    setUploading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('name', name || file.name)
      fd.append('category', category)
      if (siteId) fd.append('site_id', siteId)
      if (description) fd.append('description', description)
      fd.append('is_guard_visible', String(guardVisible))
      await documentsApi.upload(fd)
      onDone()
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Upload failed — please try again')
    } finally { setUploading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          file ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      >
        <input ref={fileRef} type="file" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        {file ? (
          <>
            <span className="text-3xl">{fileIcon(file.type)}</span>
            <p className="mt-2 font-medium text-sm text-gray-800">{file.name}</p>
            <p className="text-xs text-gray-500">{formatSize(file.size)}</p>
          </>
        ) : (
          <>
            <File size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-600 font-medium">Click or drag & drop to upload</p>
            <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, images · max 25 MB</p>
          </>
        )}
      </div>

      <div>
        <label className="label">Document Name *</label>
        <input className="input" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Fire Safety Policy 2025" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Category *</label>
          <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Site (optional)</label>
          <select className="input" value={siteId} onChange={e => setSiteId(e.target.value)}>
            <option value="">All sites (global)</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Description</label>
        <input className="input" value={description} onChange={e => setDesc(e.target.value)} placeholder="Brief description (optional)" />
      </div>

      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input type="checkbox" className="w-4 h-4 rounded" checked={guardVisible} onChange={e => setGuardVisible(e.target.checked)} />
        <div>
          <p className="text-sm font-medium">Visible to guards</p>
          <p className="text-xs text-gray-400">Guards will see this document in their app</p>
        </div>
      </label>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>}

      <div className="flex justify-end gap-3 pt-1">
        <button type="button" className="btn-secondary" onClick={() => onDone()}>Cancel</button>
        <button type="submit" disabled={!file || uploading} className="btn-primary disabled:opacity-50">
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </form>
  )
}
