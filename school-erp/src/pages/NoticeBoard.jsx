import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CLASSES = ['All','1','2','3','4','5','6','7','8','9','10']
const SUBJECTS = ['Mathematics','Science','English','Hindi','Social Studies','Computer','General']
const TYPES = ['Homework','Notice','Circular','Event','Holiday','Exam Schedule']
const TYPE_STYLE = {
  'Homework':   {bg:'#EFF6FF',color:'#1D4ED8',dot:'#3B82F6'},
  'Notice':     {bg:'#FFF7ED',color:'#C2410C',dot:'#F97316'},
  'Circular':   {bg:'#F0FDF4',color:'#166534',dot:'#22C55E'},
  'Event':      {bg:'#FDF4FF',color:'#7E22CE',dot:'#A855F7'},
  'Holiday':    {bg:'#FEF9C3',color:'#854D0E',dot:'#EAB308'},
  'Exam Schedule':{bg:'#FFF1F2',color:'#BE123C',dot:'#F43F5E'},
}

export default function NoticeBoard() {
  const [items, setItems] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [filterType, setFilterType] = useState('All')
  const [filterClass, setFilterClass] = useState('All')
  const [form, setForm] = useState({ title:'', description:'', type:'Homework', class_target:'All', subject:'General', due_date:'', priority:'Normal' })

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    const { data } = await supabase.from('notices').select('*').order('created_at', { ascending: false })
    if (data) setItems(data)
  }

  async function addItem(e) {
    e.preventDefault()
    const { error } = await supabase.from('notices').insert([form])
    if (!error) { setShowModal(false); setForm({ title:'', description:'', type:'Homework', class_target:'All', subject:'General', due_date:'', priority:'Normal' }); fetchItems() }
    else alert('Error: ' + error.message)
  }

  async function deleteItem(id) {
    if (!confirm('Delete karo?')) return
    await supabase.from('notices').delete().eq('id', id)
    fetchItems()
  }

  const filtered = items.filter(i => {
    const tMatch = filterType === 'All' || i.type === filterType
    const cMatch = filterClass === 'All' || i.class_target === 'All' || i.class_target === filterClass
    return tMatch && cMatch
  })

  const inputStyle = { width:'100%', padding:'8px 10px', border:'1px solid #D1D5DB', borderRadius:8, fontSize:13, boxSizing:'border-box', fontFamily:'inherit' }
  const labelStyle = { fontSize:12, color:'#374151', display:'block', marginBottom:4 }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.5rem' }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:600 }}>Notice Board</h2>
          <p style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>Homework, notices aur circulars manage karo</p>
        </div>
        <button onClick={()=>setShowModal(true)} style={{ padding:'8px 16px', background:'#1D4ED8', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>
          + Add Notice
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px,1fr))', gap:10, marginBottom:'1.5rem' }}>
        {TYPES.map(t => {
          const s = TYPE_STYLE[t]
          return (
            <div key={t} style={{ background:s.bg, borderRadius:10, padding:'10px 12px', cursor:'pointer', border: filterType===t?`2px solid ${s.dot}`:'2px solid transparent' }}
              onClick={()=>setFilterType(filterType===t?'All':t)}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:s.dot, marginBottom:6 }}></div>
              <p style={{ fontSize:11, fontWeight:500, color:s.color }}>{t}</p>
              <p style={{ fontSize:18, fontWeight:600, color:s.color, marginTop:2 }}>{items.filter(i=>i.type===t).length}</p>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:8, marginBottom:'1rem', flexWrap:'wrap' }}>
        <button onClick={()=>setFilterType('All')} style={{ padding:'5px 12px', borderRadius:20, fontSize:12, cursor:'pointer', border:'1px solid', borderColor:filterType==='All'?'#1D4ED8':'#D1D5DB', background:filterType==='All'?'#EFF6FF':'#fff', color:filterType==='All'?'#1D4ED8':'#374151' }}>All</button>
        {TYPES.map(t => (
          <button key={t} onClick={()=>setFilterType(filterType===t?'All':t)}
            style={{ padding:'5px 12px', borderRadius:20, fontSize:12, cursor:'pointer', border:'1px solid',
            borderColor:filterType===t?TYPE_STYLE[t].dot:'#D1D5DB',
            background:filterType===t?TYPE_STYLE[t].bg:'#fff',
            color:filterType===t?TYPE_STYLE[t].color:'#374151' }}>{t}</button>
        ))}
        <select value={filterClass} onChange={e=>setFilterClass(e.target.value)}
          style={{ padding:'5px 10px', border:'1px solid #D1D5DB', borderRadius:20, fontSize:12, marginLeft:'auto' }}>
          {CLASSES.map(c=><option key={c}>Class {c}</option>)}
        </select>
      </div>

      {/* Items grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px,1fr))', gap:12 }}>
        {filtered.map(item => {
          const s = TYPE_STYLE[item.type] || TYPE_STYLE['Notice']
          const isOverdue = item.due_date && new Date(item.due_date) < new Date()
          return (
            <div key={item.id} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'1rem', borderLeft:`3px solid ${s.dot}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  <span style={{ background:s.bg, color:s.color, padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:500 }}>{item.type}</span>
                  <span style={{ background:'#F3F4F6', color:'#4B5563', padding:'2px 8px', borderRadius:20, fontSize:11 }}>Class {item.class_target}</span>
                  {item.priority==='High' && <span style={{ background:'#FEF2F2', color:'#DC2626', padding:'2px 8px', borderRadius:20, fontSize:11 }}>🔴 High</span>}
                </div>
                <button onClick={()=>deleteItem(item.id)} style={{ padding:'2px 7px', background:'#FEF2F2', color:'#DC2626', border:'none', borderRadius:6, fontSize:11, cursor:'pointer' }}>✕</button>
              </div>
              <h3 style={{ fontSize:14, fontWeight:500, marginBottom:6 }}>{item.title}</h3>
              {item.description && <p style={{ fontSize:12, color:'#6b7280', marginBottom:8, lineHeight:1.5 }}>{item.description}</p>}
              <div style={{ display:'flex', gap:12, fontSize:11, color:'#9CA3AF' }}>
                {item.subject && item.subject!=='General' && <span>📚 {item.subject}</span>}
                {item.due_date && <span style={{ color: isOverdue?'#DC2626':'#9CA3AF' }}>📅 Due: {item.due_date} {isOverdue?'(Overdue)':''}</span>}
                <span style={{ marginLeft:'auto' }}>{new Date(item.created_at).toLocaleDateString('en-IN')}</span>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'3rem', color:'#9CA3AF' }}>
            <p style={{ fontSize:32, marginBottom:8 }}>📌</p>
            <p style={{ fontSize:14 }}>Koi notice nahi hai</p>
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:12, padding:'1.5rem', width:480, maxHeight:'90vh', overflowY:'auto' }}>
            <h3 style={{ fontSize:16, fontWeight:600, marginBottom:'1.25rem' }}>Naya Notice / Homework</h3>
            <form onSubmit={addItem}>
              <div style={{ marginBottom:'1rem' }}>
                <label style={labelStyle}>Title *</label>
                <input required style={inputStyle} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Math homework Chapter 5" />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={labelStyle}>Type</label>
                  <select style={inputStyle} value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
                    {TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>For Class</label>
                  <select style={inputStyle} value={form.class_target} onChange={e=>setForm({...form,class_target:e.target.value})}>
                    {CLASSES.map(c=><option key={c} value={c}>{c==='All'?'All Classes':'Class '+c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Subject</label>
                  <select style={inputStyle} value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})}>
                    {SUBJECTS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Due Date</label>
                  <input type="date" style={inputStyle} value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})} />
                </div>
                <div>
                  <label style={labelStyle}>Priority</label>
                  <select style={inputStyle} value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>
                    <option>Normal</option><option>High</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop:'1rem' }}>
                <label style={labelStyle}>Description</label>
                <textarea style={{ ...inputStyle, minHeight:80, resize:'vertical' }} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Detail mein likhein..." />
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:'1.25rem', paddingTop:'1rem', borderTop:'1px solid #e5e7eb' }}>
                <button type="button" onClick={()=>setShowModal(false)} style={{ padding:'8px 16px', border:'1px solid #D1D5DB', borderRadius:8, fontSize:13, cursor:'pointer', background:'#fff' }}>Cancel</button>
                <button type="submit" style={{ padding:'8px 16px', background:'#1D4ED8', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>Post</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
