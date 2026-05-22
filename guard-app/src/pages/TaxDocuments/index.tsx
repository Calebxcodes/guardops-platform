import { useState, useEffect, useRef } from 'react'
import { FileText, Upload, Trash2, Download, AlertTriangle } from 'lucide-react'
import { taxDocsApi } from '../../api'
import clsx from 'clsx'

interface TaxDoc {
  id: number
  document_type: string
  file_name: string
  file_url: string
  uploaded_by: string
  created_at: string
}

const DOC_TYPES = ['P11D', 'P9D', 'P45', 'P60', 'HMRC Letter', 'Other']

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function docTypeColour(type: string) {
  const map: Record<string, string> = {
    P11D: 'bg-blue-400/10 text-blue-400',
    P9D:  'bg-purple-400/10 text-purple-400',
    P45:  'bg-amber-400/10 text-amber-400',
    P60:  'bg-emerald-400/10 text-emerald-400',
  }
  return map[type] || 'bg-gray-700 text-gray-300'
}

export default function TaxDocuments() {
  const [docs, setDocs] = useState<TaxDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [noTenant, setNoTenant] = useState(false)

  const [showUpload, setShowUpload] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [docType, setDocType] = useState('P60')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchDocs = () => {
    taxDocsApi.list()
      .then(setDocs)
      .catch(err => { if (err.response?.status === 403) setNoTenant(true) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchDocs() }, [])

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      await taxDocsApi.upload(file, docType)
      setFile(null)
      setShowUpload(false)
      fetchDocs()
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this document? This cannot be undone.')) return
    try {
      await taxDocsApi.delete(id)
      setDocs(d => d.filter(doc => doc.id !== id))
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (noTenant) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 gap-4">
        <AlertTriangle size={40} className="text-amber-400" />
        <p className="text-white text-center font-medium">Tax documents require a company account.</p>
        <p className="text-gray-400 text-sm text-center">Please log out and log back in using your company credentials.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface pb-28">
      <div className="px-4 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-bold">Tax Documents</h1>
          <p className="text-gray-400 text-sm mt-0.5">P11D, P60, and other HMRC forms</p>
        </div>
        <button
          onClick={() => { setShowUpload(v => !v); setUploadError('') }}
          className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          + Upload
        </button>
      </div>

      {/* Upload panel */}
      {showUpload && (
        <div className="mx-4 mb-4 bg-gray-800 rounded-2xl p-4 space-y-3">
          <h2 className="text-white font-semibold text-sm">Upload Document</h2>

          <div>
            <label className="text-gray-400 text-xs font-medium block mb-1">Document Type</label>
            <select
              value={docType}
              onChange={e => setDocType(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500"
            >
              {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="text-gray-400 text-xs font-medium block mb-1">File</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className={clsx(
                'border border-dashed rounded-xl px-4 py-4 flex items-center gap-3 cursor-pointer transition-colors',
                file ? 'border-brand-500/50 bg-brand-500/5' : 'border-gray-600 hover:border-gray-500'
              )}
            >
              <FileText size={20} className={file ? 'text-brand-400' : 'text-gray-500'} />
              <span className={clsx('text-sm truncate', file ? 'text-white' : 'text-gray-500')}>
                {file ? file.name : 'Tap to select file (PDF, image)'}
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              className="hidden"
              onChange={e => { setFile(e.target.files?.[0] || null); setUploadError('') }}
            />
          </div>

          {uploadError && (
            <div className="bg-red-900/30 border border-red-500/30 rounded-xl px-3 py-2 text-red-400 text-sm">
              {uploadError}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="flex-1 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
            >
              {uploading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading...</>
              ) : (
                <><Upload size={14} /> Upload</>
              )}
            </button>
            <button
              onClick={() => { setShowUpload(false); setFile(null) }}
              className="px-4 py-2.5 rounded-xl border border-gray-600 text-gray-400 text-sm hover:border-gray-500 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Documents list */}
      <div className="px-4 space-y-3">
        {docs.length === 0 ? (
          <div className="bg-gray-800 rounded-2xl p-6 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 bg-gray-700 rounded-full flex items-center justify-center">
              <FileText size={24} className="text-gray-500" />
            </div>
            <p className="text-white font-medium">No documents yet</p>
            <p className="text-gray-400 text-sm">Upload your P60, P11D, or other tax documents here.</p>
          </div>
        ) : (
          docs.map(doc => (
            <div key={doc.id} className="bg-gray-800 rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center shrink-0">
                <FileText size={18} className="text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{doc.file_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={clsx('text-xs px-1.5 py-0.5 rounded-md font-medium', docTypeColour(doc.document_type))}>
                    {doc.document_type}
                  </span>
                  <span className="text-gray-500 text-xs">{fmt(doc.created_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-brand-400 transition-colors"
                >
                  <Download size={16} />
                </a>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
