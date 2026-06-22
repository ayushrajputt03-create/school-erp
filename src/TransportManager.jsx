import React, { useEffect, useState } from 'react'
import {
  AlertTriangle, BusFront, Car, Check, Download, Edit3, FileText,
  MapPinned, Phone, Plus, Printer, Route, Search, Trash2, Upload, UserRound,
} from 'lucide-react'
import DatePicker from './DatePicker'

const today = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}
const monthLabel = value => {
  const raw = value || today().slice(0, 7)
  return new Date(`${raw}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}
const dateLabel = value => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
const money = value => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`
const values = object => Object.values(object || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
const studentPhoto = student => student?.photoUrl || student?.photoURL || student?.photo || ''
const classParts = value => {
  const match = String(value || '').match(/^(.+?)\s*[-/]\s*([A-Za-z0-9]+)$/)
  return match ? { className: match[1].trim(), section: match[2].trim() } : { className: String(value || '').trim(), section: '' }
}
const fileToDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('Could not read file.'))
  reader.readAsDataURL(file)
})
const routeNumber = routes => `RT-${String(Math.max(0, ...values(routes).map(item => Number(String(item.routeNumber || '').match(/(\d+)$/)?.[1] || 0))) + 1).padStart(3, '0')}`
const expiringIn = date => {
  if (!date) return null
  return Math.ceil((new Date(`${date}T00:00:00`) - new Date(`${today()}T00:00:00`)) / 86400000)
}
const alertClass = days => days !== null && days <= 15 ? 'danger' : days !== null && days <= 30 ? 'warn' : ''
const activeRoutes = transport => values(transport.routes)
const activeVehicles = transport => values(transport.vehicles)
const activeDrivers = transport => values(transport.drivers)
const routeById = (transport, id) => transport.routes?.[id]
const vehicleById = (transport, id) => transport.vehicles?.[id]
const driverById = (transport, id) => transport.drivers?.[id]
const allocations = transport => values(transport.allocations)
const fees = transport => values(transport.fees)

function classOptions(students) {
  return [...new Set(students.map(student => classParts(student.className).className).filter(Boolean))]
}

function stopDefaults() {
  return [
    { name: 'School Gate', time: '07:30', distance: 0 },
    { name: '', time: '07:45', distance: 0 },
  ]
}

