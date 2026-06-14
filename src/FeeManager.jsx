import React, { useState } from 'react'
import { Check, Plus, Printer, Receipt, Save, Search, X, Pencil, Trash2, Eye, RotateCcw } from 'lucide-react'

const feeHeads = ['Tuition Fee', 'Exam Fee', 'IT Fee', 'Annual Charges', 'Absent Fine', 'Admission Fee', 'Fine', 'Other', 'Previous Due', 'Development Charge']
const feeMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March']
const defaultGroups = [
  { id: 'regular', name: 'REGULAR', order: 1, createdBy: 'System', createdAt: 0 },
  { id: 'staff-ward', name: 'STAFF WARD', order: 2, createdBy: 'System', createdAt: 0 },
  { id: 'sibling', name: 'SIBLING', order: 3, createdBy: 'System', createdAt: 0 },
  { id: 'new-admission', name: 'NEW ADMISSION', order: 4, createdBy: 'System', createdAt: 0 },
]
const today = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0))

function SubmitFee({ students, onSubmit, onOpenProfile }) {
  const [searchBy, setSearchBy] = useState('Admission No.')
  const [query, setQuery] = useState('')
  const [student, setStudent] = useState(null)
  const [rows, setRows] = useState([{ id: 1, selected: true, head: 'Tuition Fee', due: 18500, previous: 0, discount: 0 }])
  const [payments, setPayments] = useState([{ id: 1, type: 'CASH', amount: 0 }])
  const [form, setForm] = useState({ feeGroup: 'REGULAR', setType: 'Group Wise', newAdmission: 'Yes', ledger: 'Tuition Fee', cardNo: '', receiptDate: today(), month: 'June', remark: '', sms: true, whatsapp: false })
  const [saving, setSaving] = useState(false)
  const [receiptNumber, setReceiptNumber] = useState('')
  const matches = query.trim() && !student ? students.filter(item => {
    const source = searchBy === 'Admission No.' ? item.roll : searchBy === 'Student Name' ? item.name : item.phone
    return String(source).toLowerCase().includes(query.trim().toLowerCase())
  }).slice(0, 6) : []
  const selectedRows = rows.filter(row => row.selected)
  const totalDue = selectedRows.reduce((sum, row) => sum + Number(row.due || 0), 0)
  const previousDue = selectedRows.reduce((sum, row) => sum + Number(row.previous || 0), 0)
  const discount = selectedRows.reduce((sum, row) => sum + Number(row.discount || 0), 0)
  const grandTotal = Math.max(0, totalDue + previousDue - discount)
  const paidAmount = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const balance = Math.max(0, grandTotal - paidAmount)
  const updateRow = (id, patch) => setRows(current => current.map(row => row.id === id ? { ...row, ...patch } : row))
  const updatePayment = (id, patch) => setPayments(current => current.map(payment => payment.id === id ? { ...payment, ...patch } : payment))
  const selectStudent = item => {
    setStudent(item)
    setQuery(`${item.roll} - ${item.name}`)
    setReceiptNumber('')
    setForm(current => ({ ...current, feeGroup: (item.feeGroup || 'REGULAR').toUpperCase() }))
  }
  const submit = async event => {
    event.preventDefault()
    if (!student || paidAmount <= 0) return
    setSaving(true)
    try {
      const number = await onSubmit({
        studentId: student.id,
        studentName: student.name,
        admissionNumber: student.roll,
        className: student.className,
        feeGroup: form.feeGroup,
        feeSetType: form.setType,
        billingMonth: form.month,
        receiptDate: form.receiptDate,
        feeCardNo: form.cardNo,
        remark: form.remark,
        sendSms: form.sms,
        sendWhatsapp: form.whatsapp,
        feeItems: selectedRows.map(row => ({ ...row, total: Number(row.due || 0) + Number(row.previous || 0) - Number(row.discount || 0) })),
        totalDue: grandTotal,
        discount,
        paidAmount,
        balance,
        payments,
      })
      setReceiptNumber(number)
    } finally {
      setSaving(false)
    }
  }

  return <form className="fee-submit-workspace" onSubmit={submit}>
    <section className="panel fee-search-panel">
      <div className="fee-step-title"><span className="step-number">1</span><div><strong>Find student</strong><small>Search and select an account to collect fee</small></div></div>
      <select value={searchBy} onChange={event => { setSearchBy(event.target.value); setStudent(null); setQuery('') }}><option>Admission No.</option><option>Student Name</option><option>Phone</option></select>
      <div className="fee-student-search">
        <Search size={16} />
        <input value={query} onChange={event => { setQuery(event.target.value); setStudent(null); setReceiptNumber('') }} placeholder={`Enter ${searchBy.toLowerCase()}`} />
        {matches.length > 0 && <div className="fee-search-results">{matches.map(item => <button type="button" key={item.id} onClick={() => selectStudent(item)}><strong>{item.name}</strong><small>{item.roll} - {item.className} - {item.phone}</small></button>)}</div>}
      </div>
    </section>

    {!student && <div className="empty-state fee-empty"><Search size={30} /><strong>Search a student to submit fee</strong><p>Use admission number, student name or phone number.</p></div>}

    {student && <div className="fee-detail-layout">
      <section className="panel student-fee-card">
        <div className="panel-header"><div><h3>Student Details</h3><p>Current admission record</p></div><span className={`avatar tone-${student.tone}`}>{student.initials}</span></div>
        <dl>
          <dt>Name</dt><dd>{student.name}</dd>
          <dt>Class</dt><dd>{student.className}</dd>
          <dt>Father Name</dt><dd>{student.fatherName || student.guardian}</dd>
          <dt>Mobile No</dt><dd>{student.phone}</dd>
          <dt>Adm No</dt><dd><strong>{student.roll}</strong><button type="button" className="text-button">Edit</button><button type="button" className="text-button" onClick={() => onOpenProfile(student)}>Profile</button></dd>
        </dl>
        <div className="fee-side-fields">
          <label>Fee Group<select value={form.feeGroup} onChange={event => setForm({ ...form, feeGroup: event.target.value })}><option>REGULAR</option><option>STAFF WARD</option><option>SIBLING</option><option>NO FEE</option></select></label>
          <label>Fee Set Type<select value={form.setType} onChange={event => setForm({ ...form, setType: event.target.value })}><option>Group Wise</option><option>Student Wise</option></select></label>
          <label>New Adm<select value={form.newAdmission} onChange={event => setForm({ ...form, newAdmission: event.target.value })}><option>Yes</option><option>No</option></select></label>
          <label>Compulsory Ledger<select value={form.ledger} onChange={event => setForm({ ...form, ledger: event.target.value })}>{feeHeads.map(head => <option key={head}>{head}</option>)}</select></label>
          <label>Fee Card No<input value={form.cardNo} onChange={event => setForm({ ...form, cardNo: event.target.value })} placeholder="Optional" /></label>
        </div>
      </section>

      <section className="panel fee-entry-panel">
        <div className="receipt-fields">
          <label>Receipt No<input readOnly value={receiptNumber || 'Auto generated after submit'} /></label>
          <label>Receipt Date<input type="date" value={form.receiptDate} onChange={event => setForm({ ...form, receiptDate: event.target.value })} /></label>
          <label>Select Fee Month<select value={form.month} onChange={event => setForm({ ...form, month: event.target.value })}>{feeMonths.map(month => <option key={month}>{month}</option>)}</select></label>
        </div>

        <div className="table-scroll"><table className="fee-entry-table">
          <thead><tr><th></th><th>Fee Head</th><th>Fee Due</th><th>Previous Due</th><th>Discount</th><th>Total</th><th>Paid</th><th>Balance</th></tr></thead>
          <tbody>
            {rows.map(row => {
              const rowTotal = Math.max(0, Number(row.due || 0) + Number(row.previous || 0) - Number(row.discount || 0))
              const allocated = grandTotal ? Math.min(rowTotal, paidAmount * rowTotal / grandTotal) : 0
              return <tr key={row.id}>
                <td><input type="checkbox" checked={row.selected} onChange={event => updateRow(row.id, { selected: event.target.checked })} /></td>
                <td><select value={row.head} onChange={event => updateRow(row.id, { head: event.target.value })}>{feeHeads.map(head => <option key={head}>{head}</option>)}</select></td>
                <td><input type="number" min="0" value={row.due} onChange={event => updateRow(row.id, { due: event.target.value })} /></td>
                <td><input type="number" min="0" value={row.previous} onChange={event => updateRow(row.id, { previous: event.target.value })} /></td>
                <td><input type="number" min="0" value={row.discount} onChange={event => updateRow(row.id, { discount: event.target.value })} /></td>
                <td>{money(rowTotal)}</td><td>{money(allocated)}</td><td>{money(Math.max(0, rowTotal - allocated))}</td>
              </tr>
            })}
            <tr className="fee-total-row"><td></td><td><strong>Total</strong></td><td>{money(totalDue)}</td><td>{money(previousDue)}</td><td>{money(discount)}</td><td>{money(grandTotal)}</td><td>{money(Math.min(grandTotal, paidAmount))}</td><td>{money(balance)}</td></tr>
          </tbody>
        </table></div>
        <button type="button" className="text-button add-fee-head" onClick={() => setRows(current => [...current, { id: Date.now(), selected: true, head: 'Exam Fee', due: 0, previous: 0, discount: 0 }])}><Plus size={14} /> Add fee head</button>
        <label className="fee-remark">Remark<textarea value={form.remark} onChange={event => setForm({ ...form, remark: event.target.value })} placeholder="Add payment note" /></label>

        <div className="payment-section">
          <div className="payment-title"><div><strong>Payment Mode</strong><small>Add one or multiple payment methods</small></div><button type="button" className="icon-button add-payment" title="Add payment mode" onClick={() => setPayments(current => [...current, { id: Date.now(), type: 'UPI', amount: 0 }])}><Plus size={17} /></button></div>
          {payments.map((payment, index) => <div className="payment-row" key={payment.id}>
            <label>Payment Type<select value={payment.type} onChange={event => updatePayment(payment.id, { type: event.target.value })}><option>CASH</option><option>UPI</option><option>NEFT</option><option>Cheque</option></select></label>
            <label>Paid amount<input type="number" min="0" value={payment.amount} onChange={event => updatePayment(payment.id, { amount: event.target.value })} /></label>
            {index > 0 && <button type="button" className="icon-button" title="Remove payment mode" onClick={() => setPayments(current => current.filter(item => item.id !== payment.id))}><X size={16} /></button>}
          </div>)}
          <div className="balance-box"><span>Balance Left</span><strong>{money(balance)}</strong></div>
        </div>

        <div className="fee-submit-footer">
          <div className="fee-switches"><label><input type="checkbox" checked={form.sms} onChange={event => setForm({ ...form, sms: event.target.checked })} /> Send SMS</label><label><input type="checkbox" checked={form.whatsapp} onChange={event => setForm({ ...form, whatsapp: event.target.checked })} /> Send WhatsApp</label></div>
          <button className="primary-button" disabled={saving || paidAmount <= 0}><Receipt size={16} /> {saving ? 'Submitting...' : 'Submit Fee'}</button>
        </div>
        {receiptNumber && <div className="success-banner"><Check size={16} /> Fee submitted successfully. Receipt <strong>{receiptNumber}</strong></div>}
      </section>
    </div>}
  </form>
}

