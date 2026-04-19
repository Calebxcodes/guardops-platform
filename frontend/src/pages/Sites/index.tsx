import { useEffect, useState } from 'react'
import { Site, Client } from '../../types'
import { sitesApi, clientsApi, checklistApi, checkpointsApi } from '../../api'
import Modal from '../../components/Modal'
import { Plus, Search, Edit, Trash2, Building2, Users, PoundSterling, MapPin } from 'lucide-react'
import SiteForm from './SiteForm'
import ClientForm from './ClientForm'

export default function Sites() {
  const [sites, setSites] = useState<Site[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'sites' | 'clients'>('sites')
  const [showSiteForm, setShowSiteForm] = useState(false)
  const [showClientForm, setShowClientForm] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [editingClient, setEditingClient] = useState<Client | null>(null)

  const load = () => {
    sitesApi.list().then(setSites)
    clientsApi.list().then(setClients)
  }
  useEffect(() => { load() }, [])

  const filteredSites = sites.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.client_name?.toLowerCase().includes(search.toLowerCase())
  )
  const filteredClients = clients.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  )

  const saveSite = async (data: any) => {
    const { checklist, checkpoints, ...siteData } = data
    let site: any
    if (editingSite) {
      site = await sitesApi.update(editingSite.id, siteData)
      if (checklist !== undefined)    await checklistApi.update(editingSite.id, checklist)
      if (checkpoints !== undefined)  await checkpointsApi.update(editingSite.id, checkpoints)
    } else {
      site = await sitesApi.create(siteData)
      if (site?.id) {
        if (checklist !== undefined)   await checklistApi.update(site.id, checklist)
        if (checkpoints !== undefined) await checkpointsApi.update(site.id, checkpoints)
      }
    }
    setShowSiteForm(false); setEditingSite(null); load()
  }

  const deleteSite = async (site: Site) => {
    if (!confirm(`Delete "${site.name}"? This will deactivate the site and cannot be undone.`)) return
    await sitesApi.delete(site.id)
    load()
  }

  const saveClient = async (data: any) => {
    if (editingClient) await clientsApi.update(editingClient.id, data)
    else await clientsApi.create(data)
    setShowClientForm(false); setEditingClient(null); load()
  }

  const deleteClient = async (client: Client) => {
    if (!confirm(`Delete "${client.name}"? This will deactivate the client and all their sites.`)) return
    await clientsApi.delete(client.id)
    load()
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Sites & Clients</h1>
          <p className="text-gray-500 text-sm mt-0.5">{sites.length} sites · {clients.length} clients</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button className="btn-secondary flex items-center gap-1.5 text-sm" onClick={() => { setEditingClient(null); setShowClientForm(true) }}>
            <Plus size={15} /><span className="hidden sm:inline">Add Client</span><span className="sm:hidden">Client</span>
          </button>
          <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={() => { setEditingSite(null); setShowSiteForm(true) }}>
            <Plus size={15} /><span className="hidden sm:inline">Add Site</span><span className="sm:hidden">Site</span>
          </button>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex bg-gray-100 rounded-lg p-1 self-start">
          <button
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'sites' ? 'bg-white shadow-sm' : 'text-gray-600'}`}
            onClick={() => setView('sites')}
          >
            <MapPin size={13} className="inline mr-1" />Sites ({sites.length})
          </button>
          <button
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'clients' ? 'bg-white shadow-sm' : 'text-gray-600'}`}
            onClick={() => setView('clients')}
          >
            <Building2 size={13} className="inline mr-1" />Clients ({clients.length})
          </button>
        </div>
        <div className="relative flex-1 sm:max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 text-sm" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Sites Grid */}
      {view === 'sites' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredSites.map(site => (
            <div key={site.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{site.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{site.client_name}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    onClick={() => { setEditingSite(site); setShowSiteForm(true) }}
                  >
                    <Edit size={15} />
                  </button>
                  <button
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    onClick={() => deleteSite(site)}
                    title="Delete site"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {site.address && (
                <p className="text-xs text-gray-400 flex items-center gap-1 mb-3">
                  <MapPin size={11} />{site.address}
                </p>
              )}

              <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-blue-600 font-semibold">
                    <Users size={13} />
                    {site.guards_required}
                  </div>
                  <div className="text-xs text-gray-400">Required</div>
                </div>
                <div className="text-center">
                  <div className={`font-semibold ${(site.assigned_guards || 0) < site.guards_required ? 'text-red-500' : 'text-green-600'}`}>
                    {site.assigned_guards || 0}
                  </div>
                  <div className="text-xs text-gray-400">Today</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-0.5 text-gray-700 font-semibold">
                    <PoundSterling size={12} />
                    {site.hourly_rate}
                  </div>
                  <div className="text-xs text-gray-400">client/hr</div>
                </div>
              </div>

              {site.requirements && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-gray-500 line-clamp-2">{site.requirements}</p>
                </div>
              )}
            </div>
          ))}
          {filteredSites.length === 0 && (
            <div className="col-span-3 text-center py-12 text-gray-400">No sites found</div>
          )}
        </div>
      )}

      {/* Clients Table */}
      {view === 'clients' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Sites</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Notes</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredClients.map(client => (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{client.name}</div>
                    <div className="text-xs text-gray-400">{client.address}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{client.contact_name}</div>
                    <div className="text-xs text-gray-400">{client.contact_email}</div>
                    <div className="text-xs text-gray-400">{client.contact_phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge bg-blue-100 text-blue-700">{client.site_count} sites</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{client.notes}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        onClick={() => { setEditingClient(client); setShowClientForm(true) }}
                      >
                        <Edit size={15} />
                      </button>
                      <button
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        onClick={() => deleteClient(client)}
                        title="Delete client"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showSiteForm && (
        <Modal title={editingSite ? 'Edit Site' : 'Add New Site'} onClose={() => { setShowSiteForm(false); setEditingSite(null) }} size="lg">
          <SiteForm site={editingSite} clients={clients} onSave={saveSite} onCancel={() => { setShowSiteForm(false); setEditingSite(null) }} />
        </Modal>
      )}

      {showClientForm && (
        <Modal title={editingClient ? 'Edit Client' : 'Add New Client'} onClose={() => { setShowClientForm(false); setEditingClient(null) }}>
          <ClientForm client={editingClient} onSave={saveClient} onCancel={() => { setShowClientForm(false); setEditingClient(null) }} />
        </Modal>
      )}
    </div>
  )
}