function TransportTabs({ tab, setTab }) {
  const tabs = [
    ['routes', 'Routes', Route],
    ['vehicles', 'Vehicles', BusFront],
    ['drivers', 'Drivers', UserRound],
    ['allocation', 'Student Allocation', MapPinned],
    ['fees', 'Fee Collection', FileText],
    ['attendance', 'Attendance', Check],
    ['reports', 'Reports', Download],
  ]
  return <div className="transport-tabs">{tabs.map(([id, label, Icon]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={15} /> {label}</button>)}</div>
}

function StatusBadge({ children, status }) {
  return <span className={`transport-badge ${String(status || children).toLowerCase().replace(/\s+/g, '-')}`}>{children}</span>
}

function RouteStopsEditor({ stops, setStops }) {
  const update = (index, patch) => setStops(stops.map((stop, i) => i === index ? { ...stop, ...patch } : stop))
  const totalDistance = Math.max(0, ...stops.map(stop => Number(stop.distance || 0)))
  return <div className="transport-stops">
    <div className="transport-stop-head"><strong>Stop Name</strong><strong>Arrival Time</strong><strong>Distance</strong><span /></div>
    {stops.map((stop, index) => <div className="transport-stop-row" key={index}>
      <input value={stop.name} onChange={event => update(index, { name: event.target.value })} placeholder="MP Nagar" />
      <input type="time" value={stop.time} onChange={event => update(index, { time: event.target.value })} />
      <input type="number" min="0" value={stop.distance} onChange={event => update(index, { distance: Number(event.target.value) })} placeholder="0" />
      <button type="button" className="icon-button danger" onClick={() => setStops(stops.filter((_, i) => i !== index))}><Trash2 size={14} /></button>
    </div>)}
    <div className="transport-stop-actions"><button type="button" className="secondary-button" onClick={() => setStops([...stops, { name: '', time: '', distance: totalDistance }])}><Plus size={14} /> Add Stop</button><strong>Total Distance: {totalDistance} km</strong></div>
  </div>
}

function RoutesPage({ transport, saveItem, deleteItem }) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [stops, setStops] = useState(stopDefaults())
  const [form, setForm] = useState({ routeName: '', routeNumber: routeNumber(transport.routes), vehicleId: '', driverId: '' })
  const rows = activeRoutes(transport).filter(item => `${item.routeName} ${(item.stops || []).map(stop => stop.name).join(' ')}`.toLowerCase().includes(query.toLowerCase()))
  const startEdit = item => {
    setEditing(item)
    setForm({ ...item })
    setStops(item.stops?.length ? item.stops : stopDefaults())
  }
  const submit = async event => {
    event.preventDefault()
    const totalDistance = Math.max(0, ...stops.map(stop => Number(stop.distance || 0)))
    await saveItem('routes', { ...form, id: editing?.id, stops, totalDistance, totalStops: stops.length })
    setEditing(null)
    setForm({ routeName: '', routeNumber: routeNumber(transport.routes), vehicleId: '', driverId: '' })
    setStops(stopDefaults())
  }
  return <div className="transport-page">
    <section className="panel transport-form-panel">
      <div className="panel-header"><div><h3>{editing ? 'Edit Route' : 'Add Route'}</h3><p>Create routes with stops, timings and distance.</p></div></div>
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>Route Name*<input required value={form.routeName} onChange={event => setForm({ ...form, routeName: event.target.value })} placeholder="Route 1 - Civil Lines" /></label>
          <label>Route Number*<input required value={form.routeNumber} onChange={event => setForm({ ...form, routeNumber: event.target.value })} /></label>
          <label>Vehicle Assigned<select value={form.vehicleId || ''} onChange={event => setForm({ ...form, vehicleId: event.target.value })}><option value="">Select vehicle</option>{activeVehicles(transport).map(item => <option key={item.id} value={item.id}>{item.vehicleNumber}</option>)}</select></label>
          <label>Driver Assigned<select value={form.driverId || ''} onChange={event => setForm({ ...form, driverId: event.target.value })}><option value="">Select driver</option>{activeDrivers(transport).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        </div>
        <RouteStopsEditor stops={stops} setStops={setStops} />
        <div className="modal-actions"><button className="primary-button"><Plus size={15} /> Save Route</button>{editing && <button type="button" className="secondary-button" onClick={() => setEditing(null)}>Cancel</button>}</div>
      </form>
    </section>
    <section className="panel table-panel">
      <div className="panel-header"><div><h3>Route List</h3><p>Search by route name or area.</p></div><div className="table-search"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search route / area" /></div></div>
      <div className="table-scroll"><table><thead><tr><th>#</th><th>Route</th><th>Areas Covered</th><th>Stops</th><th>Distance</th><th>Vehicle</th><th>Driver</th><th>Students</th><th>Actions</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td><strong>{row.routeName}</strong><small>{row.routeNumber}</small></td><td>{(row.stops || []).map(stop => stop.name).filter(Boolean).join(', ') || '-'}</td><td>{row.totalStops || row.stops?.length || 0}</td><td>{row.totalDistance || 0} km</td><td>{vehicleById(transport, row.vehicleId)?.vehicleNumber || '-'}</td><td>{driverById(transport, row.driverId)?.name || '-'}</td><td>{allocations(transport).filter(item => item.routeId === row.id).length}</td><td><button className="icon-button" onClick={() => startEdit(row)}><Edit3 size={14} /></button><button className="icon-button danger" onClick={() => deleteItem('routes', row.id)}><Trash2 size={14} /></button></td></tr>)}{!rows.length && <tr><td colSpan="9"><div className="empty-state">No route found.</div></td></tr>}</tbody></table></div>
    </section>
  </div>
}

function VehiclesPage({ transport, saveItem, deleteItem }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ vehicleNumber: '', type: 'Bus', capacity: 40, status: 'Active', insuranceExpiry: today(), fitnessExpiry: today(), pucExpiry: today(), routeId: '', driverId: '' })
  const rows = activeVehicles(transport).filter(item => (status === 'All' || item.status === status) && `${item.vehicleNumber} ${item.type} ${item.rcNumber}`.toLowerCase().includes(query.toLowerCase()))
  const submit = async event => {
    event.preventDefault()
    await saveItem('vehicles', { ...form, id: editing?.id })
    setEditing(null)
    setForm({ vehicleNumber: '', type: 'Bus', capacity: 40, status: 'Active', insuranceExpiry: today(), fitnessExpiry: today(), pucExpiry: today(), routeId: '', driverId: '' })
  }
  return <div className="transport-page">
    <section className="panel transport-form-panel"><div className="panel-header"><div><h3>{editing ? 'Edit Vehicle' : 'Add Vehicle'}</h3><p>Manage bus documents and route assignments.</p></div></div>
      <form onSubmit={submit}><div className="form-grid">
        <label>Vehicle Number*<input required value={form.vehicleNumber} onChange={e => setForm({ ...form, vehicleNumber: e.target.value })} placeholder="MP04 AB 1234" /></label>
        <label>Vehicle Type*<select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{['Bus','Mini Bus','Van','Car'].map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Manufacturer<input value={form.manufacturer || ''} onChange={e => setForm({ ...form, manufacturer: e.target.value })} /></label>
        <label>Model Name<input value={form.modelName || ''} onChange={e => setForm({ ...form, modelName: e.target.value })} /></label>
        <label>Year<input value={form.year || ''} onChange={e => setForm({ ...form, year: e.target.value })} /></label>
        <label>Seating Capacity*<input required type="number" min="1" value={form.capacity} onChange={e => setForm({ ...form, capacity: Number(e.target.value) })} /></label>
        <label>Vehicle Color<input value={form.color || ''} onChange={e => setForm({ ...form, color: e.target.value })} /></label>
        <label>RC Number<input value={form.rcNumber || ''} onChange={e => setForm({ ...form, rcNumber: e.target.value })} /></label>
        <label>RC Expiry<DatePicker value={form.rcExpiry || ''} onChange={value => setForm({ ...form, rcExpiry: value })} /></label>
        <label>Insurance Company<input value={form.insuranceCompany || ''} onChange={e => setForm({ ...form, insuranceCompany: e.target.value })} /></label>
        <label>Insurance Number<input value={form.insuranceNumber || ''} onChange={e => setForm({ ...form, insuranceNumber: e.target.value })} /></label>
        <label>Insurance Expiry*<DatePicker value={form.insuranceExpiry} onChange={value => setForm({ ...form, insuranceExpiry: value })} /></label>
        <label>Fitness Certificate No<input value={form.fitnessNo || ''} onChange={e => setForm({ ...form, fitnessNo: e.target.value })} /></label>
        <label>Fitness Expiry*<DatePicker value={form.fitnessExpiry} onChange={value => setForm({ ...form, fitnessExpiry: value })} /></label>
        <label>Pollution Certificate No<input value={form.pucNo || ''} onChange={e => setForm({ ...form, pucNo: e.target.value })} /></label>
        <label>PUC Expiry<DatePicker value={form.pucExpiry || ''} onChange={value => setForm({ ...form, pucExpiry: value })} /></label>
        <label>Route Assigned<select value={form.routeId || ''} onChange={e => setForm({ ...form, routeId: e.target.value })}><option value="">Select route</option>{activeRoutes(transport).map(item => <option key={item.id} value={item.id}>{item.routeName}</option>)}</select></label>
        <label>Driver Assigned<select value={form.driverId || ''} onChange={e => setForm({ ...form, driverId: e.target.value })}><option value="">Select driver</option>{activeDrivers(transport).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>Active</option><option>Under Maintenance</option></select></label>
        <label>GPS Device ID<input value={form.gpsId || ''} onChange={e => setForm({ ...form, gpsId: e.target.value })} /></label>
      </div><div className="modal-actions"><button className="primary-button"><Car size={15} /> Save Vehicle</button>{editing && <button type="button" className="secondary-button" onClick={() => setEditing(null)}>Cancel</button>}</div></form>
    </section>
    <section className="panel table-panel"><div className="panel-header"><div><h3>Vehicle List</h3><p>Track capacity, routes and document expiries.</p></div><div className="transport-filter-row"><select value={status} onChange={e => setStatus(e.target.value)}><option>All</option><option>Active</option><option>Under Maintenance</option></select><div className="table-search"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search vehicle" /></div></div></div>
      <div className="table-scroll"><table><thead><tr><th>#</th><th>Vehicle</th><th>Type</th><th>Capacity</th><th>Route</th><th>Driver</th><th>Insurance</th><th>Fitness</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((row, index) => { const ins = expiringIn(row.insuranceExpiry); const fit = expiringIn(row.fitnessExpiry); return <tr key={row.id}><td>{index + 1}</td><td><strong>{row.vehicleNumber}</strong><small>{row.rcNumber || 'No RC'}</small></td><td>{row.type}</td><td>{row.capacity}</td><td>{routeById(transport, row.routeId)?.routeName || '-'}</td><td>{driverById(transport, row.driverId)?.name || '-'}</td><td><span className={`transport-alert ${alertClass(ins)}`}>{dateLabel(row.insuranceExpiry)}</span></td><td><span className={`transport-alert ${alertClass(fit)}`}>{dateLabel(row.fitnessExpiry)}</span></td><td><StatusBadge>{row.status}</StatusBadge></td><td><button className="icon-button" onClick={() => { setEditing(row); setForm(row) }}><Edit3 size={14} /></button><button className="icon-button danger" onClick={() => deleteItem('vehicles', row.id)}><Trash2 size={14} /></button></td></tr> })}{!rows.length && <tr><td colSpan="10"><div className="empty-state">No vehicle found.</div></td></tr>}</tbody></table></div>
    </section>
  </div>
}

function DriversPage({ transport, saveItem, deleteItem }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', phone: '', licenseNumber: '', licenseType: 'Heavy', licenseExpiry: today(), status: 'Active', vehicleId: '', routeId: '' })
  const rows = activeDrivers(transport).filter(item => (status === 'All' || item.status === status) && `${item.name} ${item.phone} ${item.licenseNumber}`.toLowerCase().includes(query.toLowerCase()))
  const onPhoto = async file => file && setForm({ ...form, photoURL: await fileToDataUrl(file) })
  const submit = async event => {
    event.preventDefault()
    const vehicle = vehicleById(transport, form.vehicleId)
    await saveItem('drivers', { ...form, id: editing?.id, routeId: form.routeId || vehicle?.routeId || '' })
    setEditing(null)
    setForm({ name: '', phone: '', licenseNumber: '', licenseType: 'Heavy', licenseExpiry: today(), status: 'Active', vehicleId: '', routeId: '' })
  }
  return <div className="transport-page"><section className="panel transport-form-panel"><div className="panel-header"><div><h3>{editing ? 'Edit Driver' : 'Add Driver'}</h3><p>Driver profile with license and assignment.</p></div></div>
    <form onSubmit={submit}><div className="form-grid">
      <label className="transport-photo-upload">Driver Photo<input type="file" accept="image/*" onChange={e => onPhoto(e.target.files?.[0])} /><span>{form.photoURL ? <img src={form.photoURL} alt="" /> : <><Upload size={18} /> Upload Photo</>}</span></label>
      <label>Full Name*<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      <label>Father Name<input value={form.fatherName || ''} onChange={e => setForm({ ...form, fatherName: e.target.value })} /></label>
      <label>Date of Birth<DatePicker value={form.dob || ''} onChange={value => setForm({ ...form, dob: value })} /></label>
      <label>Phone Number*<input required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
      <label>Alternate Phone<input value={form.alternatePhone || ''} onChange={e => setForm({ ...form, alternatePhone: e.target.value })} /></label>
      <label className="full">Address<textarea value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} /></label>
      <label>Aadhaar Number<input value={form.aadhaar || ''} onChange={e => setForm({ ...form, aadhaar: e.target.value })} /></label>
      <label>License Number*<input required value={form.licenseNumber} onChange={e => setForm({ ...form, licenseNumber: e.target.value })} /></label>
      <label>License Type<select value={form.licenseType} onChange={e => setForm({ ...form, licenseType: e.target.value })}>{['Light','Medium','Heavy'].map(item => <option key={item}>{item}</option>)}</select></label>
      <label>License Expiry*<DatePicker value={form.licenseExpiry} onChange={value => setForm({ ...form, licenseExpiry: value })} /></label>
      <label>Experience<input type="number" value={form.experience || ''} onChange={e => setForm({ ...form, experience: e.target.value })} /></label>
      <label>Blood Group<input value={form.bloodGroup || ''} onChange={e => setForm({ ...form, bloodGroup: e.target.value })} /></label>
      <label>Emergency Contact<input value={form.emergencyName || ''} onChange={e => setForm({ ...form, emergencyName: e.target.value })} /></label>
      <label>Emergency Phone<input value={form.emergencyPhone || ''} onChange={e => setForm({ ...form, emergencyPhone: e.target.value })} /></label>
      <label>Vehicle Assigned<select value={form.vehicleId || ''} onChange={e => { const vehicle = vehicleById(transport, e.target.value); setForm({ ...form, vehicleId: e.target.value, routeId: vehicle?.routeId || form.routeId }) }}><option value="">Select vehicle</option>{activeVehicles(transport).map(item => <option key={item.id} value={item.id}>{item.vehicleNumber}</option>)}</select></label>
      <label>Route Assigned<select value={form.routeId || ''} onChange={e => setForm({ ...form, routeId: e.target.value })}><option value="">Select route</option>{activeRoutes(transport).map(item => <option key={item.id} value={item.id}>{item.routeName}</option>)}</select></label>
      <label>Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>Active</option><option>On Leave</option></select></label>
    </div><div className="modal-actions"><button className="primary-button"><UserRound size={15} /> Save Driver</button>{editing && <button type="button" className="secondary-button" onClick={() => setEditing(null)}>Cancel</button>}</div></form>
  </section><section className="panel table-panel"><div className="panel-header"><div><h3>Driver List</h3><p>License alerts and WhatsApp contact.</p></div><div className="transport-filter-row"><select value={status} onChange={e => setStatus(e.target.value)}><option>All</option><option>Active</option><option>On Leave</option></select><div className="table-search"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search driver" /></div></div></div><div className="table-scroll"><table><thead><tr><th>#</th><th>Photo</th><th>Name</th><th>Phone</th><th>License</th><th>Expiry</th><th>Vehicle</th><th>Route</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((row, index) => { const days = expiringIn(row.licenseExpiry); return <tr key={row.id}><td>{index + 1}</td><td>{row.photoURL ? <img className="transport-driver-thumb" src={row.photoURL} alt="" /> : <span className="transport-driver-thumb initials">{String(row.name || 'D')[0]}</span>}</td><td>{row.name}</td><td><a href={`https://wa.me/91${row.phone}`} target="_blank" rel="noreferrer"><Phone size={13} /> {row.phone}</a></td><td>{row.licenseNumber}</td><td><span className={`transport-alert ${alertClass(days)}`}>{dateLabel(row.licenseExpiry)}</span></td><td>{vehicleById(transport, row.vehicleId)?.vehicleNumber || '-'}</td><td>{routeById(transport, row.routeId)?.routeName || '-'}</td><td><StatusBadge>{row.status}</StatusBadge></td><td><button className="icon-button" onClick={() => { setEditing(row); setForm(row) }}><Edit3 size={14} /></button><button className="icon-button danger" onClick={() => deleteItem('drivers', row.id)}><Trash2 size={14} /></button></td></tr> })}{!rows.length && <tr><td colSpan="10"><div className="empty-state">No driver found.</div></td></tr>}</tbody></table></div></section></div>
}