function FeeGroupPage({ groups, onSave, onDelete }) {
  const rows = [...defaultGroups, ...Object.values(groups).filter(group => !defaultGroups.some(item => item.id === group.id))]
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const visible = rows.filter(group => group.name.toLowerCase().includes(search.toLowerCase()))
  const save = async event => {
    event.preventDefault()
    await onSave(editing)
    setEditing(null)
  }
  return <>
    <div className="fee-page-toolbar"><select><option>All</option></select><div className="table-search"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search fee group" /></div><button className="primary-button" onClick={() => setEditing({ name: '', order: rows.length + 1 })}><Plus size={16} /> Add group</button></div>
    <div className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>#</th><th>Actions</th><th>Fee Group Name</th><th>Order No</th><th>Created By</th><th>Created On</th></tr></thead><tbody>
      {visible.map((group, index) => <tr key={group.id}><td>{index + 1}</td><td className="action-cell"><button className="icon-button" onClick={() => setEditing(group)} title="Edit group"><Pencil size={14} /></button>{!defaultGroups.some(item => item.id === group.id) && <button className="icon-button danger" onClick={() => onDelete(group.id)} title="Delete group"><Trash2 size={14} /></button>}</td><td><strong>{group.name}</strong></td><td>{group.order}</td><td>{group.createdBy || 'Administrator'}</td><td>{group.createdAt ? new Date(group.createdAt).toLocaleDateString('en-IN') : 'Default'}</td></tr>)}
    </tbody></table></div></div>
    {editing && <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-header"><div><h3>{editing.id ? 'Edit fee group' : 'Add fee group'}</h3><p>Groups control reusable student fee rules.</p></div><button type="button" className="icon-button" onClick={() => setEditing(null)}><X size={18} /></button></div><div className="form-grid"><label className="full">Fee Group Name<input required value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value.toUpperCase() })} /></label><label>Order No<input type="number" min="1" value={editing.order} onChange={event => setEditing({ ...editing, order: Number(event.target.value) })} /></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setEditing(null)}>Cancel</button><button className="primary-button"><Save size={15} /> Save group</button></div></form></div>}
  </>
}

function SetFeePage({ students, groups, structures, onSave, onDelete }) {
  const classes = [...new Set(students.map(student => student.className.split('-')[0]))]
  const [mode, setMode] = useState('By Group Wise')
  const [className, setClassName] = useState('All Classes')
  const [section, setSection] = useState('All Sections')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ target: 'REGULAR', className: classes[0] || '1', section: 'A', feeHead: 'Tuition Fee', amount: 18500, frequency: 'Monthly' })
  const rows = Object.values(structures).filter(row => (className === 'All Classes' || row.className === className) && (section === 'All Sections' || row.section === section))
  const save = async event => {
    event.preventDefault()
    await onSave({ ...form, mode })
    setEditing(false)
  }
  const groupRows = [...defaultGroups, ...Object.values(groups).filter(group => !defaultGroups.some(item => item.id === group.id))]
  return <>
    <div className="fee-page-toolbar wrap"><label>Search Fee Structure<select value={mode} onChange={event => setMode(event.target.value)}><option>By Student Wise</option><option>By Group Wise</option></select></label><label>Class<select value={className} onChange={event => setClassName(event.target.value)}><option>All Classes</option>{classes.map(item => <option key={item}>{item}</option>)}</select></label><label>Section<select value={section} onChange={event => setSection(event.target.value)}><option>All Sections</option>{['A','B','C','D'].map(item => <option key={item}>{item}</option>)}</select></label><span /><button className="secondary-button" onClick={() => window.print()}><Printer size={15} /> Print</button><button className="primary-button" onClick={() => setEditing(true)}><Plus size={15} /> Add</button></div>
    <div className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>Set Type</th><th>Target</th><th>Class</th><th>Section</th><th>Fee Head</th><th>Amount</th><th>Frequency</th><th>Action</th></tr></thead><tbody>
      {rows.map(row => <tr key={row.id}><td>{row.mode}</td><td>{row.target}</td><td>{row.className}</td><td>{row.section}</td><td>{row.feeHead}</td><td><strong>{money(row.amount)}</strong></td><td>{row.frequency}</td><td><button className="icon-button danger" title="Delete structure" onClick={() => onDelete(row.id)}><Trash2 size={14} /></button></td></tr>)}
      {!rows.length && <tr><td colSpan="8"><div className="empty-state">No fee structure for these filters. Use Add to create one.</div></td></tr>}
    </tbody></table></div></div>
    {editing && <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-header"><div><h3>Add fee structure</h3><p>{mode}</p></div><button type="button" className="icon-button" onClick={() => setEditing(false)}><X size={18} /></button></div><div className="form-grid"><label className="full">{mode === 'By Group Wise' ? 'Fee Group' : 'Student'}<select value={form.target} onChange={event => setForm({ ...form, target: event.target.value })}>{mode === 'By Group Wise' ? groupRows.map(group => <option key={group.id}>{group.name}</option>) : students.map(student => <option key={student.id} value={student.id}>{student.name} - {student.roll}</option>)}</select></label><label>Class<select value={form.className} onChange={event => setForm({ ...form, className: event.target.value })}>{classes.map(item => <option key={item}>{item}</option>)}</select></label><label>Section<select value={form.section} onChange={event => setForm({ ...form, section: event.target.value })}>{['A','B','C','D'].map(item => <option key={item}>{item}</option>)}</select></label><label>Fee Head<select value={form.feeHead} onChange={event => setForm({ ...form, feeHead: event.target.value })}>{feeHeads.map(item => <option key={item}>{item}</option>)}</select></label><label>Amount<input type="number" min="0" value={form.amount} onChange={event => setForm({ ...form, amount: Number(event.target.value) })} /></label><label>Frequency<select value={form.frequency} onChange={event => setForm({ ...form, frequency: event.target.value })}><option>Monthly</option><option>Quarterly</option><option>Yearly</option><option>One Time</option></select></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setEditing(false)}>Cancel</button><button className="primary-button"><Save size={15} /> Save structure</button></div></form></div>}
  </>
}

