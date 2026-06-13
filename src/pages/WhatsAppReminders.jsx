import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// WhatsApp Web URL se message bhejta hai — no API key needed, free!
function sendWhatsApp(phone, message) {
  const cleaned = phone.replace(/\D/g, '')
  const number = cleaned.startsWith('91') ? cleaned : '91' + cleaned
  const encoded = encodeURIComponent(message)
  window.open(`https://wa.me/${number}?text=${encoded}`, '_blank')
}

const TEMPLATES = {
  pending: (name, amount, month) =>
    `Namaskar! 🙏\n\n*${name}* ji,\n\nApke ward ka *${month}* ka school fee *₹${amount}* abhi tak pending hai.\n\nKripya jaldi se school mein jama karein.\n\nDhanyavaad 🙏\n_School Administration_`,
  overdue: (name, amount, month) =>
    `⚠️ *Fee Overdue Notice*\n\nNamaskar *${name}* ji,\n\nApke ward ka *${month}* ka fee *₹${amount}* overdue ho chuka hai.\n\nKripya aaj hi school mein contact karein.\n\nDhanyavaad\n_School Administration_`,
  reminder: (name, amount, month) =>
    `📢 *Fee Reminder*\n\nNamaskar *${name}* ji,\n\nYeh ek yaad dihani hai ki *${month}* ka fee *₹${amount}* baaki hai.\n\nSchool timing: 8AM - 2PM\n\nDhanyavaad 🙏`,
  receipt: (name, amount, month) =>
    `✅ *Fee Receipt*\n\nNamaskar *${name}* ji,\n\n*${month}* ka fee *₹${amount}* receive ho gaya. Shukriya! 🙏\n\n_School Administration_`,
}

