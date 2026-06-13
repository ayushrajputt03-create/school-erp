import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function IDCards() {
  const [students, setStudents] = useState([])
  const [filtered, setFiltered] = useState([])
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('All')
  const [selected, setSelected] = useState([])
  const [schoolName, setSchoolName] = useState('Delhi Public School')
  const [schoolAddress, setSchoolAddress] = useState('Loni, Ghaziabad, UP - 201102')
  const [schoolPhone, setSchoolPhone] = useState('9876543210')
  const [session, setSession] = useState('2025-26')
  const [cardColor, setCardColor] = useState('#1D4ED8')
  const [loading, setLoading] = useState(true)
  const printRef = useRef()

  useEffect(() => { fetchStudents() }, [])
  useEffect(() => {
    let f = students
    if (search) f = f.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    if (filterClass !== 'All') f = f.filter(s => s.class === filterClass)
    setFiltered(f)
  }, [search, filterClass, students])

  async function fetchStudents() {
    const { data } = await supabase.from('students').select('*').order('class').order('name')
    if (data) { setStudents(data); setFiltered(data) }
    setLoading(false)
  }

  const toggleSelect = (id) => setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  const selectAll = () => setSelected(selected.length === filtered.length ? [] : filtered.map(s => s.id))

  const selectedStudents = students.filter(s => selected.includes(s.id))
  const classes = [...new Set(students.map(s => s.class))].sort((a, b) => parseInt(a) - parseInt(b))

  function handlePrint() {
    const printContent = document.getElementById('id-cards-print')
    const win = window.open('', '_blank')
    win.document.write(`
      <html><head><title>ID Cards</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: system-ui, sans-serif; background: #fff; }
        .cards-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 12px; }
        .id-card { width: 100%; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; page-break-inside: avoid; }
        @media print { .cards-grid { grid-template-columns: repeat(2, 1fr); } }
      </style></head>
      <body>${printContent.innerHTML}</body></html>
    `)
    win.document.close()
    win.print()
  }

  const IDCard = ({ student }) => (
    <div style={{ width: 320, borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb', fontFamily: 'system-ui, sans-serif', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      {/* Header */}
      <div style={{ background: cardColor, padding: '12px 14px', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏫</div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600 }}>{schoolName}</p>
            <p style={{ fontSize: 10, opacity: 0.8 }}>Student Identity Card · {session}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ background: '#fff', padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {/* Photo placeholder */}
        <div style={{ width: 56, height: 64, background: `${cardColor}15`, borderRadius: 8, border: `2px solid ${cardColor}30`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 24, marginBottom: 2 }}>👤</div>
          <p style={{ fontSize: 9, color: '#9CA3AF' }}>Photo</p>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 8, lineHeight: 1.2 }}>{student.name}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11 }}>
            <div><span style={{ color: '#9CA3AF' }}>Class: </span><strong>Class {student.class}-{student.section}</strong></div>
            <div><span style={{ color: '#9CA3AF' }}>Roll: </span><strong>{String(student.id).slice(-4).toUpperCase()}</strong></div>
            <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#9CA3AF' }}>Guardian: </span><strong>{student.guardian_name || '—'}</strong></div>
            <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#9CA3AF' }}>DOB: </span><strong>{student.dob || '—'}</strong></div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: `${cardColor}10`, borderTop: `1px solid ${cardColor}20`, padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: 10, color: '#6b7280' }}>{schoolAddress}</p>
          <p style={{ fontSize: 10, color: '#6b7280' }}>📞 {schoolPhone}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ width: 50, height: 14, background: '#F3F4F6', borderRadius: 2, marginBottom: 2 }}></div>
          <p style={{ fontSize: 9, color: '#9CA3AF' }}>Principal Sign</p>
        </div>
      </div>

      {/* Barcode strip */}
      <div style={{ background: cardColor, padding: '4px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 1 }}>
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} style={{ width: i % 3 === 0 ? 3 : 1.5, height: 12, background: 'rgba(255,255,255,0.7)' }} />
          ))}
        </div>
        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', letterSpacing: 1 }}>
          {String(student.id).slice(-8).toUpperCase()}
        </p>
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>Student ID Cards</h2>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Students ke ID cards generate aur print karo</p>
        </div>
        {selected.length > 0 && (
          <button onClick={handlePrint}
            style={{ padding: '8px 16px', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            🖨️ Print {selected.length} Cards
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1rem' }}>
        {/* Settings panel */}
        <div>
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '1rem', marginBottom: '1rem' }}>
            <p style={{ fontSize: 13, fontWeight: 500, marginBottom: '0.75rem' }}>Card Settings</p>
            {[
              { label: 'School Name', key: 'name', val: schoolName, set: setSchoolName },
              { label: 'Address', key: 'addr', val: schoolAddress, set: setSchoolAddress },
              { label: 'Phone', key: 'phone', val: schoolPhone, set: setSchoolPhone },
              { label: 'Session', key: 'session', val: session, set: setSession },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>{f.label}</label>
                <input value={f.val} onChange={e => f.set(e.target.value)}
                  style={{ width: '100%', padding: '7px 9px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Card Color</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['#1D4ED8', '#059669', '#DC2626', '#7C3AED', '#D97706', '#0891B2', '#111827'].map(c => (
                  <div key={c} onClick={() => setCardColor(c)}
                    style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer',
                    border: cardColor === c ? '2px solid #111' : '2px solid transparent', outline: cardColor === c ? '2px solid #fff' : 'none' }} />
                ))}
              </div>
            </div>
          </div>

          {/* Student filter */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '1rem' }}>
            <p style={{ fontSize: 13, fontWeight: 500, marginBottom: '0.75rem' }}>Students Select Karo</p>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Naam se dhundo..."
              style={{ width: '100%', padding: '7px 9px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 12, boxSizing: 'border-box', marginBottom: '0.5rem' }} />
            <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
              style={{ width: '100%', padding: '7px 9px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 12, marginBottom: '0.75rem' }}>
              <option>All</option>
              {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
            </select>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <button onClick={selectAll} style={{ fontSize: 11, color: '#1D4ED8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {selected.length === filtered.length ? 'Deselect All' : 'Select All'}
              </button>
              <span style={{ fontSize: 11, color: '#6b7280' }}>{selected.length} selected</span>
            </div>
            <div style={{ maxHeight: 250, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filtered.map(s => (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 7, cursor: 'pointer', background: selected.includes(s.id) ? '#EFF6FF' : '#F9FAFB' }}>
                  <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleSelect(s.id)} style={{ cursor: 'pointer' }} />
                  <span style={{ fontSize: 12, color: '#374151' }}>{s.name}</span>
                  <span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 'auto' }}>Cl.{s.class}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div>
          {selected.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>
              <p style={{ fontSize: 40, marginBottom: 12 }}>🪪</p>
              <p style={{ fontSize: 15, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Student select karo</p>
              <p style={{ fontSize: 13 }}>Left side se students choose karo ID card preview ke liye</p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <p style={{ fontSize: 13, color: '#6b7280' }}>{selected.length} cards ready to print</p>
                <button onClick={handlePrint}
                  style={{ padding: '7px 14px', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  🖨️ Print All
                </button>
              </div>
              <div id="id-cards-print">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px,1fr))', gap: 12 }}>
                  {selectedStudents.map(s => <IDCard key={s.id} student={s} />)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