function ReceiptPreview({ receipt, settings, close }) {
  return <div className="modal-backdrop"><div className="modal receipt-preview">
    <div className="modal-header"><div><h3>Fee Receipt</h3><p>{receipt.receiptNumber || receipt.invoiceNumber}</p></div><button className="icon-button" onClick={close}><X size={18} /></button></div>
    <div className="receipt-document">
      <div className="receipt-brand"><div><strong>NXT OpenERP School</strong>{settings.showAddress !== false && <small>Delhi, India</small>}</div><span>PAID RECEIPT</span></div>
      <dl><dt>Student</dt><dd>{receipt.studentName}</dd><dt>Admission No.</dt><dd>{receipt.admissionNumber}</dd><dt>Class</dt><dd>{receipt.className}</dd><dt>Fee Month</dt><dd>{receipt.billingMonth}</dd><dt>Receipt Date</dt><dd>{receipt.receiptDate || new Date(receipt.paidAt).toLocaleDateString('en-IN')}</dd>{settings.showMode !== false && <><dt>Payment Mode</dt><dd>{receipt.method}</dd></>}</dl>
      <table><thead><tr><th>Fee Head</th><th>Total</th></tr></thead><tbody>{(receipt.feeItems || [{ head: 'Fee Payment', total: receipt.totalDue || receipt.amount }]).map((item, index) => <tr key={`${item.head}-${index}`}><td>{item.head}</td><td>{money(item.total)}</td></tr>)}</tbody></table>
      <div className="receipt-totals"><span>Paid <strong>{money(receipt.amount)}</strong></span><span>Balance <strong>{money(receipt.balance)}</strong></span></div>
      {receipt.remark && <p><strong>Remark:</strong> {receipt.remark}</p>}
      <small>{settings.footer || 'Fee once paid is non-refundable.'}</small>
    </div>
    <div className="modal-actions"><button className="secondary-button" onClick={close}>Close</button><button className="primary-button" onClick={() => window.print()}><Printer size={15} /> Print receipt</button></div>
  </div></div>
}