export default function WhatsAppReminders() {
  const [fees, setFees] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('Pending')
  const [sent, setSent] = useState({})
  const [customMsg, setCustomMsg] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [selectedFees, setSelectedFees] = useState([])

  useEffect(() => { fetchFees() }, [filter])

  async function fetchFees() {
    setLoading(true)
    let query = supabase.from('fees')
      .select('*, students(name, phone, guardian_name)')
      .order('created_at', { ascending: false })
    if (filter !== 'All') query = query.eq('status', filter)
    const { data } = await query
    if (data) setFees(data.filter(f => f.students?.phone))
    setLoading(false)
  }

  function handleSend(fee, templateKey) {
    const guardian = fee.students?.guardian_name || fee.students?.name
    const msg = TEMPLATES[templateKey]?.(guardian, fee.amount?.toLocaleString('en-IN'), fee.month) ||
      customMsg.replace('{name}', guardian).replace('{amount}', fee.amount).replace('{month}', fee.month)
    sendWhatsApp(fee.students.phone, msg)
    setSent(prev => ({ ...prev, [fee.id]: true }))
  }

  function handleBulkSend() {
    const toSend = fees.filter(f => selectedFees.includes(f.id))
    toSend.forEach((fee, i) => {
      setTimeout(() => {
        const guardian = fee.students?.guardian_name || fee.students?.name
        const key = fee.status === 'Overdue' ? 'overdue' : 'pending'
        const msg = TEMPLATES[key](guardian, fee.amount?.toLocaleString('en-IN'), fee.month)
        sendWhatsApp(fee.students.phone, msg)
        setSent(prev => ({ ...prev, [fee.id]: true }))
      }, i * 1500) // 1.5s gap between each to avoid spam
    })
    setSelectedFees([])
  }

  const toggleSelect = (id) => setSelectedFees(prev =>
    prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
  )

  const selectAll = () => setSelectedFees(
    selectedFees.length === fees.length ? [] : fees.map(f => f.id)
  )

  const badgeStyle = (status) => ({
    Paid: { bg: '#DCFCE7', color: '#166534' },
    Pending: { bg: '#FEF9C3', color: '#854D0E' },
    Overdue: { bg: '#FEF2F2', color: '#DC2626' }
  })[status] || { bg: '#F3F4F6', color: '#374151' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>WhatsApp Fee Reminders</h2>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Parents ko directly WhatsApp pe fee reminder bhejo — free, no API needed</p>
        </div>
      </div>

      {/* How it works */}
      <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '1rem', marginBottom: '1.5rem', fontSize: 13 }}>
        <p style={{ fontWeight: 500, color: '#166534', marginBottom: 4 }}>✅ Yeh kaise kaam karta hai?</p>
        <p style={{ color: '#374151', lineHeight: 1.6 }}>
          Button dabao → WhatsApp Web/App khulega → Message already typed milega → Sirf "Send" dabao.<br />
          <strong>Koi API key nahi chahiye, bilkul free!</strong>
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Pending', value: fees.filter(f => f.status === 'Pending').length, color: '#854D0E', bg: '#FEF9C3' },
          { label: 'Overdue', value: fees.filter(f => f.status === 'Overdue').length, color: '#DC2626', bg: '#FEF2F2' },
          { label: 'Reminders Sent', value: Object.keys(sent).length, color: '#166534', bg: '#DCFCE7' },
          { label: 'With Phone', value: fees.length, color: '#1D4ED8', bg: '#EFF6FF' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '1rem' }}>
            <p style={{ fontSize: 12, color: s.color, marginBottom: 4, opacity: 0.8 }}>{s.label}</p>
            <p style={{ fontSize: 24, fontWeight: 600, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '1.25rem' }}>
        {/* Filters + bulk */}
        <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {['All', 'Pending', 'Overdue'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid',
              borderColor: filter === s ? '#1D4ED8' : '#D1D5DB',
              background: filter === s ? '#EFF6FF' : '#fff',
              color: filter === s ? '#1D4ED8' : '#374151' }}>{s}</button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {selectedFees.length > 0 && (
              <button onClick={handleBulkSend}
                style={{ padding: '6px 14px', background: '#25D366', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                📱 Send {selectedFees.length} Reminders
              </button>
            )}
            <button onClick={() => setShowCustom(!showCustom)}
              style={{ padding: '6px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: '#fff' }}>
              ✏️ Custom Message
            </button>
          </div>
        </div>

        {/* Custom message editor */}
        {showCustom && (
          <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '1rem', marginBottom: '1rem', border: '1px solid #e5e7eb' }}>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Custom message — use <code style={{ background: '#e5e7eb', padding: '1px 4px', borderRadius: 3 }}>{'{name}'}</code>, <code style={{ background: '#e5e7eb', padding: '1px 4px', borderRadius: 3 }}>{'{amount}'}</code>, <code style={{ background: '#e5e7eb', padding: '1px 4px', borderRadius: 3 }}>{'{month}'}</code></p>
            <textarea value={customMsg} onChange={e => setCustomMsg(e.target.value)} rows={4}
              placeholder="Namaskar {name} ji, {month} ka fee ₹{amount} pending hai..."
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
        )}

        {/* Select all */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid #F3F4F6' }}>
          <input type="checkbox" checked={selectedFees.length === fees.length && fees.length > 0}
            onChange={selectAll} style={{ width: 15, height: 15, cursor: 'pointer' }} />
          <span style={{ fontSize: 12, color: '#6b7280' }}>Select all ({fees.length})</span>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#9CA3AF', padding: '2rem' }}>Loading...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fees.map(fee => {
              const bs = badgeStyle(fee.status)
              const isSent = sent[fee.id]
              return (
                <div key={fee.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#F9FAFB', borderRadius: 8, border: selectedFees.includes(fee.id) ? '1px solid #BFDBFE' : '1px solid transparent' }}>
                  <input type="checkbox" checked={selectedFees.includes(fee.id)} onChange={() => toggleSelect(fee.id)} style={{ width: 15, height: 15, cursor: 'pointer' }} />

                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 500 }}>{fee.students?.guardian_name || fee.students?.name}</p>
                    <p style={{ fontSize: 11, color: '#6b7280' }}>📱 {fee.students?.phone} · {fee.month} · ₹{fee.amount?.toLocaleString('en-IN')}</p>
                  </div>

                  <span style={{ background: bs.bg, color: bs.color, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500 }}>{fee.status}</span>

                  {isSent && <span style={{ fontSize: 11, color: '#166534', background: '#DCFCE7', padding: '2px 8px', borderRadius: 20 }}>✓ Sent</span>}

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handleSend(fee, fee.status === 'Overdue' ? 'overdue' : 'pending')}
                      style={{ padding: '5px 12px', background: '#25D366', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                      📱 Remind
                    </button>
                    <button onClick={() => handleSend(fee, 'receipt')}
                      style={{ padding: '5px 12px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
                      Receipt
                    </button>
                  </div>
                </div>
              )
            })}
            {fees.length === 0 && (
              <p style={{ textAlign: 'center', color: '#9CA3AF', padding: '2rem', fontSize: 13 }}>Koi pending fee nahi hai 🎉</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