function AllocationPage({ transport, students, saveItem, deleteItem }) {
  const [filters, setFilters] = useState({ query: '', className: '', routeId: '', status: 'All' })
  const [selected, setSelected] = useState({})
  const [assign, setAssign] = useState({ routeId: '', stopName: '' })
  const [saving, setSaving] = useState('')
  const [message, setMessage] = useState('')
  const rows = students.filter(student => {
    const allocation = allocations(transport).find(item => item.studentId === student.id)
    const parts = classParts(student.className)
    const q = filters.query.toLowerCase()
    return (!filters.className || parts.className === filters.className)
      && (!filters.routeId || allocation?.routeId === filters.routeId)
      && (filters.status === 'All' || (filters.status === 'Allocated' ? allocation : !allocation))
      && (!q || `${student.name} ${student.roll} ${student.phone || ''}`.toLowerCase().includes(q))
  })
  const selectedRoute = routeById(transport, assign.routeId)
  const selectedStop = (selectedRoute?.stops || []).find(stop => stop.name === assign.stopName)
  const saveAllocation = async student => {
    try {
      setSaving(student.id)
      setMessage('')
      const route = routeById(transport, assign.routeId)
      const stop = (route?.stops || []).find(item => item.name === assign.stopName)
      if (!route || !stop) throw new Error('Please select route and stop first.')
      const vehicle = vehicleById(transport, route.vehicleId) || activeVehicles(transport).find(item => item.routeId === route.id) || {}
      const driver = driverById(transport, route.driverId || vehicle.driverId) || {}
      await saveItem('allocations', {
        id: allocations(transport).find(item => item.studentId === student.id)?.id,
        studentId: student.id,
        studentName: student.name,
        admissionNo: student.roll,
        className: student.className,
        routeId: route.id,
        routeName: route.routeName,
        stopName: stop.name,
        pickupTime: stop.time,
        dropTime: stop.dropTime || stop.time,
        vehicleId: vehicle.id || '',
        vehicleNumber: vehicle.vehicleNumber || '',
        driverId: driver.id || '',
        status: 'active',
        allocatedAt: Date.now(),
      })
      setMessage(`${student.name} allocated successfully.`)
    } catch (error) {
      console.error('Allocation error:', error)
      alert(`Error saving: ${error.message}`)
    } finally {
      setSaving('')
    }
  }
  const bulkSave = async () => {
    const selectedRows = rows.filter(student => selected[student.id])
    try {
      setSaving('bulk')
      await Promise.all(selectedRows.map(saveAllocation))
      setSelected({})
      setMessage(`${selectedRows.length} student allocation saved.`)
    } finally {
      setSaving('')
    }
  }
  return <div className="transport-page"><section className="panel transport-filters"><div className="table-search"><Search size={15} /><input value={filters.query} onChange={e => setFilters({ ...filters, query: e.target.value })} placeholder="Search student by name/admission no" /></div><select value={filters.className} onChange={e => setFilters({ ...filters, className: e.target.value })}><option value="">All Classes</option>{classOptions(students).map(item => <option key={item}>{item}</option>)}</select><select value={filters.routeId} onChange={e => setFilters({ ...filters, routeId: e.target.value })}><option value="">All Routes</option>{activeRoutes(transport).map(item => <option key={item.id} value={item.id}>{item.routeName}</option>)}</select><select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}><option>All</option><option>Allocated</option><option>Not Allocated</option></select></section>
    <section className="panel bulk-assign"><div className="panel-header"><div><h3>Assign Student to Route</h3><p>Select route and stop, then assign one or many students.</p></div></div><div className="form-grid"><label>Select Route<select value={assign.routeId} onChange={e => setAssign({ routeId: e.target.value, stopName: '' })}><option value="">Select route</option>{activeRoutes(transport).map(item => <option key={item.id} value={item.id}>{item.routeName}</option>)}</select></label><label>Select Stop<select value={assign.stopName} onChange={e => setAssign({ ...assign, stopName: e.target.value })}><option value="">Select stop</option>{(selectedRoute?.stops || []).map(stop => <option key={stop.name}>{stop.name}</option>)}</select></label><label>Pickup Time<input readOnly value={selectedStop?.time || ''} /></label><label>Vehicle<input readOnly value={vehicleById(transport, selectedRoute?.vehicleId)?.vehicleNumber || 'Auto from route'} /></label></div>{message && <div className="transport-success">{message}</div>}<button className="primary-button" disabled={saving || !Object.values(selected).some(Boolean) || !assign.routeId || !assign.stopName} onClick={bulkSave}><Check size={15} /> {saving === 'bulk' ? 'Saving...' : 'Bulk Assign Selected'}</button></section>
    <section className="panel table-panel"><div className="table-scroll"><table><thead><tr><th><input type="checkbox" checked={rows.length > 0 && rows.every(student => selected[student.id])} onChange={e => setSelected(Object.fromEntries(rows.map(student => [student.id, e.target.checked])))} /></th><th>#</th><th>Photo</th><th>Student</th><th>Adm No</th><th>Class</th><th>Route</th><th>Stop</th><th>Vehicle</th><th>Pickup</th><th>Actions</th></tr></thead><tbody>{rows.map((student, index) => { const allocation = allocations(transport).find(item => item.studentId === student.id); return <tr key={student.id}><td><input type="checkbox" checked={Boolean(selected[student.id])} onChange={e => setSelected({ ...selected, [student.id]: e.target.checked })} /></td><td>{index + 1}</td><td>{studentPhoto(student) ? <img className="transport-student-thumb" src={studentPhoto(student)} alt="" /> : <span className="transport-student-thumb initials">{student.initials}</span>}</td><td>{student.name}</td><td>{student.roll}</td><td>{student.className}</td><td>{allocation?.routeName || routeById(transport, allocation?.routeId)?.routeName || '-'}</td><td>{allocation?.stopName || '-'}</td><td>{allocation?.vehicleNumber || vehicleById(transport, allocation?.vehicleId)?.vehicleNumber || '-'}</td><td>{allocation?.pickupTime || '-'}</td><td><div className="transport-row-actions"><button className="secondary-button" disabled={saving === student.id || !assign.routeId || !assign.stopName} onClick={() => saveAllocation(student)}>{saving === student.id ? 'Saving...' : allocation ? 'Update' : 'Assign'}</button>{allocation && <button className="icon-button danger" onClick={() => deleteItem('allocations', allocation.id)}><Trash2 size={14} /></button>}</div></td></tr> })}{!rows.length && <tr><td colSpan="11"><div className="empty-state">No students match filters.</div></td></tr>}</tbody></table></div></section>
  </div>
}