function FeeReportPage({ page, students, fees, feeManager, approvals, onSaveConfig, onDeleteReceipt, onRestoreReceipt, onDecideApproval }) {
  const payments = Object.entries(fees).map(([id, row]) => ({ id, ...row })).sort((a, b) => (b.paidAt || 0) - (a.paidAt || 0))
  const titles = { defaulters: 'Fee Defaulters', register: 'Fee Register', report: 'Master Fee Report', fine: 'Manage Fine', approve: 'Fee Approvals', deleted: 'Deleted Fee Record', 'receipt-settings': 'Receipt Settings' }
  const savedSettings = feeManager.settings?.config || {}
  const [settings, setSettings] = useState({ prefix: savedSettings.prefix || 'REC-2026', start: savedSettings.start || 1, footer: savedSettings.footer || 'Fee once paid is non-refundable.', showAddress: savedSettings.showAddress !== false, showMode: savedSettings.showMode !== false })
  const [fineForm, setFineForm] = useState(null)
  const [saved, setSaved] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState(null)
  const saveSettings = async () => { await onSaveConfig('settings', settings); setSaved(true); setTimeout(() => setSaved(false), 1600) }
  const saveFine = async event => { event.preventDefault(); await onSaveConfig('fines', fineForm, fineForm.id || `fine_${Date.now()}`); setFineForm(null) }
  if (page === 'receipt-settings') return <div className="panel settings-form"><div className="panel-header"><div><h3>Receipt Settings</h3><p>Configure receipt identity and print defaults.</p></div></div><div className="form-grid"><label>Receipt Prefix<input value={settings.prefix} onChange={event => setSettings({ ...settings, prefix: event.target.value })} /></label><label>Starting Number<input type="number" value={settings.start} onChange={event => setSettings({ ...settings, start: Number(event.target.value) })} /></label><label className="full">Footer Note<input value={settings.footer} onChange={event => setSettings({ ...settings, footer: event.target.value })} /></label><label><input type="checkbox" checked={settings.showAddress} onChange={event => setSettings({ ...settings, showAddress: event.target.checked })} /> Show school address</label><label><input type="checkbox" checked={settings.showMode} onChange={event => setSettings({ ...settings, showMode: event.target.checked })} /> Show payment mode</label></div><div className="modal-actions"><button className="primary-button" onClick={saveSettings}>{saved ? <Check size={15} /> : <Save size={15} />} {saved ? 'Settings saved' : 'Save settings'}</button></div></div>
  if (page === 'fine') return <><div className="panel settings-form"><div className="panel-header"><div><h3>Manage Fine</h3><p>Create reusable late and absence fine rules.</p></div><button className="primary-button" onClick={() => setFineForm({ name: '', type: 'Late Fee', amount: 100, triggerAfter: 10 })}><Plus size={15} /> Add fine rule</button></div>{Object.values(feeManager.fines || {}).length ? <div className="table-scroll"><table><thead><tr><th>Rule</th><th>Type</th><th>Amount</th><th>Trigger after</th><th>Action</th></tr></thead><tbody>{Object.values(feeManager.fines).map(rule => <tr key={rule.id}><td><strong>{rule.name}</strong></td><td>{rule.type}</td><td>{money(rule.amount)}</td><td>{rule.triggerAfter} days</td><td><button className="icon-button" onClick={() => setFineForm(rule)}><Pencil size={14} /></button></td></tr>)}</tbody></table></div> : <div className="empty-state">No fine rules configured yet.</div>}</div>{fineForm && <div className="modal-backdrop"><form className="modal" onSubmit={saveFine}><div className="modal-header"><div><h3>Fine rule</h3><p>Automatically reusable during fee collection.</p></div><button type="button" className="icon-button" onClick={() => setFineForm(null)}><X size={18} /></button></div><div className="form-grid"><label className="full">Rule Name<input required value={fineForm.name} onChange={event => setFineForm({ ...fineForm, name: event.target.value })} /></label><label>Fine Type<select value={fineForm.type} onChange={event => setFineForm({ ...fineForm, type: event.target.value })}><option>Late Fee</option><option>Absent Fine</option><option>Other</option></select></label><label>Amount<input type="number" min="0" value={fineForm.amount} onChange={event => setFineForm({ ...fineForm, amount: Number(event.target.value) })} /></label><label>Trigger After (days)<input type="number" min="0" value={fineForm.triggerAfter} onChange={event => setFineForm({ ...fineForm, triggerAfter: Number(event.target.value) })} /></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setFineForm(null)}>Cancel</button><button className="primary-button"><Save size={15} /> Save rule</button></div></form></div>}</>
  if (page === 'deleted') {
    const deletedRows = Object.entries(feeManager.deleted || {}).map(([id, row]) => ({ id, ...row }))
    return <div className="panel table-panel"><div className="panel-header"><div><h3>Deleted Fee Record</h3><p>Restore receipts removed by mistake</p></div></div><div className="table-scroll"><table><thead><tr><th>Receipt</th><th>Student</th><th>Amount</th><th>Deleted On</th><th>Action</th></tr></thead><tbody>{deletedRows.map(row => <tr key={row.id}><td>{row.receiptNumber}</td><td>{row.studentName}</td><td>{money(row.amount)}</td><td>{new Date(row.deletedAt).toLocaleString('en-IN')}</td><td><button className="secondary-button" onClick={() => onRestoreReceipt(row.id)}><RotateCcw size={14} /> Restore</button></td></tr>)}{!deletedRows.length && <tr><td colSpan="5"><div className="empty-state">No deleted fee records.</div></td></tr>}</tbody></table></div></div>
  }
  if (page === 'approve') {
    const approvalRows = Object.entries(approvals || {}).map(([id, row]) => ({ id, ...row })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    return <div className="panel table-panel"><div className="panel-header"><div><h3>Fee Approvals</h3><p>Review partial payments and discounts</p></div></div><div className="table-scroll"><table><thead><tr><th>Receipt</th><th>Student</th><th>Paid</th><th>Discount</th><th>Balance</th><th>Status</th><th>Decision</th></tr></thead><tbody>{approvalRows.map(row => <tr key={row.id}><td>{row.receiptNumber}</td><td>{row.studentName}</td><td>{money(row.amount)}</td><td>{money(row.discount)}</td><td>{money(row.balance)}</td><td><span className={`status ${row.status === 'approved' ? 'paid' : 'pending'}`}>{row.status}</span></td><td>{row.status === 'pending' ? <div className="approval-actions"><button className="secondary-button approve" onClick={() => onDecideApproval(row.id, 'approved')}><Check size={14} /> Approve</button><button className="secondary-button reject" onClick={() => onDecideApproval(row.id, 'rejected')}><X size={14} /> Reject</button></div> : '-'}</td></tr>)}{!approvalRows.length && <tr><td colSpan="7"><div className="empty-state">No fee approvals waiting.</div></td></tr>}</tbody></table></div></div>
  }
  const rows = page === 'defaulters'
    ? students.filter(student => student.fee !== 'Paid').map(student => ({ studentId: student.id, studentName: student.name, admissionNumber: student.roll, className: student.className, amount: 18500, status: student.fee }))
    : payments
  return <><div className="section-actions compact"><div><h2>{titles[page]}</h2><p>Live records from Firebase</p></div><button className="secondary-button" onClick={() => window.print()}><Printer size={15} /> Print</button></div><div className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>Student</th><th>Admission No.</th><th>Class</th><th>Receipt</th><th>Amount</th><th>Date</th><th>Status</th><th>Action</th></tr></thead><tbody>
    {rows.map((row, index) => {
      const student = students.find(item => item.id === row.studentId)
      return <tr key={row.receiptNumber || `${row.studentId}-${index}`}><td><strong>{row.studentName || student?.name || 'Student'}</strong></td><td>{row.admissionNumber || student?.roll || '-'}</td><td>{row.className || student?.className || '-'}</td><td>{row.receiptNumber || row.invoiceNumber || '-'}</td><td>{money(row.amount)}</td><td>{row.paidAt ? new Date(row.paidAt).toLocaleDateString('en-IN') : '-'}</td><td><span className={`status ${row.status === 'paid' ? 'paid' : 'pending'}`}>{row.status || 'Pending'}</span></td><td>{row.id ? <div className="action-cell"><button className="icon-button" title="View receipt" onClick={() => setSelectedReceipt(row)}><Eye size={14} /></button><button className="icon-button danger" title="Delete receipt" onClick={() => onDeleteReceipt(row.id)}><Trash2 size={14} /></button></div> : '-'}</td></tr>
    })}
    {!rows.length && <tr><td colSpan="8"><div className="empty-state">No records available yet.</div></td></tr>}
  </tbody></table></div></div>{selectedReceipt && <ReceiptPreview receipt={selectedReceipt} settings={savedSettings} close={() => setSelectedReceipt(null)} />}</>
}

export default function FeeManager({ students, fees, feeManager, approvals, onSubmitFee, onSaveGroup, onDeleteGroup, onSaveStructure, onDeleteStructure, onDeleteReceipt, onRestoreReceipt, onDecideApproval, onSaveConfig, onOpenProfile }) {
  const [page, setPage] = useState('submit')
  const menu = [['submit','Submit Fee'],['groups','Fee Group'],['set','Set Fee'],['fine','Manage Fine'],['defaulters','Defaulters'],['register','Fee Register'],['report','Master Fee Report'],['receipt-settings','Receipt Settings'],['deleted','Deleted Fee Record'],['approve','Fee Approve']]
  return <>
    <div className="section-actions"><div><h2>Fee Manager</h2><p>Collect fees, configure structures and review every receipt.</p></div></div>
    <div className="fee-manager-tabs">{menu.map(([id, label]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}>{label}</button>)}</div>
    {page === 'submit' && <SubmitFee students={students} onSubmit={onSubmitFee} onOpenProfile={onOpenProfile} />}
    {page === 'groups' && <FeeGroupPage groups={feeManager.groups} onSave={onSaveGroup} onDelete={onDeleteGroup} />}
    {page === 'set' && <SetFeePage students={students} groups={feeManager.groups} structures={feeManager.structures} onSave={onSaveStructure} onDelete={onDeleteStructure} />}
    {!['submit','groups','set'].includes(page) && <FeeReportPage page={page} students={students} fees={fees} feeManager={feeManager} approvals={approvals} onSaveConfig={onSaveConfig} onDeleteReceipt={onDeleteReceipt} onRestoreReceipt={onRestoreReceipt} onDecideApproval={onDecideApproval} />}
  </>
}