function FeesPage({ transport, students, saveItem }) {
  const [month, setMonth] = useState(today().slice(0, 7))
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [payment, setPayment] = useState({ mode: 'CASH', transactionId: '', paid: '', fine: 0 })
  const [saving, setSaving] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [feeSettings, setFeeSettings] = useState(transport.settings?.fees || { mode: 'distance', flat: 700, slabs: [{ upto: 5, amount: 500 }, { upto: 10, amount: 700 }, { upto: 15, amount: 900 }, { upto: 999, amount: 1100 }] })
  const allocated = allocations(transport)
  const feeFor = allocation => {
    if (feeSettings.mode === 'flat') return Number(feeSettings.flat || 0)
    const route = routeById(transport, allocation.routeId)
    const stop = (route?.stops || []).find(item => item.name === allocation.stopName)
    const distance = Number(stop?.distance || 0)
    return Number((feeSettings.slabs || []).find(slab => distance <= Number(slab.upto))?.amount || 0)
  }
  const feeRows = allocated.map(allocation => {
    const student = students.find(item => item.id === allocation.studentId) || {}
    const paid = fees(transport).find(item => item.studentId === allocation.studentId && item.month === monthLabel(month))
    return { allocation, student, amount: feeFor(allocation), paid }
  })
  const searchResults = query.trim() ? feeRows.filter(row => `${row.student.name} ${row.student.roll} ${row.student.phone || ''}`.toLowerCase().includes(query.toLowerCase())).slice(0, 8) : []
  const selectedRow = feeRows.find(row => row.student.id === selectedId) || searchResults[0] || null
  const totalAmount = Number(selectedRow?.amount || 0) + Number(payment.fine || 0)
  const paidAmount = Number(payment.paid || totalAmount || 0)
  const balance = Math.max(0, totalAmount - paidAmount)
  const receiptNo = () => `TF-${new Date().getFullYear()}-${String(fees(transport).filter(item => String(item.receiptNo || '').startsWith(`TF-${new Date().getFullYear()}`)).length + 1).padStart(3, '0')}`
  const printReceipt = item => {
    if (!item) return
    const win = window.open('', '_blank', 'width=800,height=900')
    if (!win) return alert('Please allow popups to print receipt.')
    win.document.write(`<html><head><title>${item.receiptNo}</title><style>body{font-family:Arial;margin:24px;color:#021024}.receipt{border:2px solid #052659;padding:24px;max-width:720px;margin:auto}.head{text-align:center;border-bottom:2px solid #052659;padding-bottom:12px}.title{display:inline-block;border:1px solid #052659;padding:6px 18px;font-weight:800;color:#052659}table{width:100%;border-collapse:collapse;margin-top:18px}td,th{border:1px solid #9db5d1;padding:9px;text-align:left}.sign{display:flex;justify-content:space-between;margin-top:48px}.line{border-top:1px solid #111;width:160px;text-align:center;padding-top:6px}@media print{body{margin:0}.receipt{border:2px solid #000}}</style></head><body><div class="receipt"><div class="head"><h2>TRANSPORT FEE RECEIPT</h2><div class="title">${item.receiptNo}</div><p>Date: ${dateLabel(item.paidDate || Date.now())}</p></div><table><tbody><tr><th>Student</th><td>${item.studentName}</td><th>Admission No</th><td>${item.admissionNo || '-'}</td></tr><tr><th>Class</th><td>${item.className || '-'}</td><th>Month</th><td>${item.month}</td></tr><tr><th>Route</th><td>${item.routeName}</td><th>Stop</th><td>${item.stopName}</td></tr><tr><th>Fee Amount</th><td>${money(item.amount)}</td><th>Late Fine</th><td>${money(item.lateFine)}</td></tr><tr><th>Total Paid</th><td>${money(item.paidAmount)}</td><th>Balance</th><td>${money(item.balance)}</td></tr><tr><th>Mode</th><td>${item.paymentMode}</td><th>Txn ID</th><td>${item.transactionId || '-'}</td></tr></tbody></table><div class="sign"><div class="line">Cashier</div><div class="line">Principal</div></div><p style="text-align:center;margin-top:24px">This is a computer generated receipt.</p></div><script>window.onload=()=>{window.print()}</script></body></html>`)
    win.document.close()
  }
  const collect = async (row = selectedRow) => {
    if (!row) return alert('Please search and select a student first.')
    try {
      setSaving(true)
      const rowTotal = Number(row.amount || 0) + Number(payment.fine || 0)
      const rowPaid = Number(payment.paid || rowTotal || 0)
      const rowBalance = Math.max(0, rowTotal - rowPaid)
      const item = {
        studentId: row.student.id,
        studentName: row.student.name,
        admissionNo: row.student.roll,
        className: row.student.className,
        routeId: row.allocation.routeId,
        routeName: row.allocation.routeName || routeById(transport, row.allocation.routeId)?.routeName || '',
        stopName: row.allocation.stopName,
        month: monthLabel(month),
        amount: row.amount,
        lateFine: Number(payment.fine || 0),
        totalAmount: rowTotal,
        paidAmount: rowPaid,
        balance: rowBalance,
        status: rowBalance > 0 ? 'partial' : 'paid',
        paymentMode: payment.mode,
        transactionId: payment.transactionId,
        paidDate: Date.now(),
        receiptNo: receiptNo(),
      }
      const saved = await saveItem('fees', item)
      const nextReceipt = { ...item, ...saved }
      setReceipt(nextReceipt)
      setPayment({ mode: 'CASH', transactionId: '', paid: '', fine: 0 })
      alert('Transport fee collected successfully!')
    } catch (error) {
      console.error('Transport fee error:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }
  const defaulters = feeRows.filter(row => !row.paid)
  return <div className="transport-page"><section className="panel transport-form-panel"><div className="panel-header"><div><h3>Set Transport Fee</h3><p>Flat fee or distance slabs.</p></div></div><div className="form-grid"><label>Fee Mode<select value={feeSettings.mode} onChange={e => setFeeSettings({ ...feeSettings, mode: e.target.value })}><option value="distance">Distance wise</option><option value="flat">Flat fee</option></select></label><label>Flat Amount<input type="number" value={feeSettings.flat} onChange={e => setFeeSettings({ ...feeSettings, flat: Number(e.target.value) })} /></label></div><div className="transport-slabs">{(feeSettings.slabs || []).map((slab, index) => <div key={index}><span>0-{slab.upto} km</span><input type="number" value={slab.amount} onChange={e => setFeeSettings({ ...feeSettings, slabs: feeSettings.slabs.map((item, i) => i === index ? { ...item, amount: Number(e.target.value) } : item) })} /></div>)}</div><button className="primary-button" onClick={() => saveItem('settings', { id: 'fees', ...feeSettings })}><SaveIcon /> Save Fee Settings</button></section>
    <section className="panel transport-form-panel"><div className="panel-header"><div><h3>Collect Transport Fee</h3><p>Search allocated student and collect monthly transport fee.</p></div><input type="month" value={month} onChange={e => setMonth(e.target.value)} /></div><div className="table-search"><Search size={15} /><input value={query} onChange={e => { setQuery(e.target.value); setSelectedId('') }} placeholder="Search student by name/admission no" /></div>{searchResults.length > 0 && <div className="transport-search-list">{searchResults.map(row => <button key={row.allocation.id} className={selectedId === row.student.id ? 'active' : ''} onClick={() => { setSelectedId(row.student.id); setPayment(current => ({ ...current, paid: String(row.amount) })) }}><strong>{row.student.name}</strong><span>{row.student.roll} - {row.student.className}</span></button>)}</div>}{selectedRow && <div className="transport-fee-form"><div className="transport-summary-mini"><div><span>Student</span><strong>{selectedRow.student.name}</strong></div><div><span>Route</span><strong>{selectedRow.allocation.routeName || routeById(transport, selectedRow.allocation.routeId)?.routeName || '-'}</strong></div><div><span>Stop</span><strong>{selectedRow.allocation.stopName}</strong></div><div><span>Fee</span><strong>{money(selectedRow.amount)}</strong></div></div><div className="form-grid"><label>Late Fine<input type="number" value={payment.fine} onChange={e => setPayment({ ...payment, fine: Number(e.target.value) })} /></label><label>Payment Mode<select value={payment.mode} onChange={e => setPayment({ ...payment, mode: e.target.value })}>{['CASH','UPI','NEFT','Cheque'].map(item => <option key={item}>{item}</option>)}</select></label><label>Transaction ID<input value={payment.transactionId} onChange={e => setPayment({ ...payment, transactionId: e.target.value })} placeholder="Optional" /></label><label>Amount Paid*<input type="number" value={payment.paid || totalAmount} onChange={e => setPayment({ ...payment, paid: e.target.value })} /></label><label>Total Amount<input readOnly value={money(totalAmount)} /></label><label>Balance<input readOnly value={money(balance)} /></label></div><div className="modal-actions"><button className="primary-button" disabled={saving || selectedRow.paid} onClick={() => collect(selectedRow)}>{saving ? 'Collecting...' : selectedRow.paid ? 'Already Paid' : 'Collect Fee'}</button>{receipt && <button className="secondary-button" onClick={() => printReceipt(receipt)}><Printer size={14} /> Print Receipt</button>}</div></div>}</section>
    <section className="panel table-panel"><div className="panel-header"><div><h3>Fee Defaulters</h3><p>{monthLabel(month)}</p></div><div className="modal-actions"><button className="secondary-button" onClick={() => window.print()}><Printer size={14} /> Print Defaulter List</button><a className="secondary-button" href={`https://wa.me/?text=${encodeURIComponent(`Transport fee reminder for ${monthLabel(month)}. Please clear pending dues.`)}`} target="_blank" rel="noreferrer">Send Reminder</a></div></div><div className="transport-summary-mini"><div><span>Total Collection</span><strong>{money(feeRows.filter(row => row.paid).reduce((sum, row) => sum + Number(row.paid?.paidAmount || row.paid?.amount || row.amount), 0))}</strong></div><div><span>Total Pending</span><strong>{money(defaulters.reduce((sum, row) => sum + row.amount, 0))}</strong></div><div><span>Defaulters</span><strong>{defaulters.length}</strong></div></div><div className="table-scroll"><table><thead><tr><th>Student</th><th>Route</th><th>Due Months</th><th>Total Due</th><th>Status</th><th>Actions</th></tr></thead><tbody>{feeRows.map(row => <tr key={row.allocation.id}><td>{row.student.name}</td><td>{row.allocation.routeName || routeById(transport, row.allocation.routeId)?.routeName}</td><td>{row.paid ? '-' : monthLabel(month)}</td><td>{money(row.paid ? 0 : row.amount)}</td><td><StatusBadge>{row.paid ? 'Paid' : 'Due'}</StatusBadge></td><td>{row.paid ? <button className="secondary-button" onClick={() => printReceipt(row.paid)}><Printer size={14} /> Receipt</button> : <button className="primary-button" onClick={() => { setSelectedId(row.student.id); setQuery(row.student.name); setPayment(current => ({ ...current, paid: String(row.amount) })); collect(row) }}>Mark as Paid</button>}</td></tr>)}{!feeRows.length && <tr><td colSpan="6"><div className="empty-state">No students allocated to transport yet.</div></td></tr>}</tbody></table></div></section></div>
}

function SaveIcon() { return <Check size={15} /> }

function AttendancePage({ transport, students, saveItem }) {
  const [mode, setMode] = useState('Morning Pickup')
  const [routeId, setRouteId] = useState('')
  const [date, setDate] = useState(today())
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const routeAllocations = allocations(transport).filter(item => !routeId || item.routeId === routeId)
  const attendanceKey = `${date}_${routeId || 'all'}_${mode.replace(/\s+/g, '_')}`
  const existing = transport.attendance?.[attendanceKey]?.marks || {}
  const [marks, setMarks] = useState({})
  const rows = routeAllocations.map(allocation => ({ allocation, student: students.find(item => item.id === allocation.studentId) })).filter(row => row.student)
  const positive = mode === 'Morning Pickup' ? 'Picked Up' : 'Dropped'
  const negative = mode === 'Morning Pickup' ? 'Not Picked Up' : 'Not Dropped'
  useEffect(() => {
    setMarks(existing || {})
    setLoaded(Boolean(Object.keys(existing || {}).length))
  }, [attendanceKey])
  const loadStudents = () => {
    setLoaded(true)
    if (!Object.keys(existing || {}).length) setMarks(Object.fromEntries(rows.map(row => [row.student.id, negative])))
  }
  const markAll = status => setMarks(Object.fromEntries(rows.map(row => [row.student.id, status])))
  const submit = async () => {
    try {
      setSaving(true)
      const savedMarks = Object.fromEntries(rows.map(row => [row.student.id, marks[row.student.id] || negative]))
      const records = rows.map(row => ({
        studentId: row.student.id,
        studentName: row.student.name,
        stop: row.allocation.stopName,
        status: savedMarks[row.student.id],
        time: savedMarks[row.student.id] === positive ? new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null,
      }))
      await saveItem('attendance', { id: attendanceKey, date, routeId, mode, type: mode === 'Morning Pickup' ? 'morning' : 'evening', marks: savedMarks, records, savedAt: Date.now() })
      alert('Transport attendance saved successfully!')
    } catch (error) {
      console.error('Transport attendance error:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }
  const counts = rows.reduce((sum, row) => {
    const status = marks[row.student.id] || negative
    sum[status] = (sum[status] || 0) + 1
    return sum
  }, {})
  const done = counts[positive] || 0
  const percent = rows.length ? Math.round(done / rows.length * 100) : 0
  return <div className="transport-page"><section className="panel transport-filters"><select value={mode} onChange={e => setMode(e.target.value)}><option>Morning Pickup</option><option>Evening Drop</option></select><select value={routeId} onChange={e => setRouteId(e.target.value)}><option value="">All Routes</option>{activeRoutes(transport).map(item => <option key={item.id} value={item.id}>{item.routeName}</option>)}</select><DatePicker value={date} onChange={setDate} /><button className="secondary-button" onClick={loadStudents}>Load Students</button><button className="secondary-button" onClick={() => markAll(positive)}>Mark all {positive}</button><button className="primary-button" disabled={saving || !rows.length} onClick={submit}><Check size={15} /> {saving ? 'Saving...' : 'Save Attendance'}</button></section><section className="transport-summary-mini"><div><span>Total Students</span><strong>{rows.length}</strong></div><div><span>{positive}</span><strong>{done}</strong></div><div><span>{negative}</span><strong>{counts[negative] || 0}</strong></div><div><span>Percentage</span><strong>{percent}%</strong></div></section><section className="panel table-panel"><div className="panel-header"><div><h3>{mode}</h3><p>{loaded ? 'Saved data loaded. You can edit and re-save.' : 'Load students, then mark attendance.'}</p></div></div><div className="table-scroll"><table><thead><tr><th>#</th><th>Student</th><th>Route</th><th>Stop</th><th>Time</th><th>Status</th></tr></thead><tbody>{(loaded ? rows : []).map((row, index) => <tr key={row.allocation.id}><td>{index + 1}</td><td>{row.student.name}</td><td>{row.allocation.routeName || routeById(transport, row.allocation.routeId)?.routeName}</td><td>{row.allocation.stopName}</td><td>{row.allocation.pickupTime}</td><td><div className="transport-toggle-buttons"><button className={marks[row.student.id] === positive ? 'active' : ''} onClick={() => setMarks({ ...marks, [row.student.id]: positive })}>✓ {positive}</button><button className={marks[row.student.id] !== positive ? 'active danger' : ''} onClick={() => setMarks({ ...marks, [row.student.id]: negative })}>✕ {negative}</button></div></td></tr>)}{loaded && !rows.length && <tr><td colSpan="6"><div className="empty-state">No students found on this route.</div></td></tr>}{!loaded && <tr><td colSpan="6"><div className="empty-state">Select route/date and click Load Students.</div></td></tr>}</tbody></table></div></section></div>
}

function ReportsPage({ transport, students }) {
  const routeRows = activeRoutes(transport)
  const vehicleRows = activeVehicles(transport)
  const driverRows = activeDrivers(transport)
  const allocationRows = allocations(transport)
  const feeRows = fees(transport)
  const vehicleDocRows = vehicleRows.flatMap(vehicle => [
    { vehicle: vehicle.vehicleNumber, document: 'Insurance', expiry: vehicle.insuranceExpiry, days: expiringIn(vehicle.insuranceExpiry) },
    { vehicle: vehicle.vehicleNumber, document: 'Fitness', expiry: vehicle.fitnessExpiry, days: expiringIn(vehicle.fitnessExpiry) },
    { vehicle: vehicle.vehicleNumber, document: 'PUC', expiry: vehicle.pucExpiry, days: expiringIn(vehicle.pucExpiry) },
  ]).filter(row => row.expiry)
  const reportMap = {
    routes: {
      title: 'Route-wise Report',
      headers: ['Route', 'Stops', 'Students', 'Revenue'],
      rows: routeRows.map(route => [route.routeName, route.stops?.length || 0, allocationRows.filter(item => item.routeId === route.id).length, money(feeRows.filter(item => item.routeId === route.id).reduce((sum, item) => sum + Number(item.paidAmount || item.amount || 0), 0))]),
    },
    vehicles: {
      title: 'Vehicle-wise Report',
      headers: ['Vehicle', 'Type', 'Route', 'Capacity', 'Used', 'Empty'],
      rows: vehicleRows.map(vehicle => { const used = allocationRows.filter(item => item.vehicleId === vehicle.id).length; return [vehicle.vehicleNumber, vehicle.type, routeById(transport, vehicle.routeId)?.routeName || '-', vehicle.capacity || 0, used, Math.max(0, Number(vehicle.capacity || 0) - used)] }),
    },
    students: {
      title: 'Student Transport Report',
      headers: ['Name', 'Class', 'Route', 'Stop', 'Vehicle', 'Fee Status'],
      rows: allocationRows.map(item => { const student = students.find(row => row.id === item.studentId) || {}; const paid = feeRows.some(fee => fee.studentId === item.studentId && fee.status === 'paid'); return [student.name || item.studentName || '-', student.className || item.className || '-', item.routeName || routeById(transport, item.routeId)?.routeName || '-', item.stopName || '-', item.vehicleNumber || vehicleById(transport, item.vehicleId)?.vehicleNumber || '-', paid ? 'Paid' : 'Due'] }),
    },
    fees: {
      title: 'Fee Collection Report',
      headers: ['Name', 'Route', 'Month', 'Amount', 'Status', 'Date'],
      rows: feeRows.map(item => [item.studentName || students.find(row => row.id === item.studentId)?.name || '-', item.routeName || routeById(transport, item.routeId)?.routeName || '-', item.month || '-', money(item.paidAmount || item.amount), item.status || '-', dateLabel(item.paidDate)]),
    },
    drivers: {
      title: 'Driver Report',
      headers: ['Name', 'Phone', 'License', 'Expiry', 'Vehicle', 'Status'],
      rows: driverRows.map(driver => [driver.name, driver.phone, driver.licenseNumber, dateLabel(driver.licenseExpiry), vehicleById(transport, driver.vehicleId)?.vehicleNumber || '-', driver.status]),
    },
    documents: {
      title: 'Vehicle Document Report',
      headers: ['Vehicle', 'Document', 'Expiry', 'Days Left', 'Status'],
      rows: vehicleDocRows.map(row => [row.vehicle, row.document, dateLabel(row.expiry), row.days, row.days <= 15 ? 'Critical' : row.days <= 30 ? 'Due Soon' : 'Valid']),
    },
  }
  const [reportType, setReportType] = useState('routes')
  const current = reportMap[reportType]
  const csvEscape = value => `"${String(value ?? '').replace(/"/g, '""')}"`
  const exportCsv = report => {
    const csv = [report.headers.map(csvEscape).join(','), ...report.rows.map(row => row.map(csvEscape).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${report.title.toLowerCase().replace(/\s+/g, '-')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }
  const reportHtml = report => `<div class="header"><div class="school-name">School Transport Management</div><div class="report-title">${report.title}</div><div class="date">Generated: ${new Date().toLocaleDateString('en-IN')}</div></div><table><thead><tr>${report.headers.map(header => `<th>${header}</th>`).join('')}</tr></thead><tbody>${report.rows.map(row => `<tr>${row.map(cell => `<td>${cell ?? '-'}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${report.headers.length}">No records found</td></tr>`}</tbody></table><p class="total">Total Records: ${report.rows.length}</p><div class="sign"><span>Prepared By</span><span>Principal</span></div>`
  const printReport = report => {
    const printWindow = window.open('', '_blank', 'width=1000,height=800')
    if (!printWindow) return alert('Please allow popups to print reports.')
    printWindow.document.write(`<html><head><title>${report.title}</title><style>body{font-family:Arial;margin:24px;color:#021024}.header{text-align:center;margin-bottom:20px}.school-name{font-size:20px;font-weight:800}.report-title{font-size:15px;color:#5483B3;font-weight:700}.date{font-size:11px;color:#666}table{width:100%;border-collapse:collapse}th,td{border:1px solid #000;padding:8px;font-size:12px;text-align:left}th{background:#052659;color:white}.total{margin-top:18px;font-weight:700}.sign{display:flex;justify-content:space-between;margin-top:54px}.sign span{border-top:1px solid #111;width:180px;text-align:center;padding-top:8px}@media print{body{margin:10mm}th{background:#052659!important;color:white!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${reportHtml(report)}<script>window.onload=()=>window.print()</script></body></html>`)
    printWindow.document.close()
  }
  const exportPdf = report => printReport(report)
  return <div className="transport-page"><section className="panel"><div className="panel-header"><div><h3>Transport Reports</h3><p>Route, vehicle, fee and document reports.</p></div><select value={reportType} onChange={event => setReportType(event.target.value)}>{Object.entries(reportMap).map(([id, report]) => <option key={id} value={id}>{report.title}</option>)}</select></div><div className="transport-report-actions"><button className="secondary-button" onClick={() => printReport(current)}><Printer size={14} /> Print</button><button className="secondary-button" onClick={() => exportCsv(current)}><Download size={14} /> Excel</button><button className="secondary-button" onClick={() => exportPdf(current)}><FileText size={14} /> PDF</button></div><div id="transport-report-content" className="transport-report-content"><div className="transport-print-header"><h3>{current.title}</h3><p>Generated: {new Date().toLocaleDateString('en-IN')}</p></div><div className="table-scroll"><table><thead><tr>{current.headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{current.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}{!current.rows.length && <tr><td colSpan={current.headers.length}><div className="empty-state">No records found.</div></td></tr>}</tbody></table></div></div><div className="transport-report-grid">{Object.entries(reportMap).map(([id, report]) => <button key={id} className={reportType === id ? 'active' : ''} onClick={() => setReportType(id)}><h4>{report.title}</h4><p>{report.rows.length} records</p></button>)}</div></section></div>
}

export default function TransportManager({ students = [], transport = {}, saveTransportItem, deleteTransportItem }) {
  const [tab, setTab] = useState('routes')
  const safeTransport = {
    routes: {},
    vehicles: {},
    drivers: {},
    allocations: {},
    fees: {},
    attendance: {},
    settings: {},
    ...transport,
  }
  const vehicleAlerts = activeVehicles(safeTransport).flatMap(vehicle => [
    { text: `${vehicle.vehicleNumber} insurance expires in ${expiringIn(vehicle.insuranceExpiry)} days`, days: expiringIn(vehicle.insuranceExpiry) },
    { text: `${vehicle.vehicleNumber} fitness expires in ${expiringIn(vehicle.fitnessExpiry)} days`, days: expiringIn(vehicle.fitnessExpiry) },
  ]).filter(item => item.days !== null && item.days <= 30)
  const driverAlerts = activeDrivers(safeTransport).map(driver => ({ text: `${driver.name} license expires in ${expiringIn(driver.licenseExpiry)} days`, days: expiringIn(driver.licenseExpiry) })).filter(item => item.days !== null && item.days <= 30)
  return <div className="transport-module">
    <div className="section-actions"><div><h2>Transport Management</h2><p>Routes, vehicles, drivers, allocation, fees and safety reports.</p></div></div>
    <section className="transport-dashboard">
      <div><BusFront size={20} /><span>Total Vehicles</span><strong>{activeVehicles(safeTransport).length}</strong></div>
      <div><Route size={20} /><span>Total Routes</span><strong>{activeRoutes(safeTransport).length}</strong></div>
      <div><UserRound size={20} /><span>Total Drivers</span><strong>{activeDrivers(safeTransport).length}</strong></div>
      <div><MapPinned size={20} /><span>Students Using Transport</span><strong>{allocations(safeTransport).length}</strong></div>
    </section>
    {(vehicleAlerts.length || driverAlerts.length) > 0 && <section className="panel transport-alert-panel"><div className="panel-header"><div><h3>Transport Alerts</h3><p>Document expiry and operational warnings.</p></div><AlertTriangle size={18} /></div>{[...vehicleAlerts, ...driverAlerts].map((alert, index) => <div className={`transport-alert-line ${alertClass(alert.days)}`} key={index}>{alert.text}</div>)}</section>}
    <TransportTabs tab={tab} setTab={setTab} />
    {tab === 'routes' && <RoutesPage transport={safeTransport} saveItem={saveTransportItem} deleteItem={deleteTransportItem} />}
    {tab === 'vehicles' && <VehiclesPage transport={safeTransport} saveItem={saveTransportItem} deleteItem={deleteTransportItem} />}
    {tab === 'drivers' && <DriversPage transport={safeTransport} saveItem={saveTransportItem} deleteItem={deleteTransportItem} />}
    {tab === 'allocation' && <AllocationPage transport={safeTransport} students={students} saveItem={saveTransportItem} deleteItem={deleteTransportItem} />}
    {tab === 'fees' && <FeesPage transport={safeTransport} students={students} saveItem={saveTransportItem} />}
    {tab === 'attendance' && <AttendancePage transport={safeTransport} students={students} saveItem={saveTransportItem} />}
    {tab === 'reports' && <ReportsPage transport={safeTransport} students={students} />}
  </div>
}
