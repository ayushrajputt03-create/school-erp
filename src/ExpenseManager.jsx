import React, { useMemo, useState } from 'react'
import {
  BarChart3, Check, Download, Edit3, FileText, IndianRupee, Plus,
  Printer, Search, Trash2, Upload, WalletCards,
} from 'lucide-react'
import imageCompression from 'browser-image-compression'
import DatePicker from './DatePicker'

const today = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}
const money = value => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`
const dateLabel = value => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
const monthLabel = value => new Date(`${value || today().slice(0, 7)}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
const values = object => Object.values(object || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
const currentMonth = () => today().slice(0, 7)
const currentYear = () => new Date().getFullYear()

const defaultCategories = [
  ['cat_salary', 'Salary & Wages', '#2563eb', '💼', 50000],
  ['cat_electricity', 'Electricity Bill', '#f97316', '⚡', 15000],
  ['cat_water', 'Water Bill', '#06b6d4', '💧', 5000],
  ['cat_internet', 'Internet/WiFi Bill', '#7c3aed', '📶', 3000],
  ['cat_stationery', 'Stationery & Supplies', '#16a34a', '📝', 5000],
  ['cat_furniture', 'Furniture & Equipment', '#92400e', '🪑', 10000],
  ['cat_maintenance', 'Building Maintenance', '#ca8a04', '🔧', 8000],
  ['cat_fuel', 'Transport Fuel', '#dc2626', '⛽', 12000],
  ['cat_exam', 'Exam Expenses', '#ef4444', '📋', 5000],
  ['cat_event', 'Event & Function', '#db2777', '🎉', 10000],
  ['cat_sports', 'Sports Equipment', '#0d9488', '⚽', 5000],
  ['cat_lab', 'Lab Equipment', '#4f46e5', '🔬', 8000],
  ['cat_library', 'Library Books', '#d97706', '📚', 5000],
  ['cat_security', 'Security', '#64748b', '🛡️', 10000],
  ['cat_housekeeping', 'Housekeeping', '#65a30d', '🧹', 6000],
  ['cat_phone', 'Phone/Recharge', '#8b5cf6', '📱', 2000],
  ['cat_marketing', 'Marketing/Advertising', '#fb7185', '📢', 5000],
  ['cat_legal', 'Legal & Audit', '#475569', '⚖️', 5000],
  ['cat_insurance', 'Insurance', '#052659', '🛡️', 8000],
  ['cat_misc', 'Miscellaneous', '#6b7280', '📦', 5000],
].map(([id, name, color, icon, monthlyBudget]) => ({ id, name, color, icon, monthlyBudget, status: 'Active', createdAt: 0, updatedAt: 0 }))

const normalizeExpenses = expenses => ({
  categories: {},
  items: {},
  budget: {},
  ...expenses,
  salary: { structures: {}, payments: {}, ...(expenses?.salary || {}) },
})
const getCategories = expenses => {
  const stored = values(expenses.categories)
  const ids = new Set(stored.map(item => item.id))
  return [...stored, ...defaultCategories.filter(item => !ids.has(item.id))]
}
const categoryById = (expenses, id) => getCategories(expenses).find(item => item.id === id) || defaultCategories[defaultCategories.length - 1]
const fileToDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('Could not read bill photo.'))
  reader.readAsDataURL(file)
})
async function compressBill(file) {
  const compressed = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1200, useWebWorker: true, initialQuality: 0.75 })
  return { file: compressed, url: await fileToDataUrl(compressed), size: compressed.size }
}
const employeeName = employee => `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.name || employee.employeeCode || 'Employee'
const calcSalary = row => {
  const basic = Number(row.basicSalary || 0)
  const da = Math.round(basic * Number(row.da || 0) / 100)
  const hra = Math.round(basic * Number(row.hra || 0) / 100)
  const ta = Number(row.ta || 0)
  const medical = Number(row.medical || 0)
  const pf = Math.round(basic * Number(row.pf || 0) / 100)
  const esi = Math.round(basic * Number(row.esi || 0) / 100)
  const tds = Number(row.tds || 0)
  const professionalTax = Number(row.professionalTax || 0)
  const other = (row.otherDeductions || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const earnings = basic + da + hra + ta + medical
  const deductions = pf + esi + tds + professionalTax + other
  return { daAmount: da, hraAmount: hra, totalEarnings: earnings, totalDeductions: deductions, netSalary: Math.max(0, earnings - deductions) }
}

function ExpenseTabs({ tab, setTab }) {
  const tabs = [['add', 'Add Expense'], ['list', 'Expense List'], ['categories', 'Categories'], ['salary', 'Salary Management'], ['budget', 'Budget'], ['reports', 'Reports']]
  return <div className="expense-tabs">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</div>
}

function CategoryBadge({ category }) {
  return <span className="expense-category-badge" style={{ '--cat': category.color }}>{category.icon} {category.name}</span>
}

function AddExpensePage({ expenses, saveItem }) {
  const cats = getCategories(expenses).filter(item => item.status !== 'Inactive')
  const [form, setForm] = useState({ date: today(), categoryId: cats[0]?.id || 'cat_misc', title: '', description: '', amount: '', paymentMode: 'Cash', transactionId: '', paidTo: '', vendorPhone: '', invoiceNo: '', recurring: 'No', approvedBy: 'Admin', status: 'approved' })
  const [saving, setSaving] = useState(false)
  const [photo, setPhoto] = useState(null)
  const [lastSaved, setLastSaved] = useState(null)
  const category = categoryById(expenses, form.categoryId)
  const onFile = async file => {
    if (!file) return
    const result = await compressBill(file)
    setPhoto({ ...result, name: file.name, originalSize: file.size })
  }
  const submit = async event => {
    event.preventDefault()
    try {
      setSaving(true)
      const row = {
        ...form,
        category: category.name,
        categoryColor: category.color,
        categoryIcon: category.icon,
        amount: Number(form.amount || 0),
        billPhotoURL: photo?.url || '',
        billPhotoName: photo?.name || '',
        billPhotoSize: photo?.size || 0,
        paidAt: new Date(`${form.date}T00:00:00`).getTime(),
      }
      const saved = await saveItem('items', row)
      if (form.recurring !== 'No') {
        const nextDate = new Date(`${form.date}T00:00:00`)
        nextDate.setMonth(nextDate.getMonth() + (form.recurring === 'Quarterly' ? 3 : form.recurring === 'Yearly' ? 12 : 1))
        await saveItem('items', { ...row, id: undefined, date: nextDate.toISOString().slice(0, 10), status: 'pending', title: `${row.title} (Scheduled)` })
      }
      setLastSaved(saved)
      alert('Expense saved successfully!')
      setForm(current => ({ ...current, title: '', description: '', amount: '', transactionId: '', paidTo: '', vendorPhone: '', invoiceNo: '' }))
      setPhoto(null)
    } catch (error) {
      console.error('Expense save error:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }
  return <div className="expense-page"><section className="panel expense-form-panel"><div className="panel-header"><div><h3>Add Expense</h3><p>Record school payments with bill photo and approval details.</p></div></div><form onSubmit={submit}><div className="form-grid">
    <label>Expense Date*<DatePicker value={form.date} onChange={value => setForm({ ...form, date: value })} /></label>
    <label>Expense Category*<select required value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}>{cats.map(item => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}</select></label>
    <label>Expense Title*<input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="June Electricity Bill" /></label>
    <label>Amount*<input required type="number" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="12500" /></label>
    <label>Payment Mode*<select value={form.paymentMode} onChange={e => setForm({ ...form, paymentMode: e.target.value })}>{['Cash', 'UPI', 'NEFT', 'Cheque', 'Bank Transfer'].map(item => <option key={item}>{item}</option>)}</select></label>
    <label>Transaction / Reference<input value={form.transactionId} onChange={e => setForm({ ...form, transactionId: e.target.value })} /></label>
    <label>Paid To*<input required value={form.paidTo} onChange={e => setForm({ ...form, paidTo: e.target.value })} placeholder="MP Electricity Board" /></label>
    <label>Vendor Phone<input value={form.vendorPhone} onChange={e => setForm({ ...form, vendorPhone: e.target.value })} /></label>
    <label>Invoice/Bill Number<input value={form.invoiceNo} onChange={e => setForm({ ...form, invoiceNo: e.target.value })} /></label>
    <label>Recurring Expense<select value={form.recurring} onChange={e => setForm({ ...form, recurring: e.target.value })}>{['No', 'Monthly', 'Quarterly', 'Yearly'].map(item => <option key={item}>{item}</option>)}</select></label>
    <label>Approved By<select value={form.approvedBy} onChange={e => setForm({ ...form, approvedBy: e.target.value })}><option>Admin</option><option>Principal</option></select></label>
    <label>Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="approved">Approved</option><option value="pending">Pending</option><option value="rejected">Rejected</option></select></label>
    <label className="full">Description<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional note" /></label>
    <label className="expense-upload">Upload Bill Photo<input type="file" accept="image/*,.pdf" onChange={e => onFile(e.target.files?.[0])} /><span>{photo ? `${photo.name} - ${Math.round(photo.size / 1024)} KB` : <><Upload size={16} /> Camera / Gallery</>}</span></label>
  </div><div className="modal-actions"><button className="primary-button" disabled={saving}><Plus size={15} /> {saving ? 'Saving...' : 'Submit Expense'}</button>{lastSaved && <button type="button" className="secondary-button" onClick={() => printExpenseVoucher(lastSaved)}><Printer size={14} /> Print Voucher</button>}</div></form></section></div>
}

function printExpenseVoucher(expense) {
  const win = window.open('', '_blank', 'width=800,height=900')
  if (!win) return alert('Please allow popups to print voucher.')
  win.document.write(`<html><head><title>Expense Voucher</title><style>body{font-family:Arial;margin:24px;color:#021024}.voucher{border:2px solid #052659;padding:24px;max-width:720px;margin:auto}.head{text-align:center;border-bottom:2px solid #052659;padding-bottom:12px}table{width:100%;border-collapse:collapse;margin-top:18px}td,th{border:1px solid #9db5d1;padding:9px;text-align:left}.sign{display:flex;justify-content:space-between;margin-top:48px}.line{border-top:1px solid #111;width:170px;text-align:center;padding-top:6px}</style></head><body><div class="voucher"><div class="head"><h2>EXPENSE VOUCHER</h2><p>${dateLabel(expense.date)}</p></div><table><tbody><tr><th>Title</th><td>${expense.title}</td><th>Category</th><td>${expense.category}</td></tr><tr><th>Amount</th><td>${money(expense.amount)}</td><th>Mode</th><td>${expense.paymentMode}</td></tr><tr><th>Paid To</th><td>${expense.paidTo}</td><th>Invoice</th><td>${expense.invoiceNo || '-'}</td></tr><tr><th>Reference</th><td>${expense.transactionId || '-'}</td><th>Status</th><td>${expense.status}</td></tr></tbody></table><div class="sign"><div class="line">Prepared By</div><div class="line">Approved By</div></div></div><script>window.onload=()=>window.print()</script></body></html>`)
  win.document.close()
}

function ExpenseListPage({ expenses, saveItem, deleteItem }) {
  const [filters, setFilters] = useState({ from: '', to: '', categoryId: '', mode: '', status: 'All', query: '' })
  const [selected, setSelected] = useState({})
  const cats = getCategories(expenses)
  const rows = values(expenses.items).filter(item => (!filters.from || item.date >= filters.from) && (!filters.to || item.date <= filters.to) && (!filters.categoryId || item.categoryId === filters.categoryId) && (!filters.mode || item.paymentMode === filters.mode) && (filters.status === 'All' || item.status === filters.status.toLowerCase()) && (!filters.query || `${item.title} ${item.paidTo} ${item.amount}`.toLowerCase().includes(filters.query.toLowerCase())))
  const monthTotal = values(expenses.items).filter(item => String(item.date || '').startsWith(currentMonth())).reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const total = rows.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const pending = rows.filter(item => item.status === 'pending').reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const bulkApprove = () => Promise.all(rows.filter(row => selected[row.id]).map(row => saveItem('items', { ...row, status: 'approved' }))).then(() => setSelected({}))
  const bulkDelete = () => Promise.all(rows.filter(row => selected[row.id]).map(row => deleteItem('items', row.id))).then(() => setSelected({}))
  return <div className="expense-page"><section className="panel expense-filters"><DatePicker value={filters.from} onChange={value => setFilters({ ...filters, from: value })} placeholder="From Date" /><DatePicker value={filters.to} onChange={value => setFilters({ ...filters, to: value })} placeholder="To Date" /><select value={filters.categoryId} onChange={e => setFilters({ ...filters, categoryId: e.target.value })}><option value="">All Categories</option>{cats.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={filters.mode} onChange={e => setFilters({ ...filters, mode: e.target.value })}><option value="">All Modes</option>{['Cash', 'UPI', 'NEFT', 'Cheque', 'Bank Transfer'].map(item => <option key={item}>{item}</option>)}</select><select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}><option>All</option><option>Approved</option><option>Pending</option><option>Rejected</option></select><div className="table-search"><Search size={15} /><input value={filters.query} onChange={e => setFilters({ ...filters, query: e.target.value })} placeholder="Search title/vendor/amount" /></div></section><section className="expense-summary-bar"><span>Total Expenses <strong>{money(total)}</strong></span><span>This Month <strong>{money(monthTotal)}</strong></span><span>Pending Approval <strong>{money(pending)}</strong></span><span>Records <strong>{rows.length}</strong></span></section><section className="panel table-panel"><div className="panel-header"><div><h3>Expense List</h3><p>Approve, edit, delete and export expense entries.</p></div><div className="modal-actions"><button className="secondary-button" onClick={bulkApprove}>Bulk Approve</button><button className="secondary-button danger" onClick={bulkDelete}>Bulk Delete</button><button className="secondary-button" onClick={() => exportCsv(rows, 'expenses')}>Export Selected</button></div></div><div className="table-scroll"><table><thead><tr><th><input type="checkbox" checked={rows.length > 0 && rows.every(row => selected[row.id])} onChange={e => setSelected(Object.fromEntries(rows.map(row => [row.id, e.target.checked])))} /></th><th>#</th><th>Date</th><th>Title</th><th>Category</th><th>Amount</th><th>Mode</th><th>Paid To</th><th>Bill</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((row, index) => { const cat = categoryById(expenses, row.categoryId); return <tr key={row.id}><td><input type="checkbox" checked={Boolean(selected[row.id])} onChange={e => setSelected({ ...selected, [row.id]: e.target.checked })} /></td><td>{index + 1}</td><td>{dateLabel(row.date)}</td><td><strong>{row.title}</strong><small>{row.invoiceNo || ''}</small></td><td><CategoryBadge category={cat} /></td><td>{money(row.amount)}</td><td>{row.paymentMode}</td><td>{row.vendorPhone ? <a href={`https://wa.me/91${row.vendorPhone}`} target="_blank" rel="noreferrer">{row.paidTo}</a> : row.paidTo}</td><td>{row.billPhotoURL ? <button className="icon-button" onClick={() => window.open(row.billPhotoURL, '_blank')}><EyeIcon /></button> : '-'}</td><td><span className={`expense-status ${row.status}`}>{row.status}</span></td><td><button className="icon-button" onClick={() => saveItem('items', { ...row, status: 'approved' })}><Check size={14} /></button><button className="icon-button danger" onClick={() => deleteItem('items', row.id)}><Trash2 size={14} /></button></td></tr> })}{!rows.length && <tr><td colSpan="11"><div className="empty-state">No expenses found.</div></td></tr>}</tbody></table></div></section></div>
}

function EyeIcon() { return <FileText size={14} /> }

function CategoriesPage({ expenses, saveItem, deleteItem }) {
  const [form, setForm] = useState({ name: '', color: '#5483B3', icon: '📦', monthlyBudget: 5000, description: '', status: 'Active' })
  const [query, setQuery] = useState('')
  const rows = getCategories(expenses).filter(item => item.name.toLowerCase().includes(query.toLowerCase()))
  const spentFor = cat => values(expenses.items).filter(item => item.categoryId === cat.id && String(item.date || '').startsWith(currentMonth())).reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const submit = async event => {
    event.preventDefault()
    await saveItem('categories', form)
    setForm({ name: '', color: '#5483B3', icon: '📦', monthlyBudget: 5000, description: '', status: 'Active' })
  }
  return <div className="expense-page"><section className="panel expense-form-panel"><div className="panel-header"><div><h3>Add / Edit Category</h3><p>Set category colors, icon and monthly budget.</p></div></div><form onSubmit={submit}><div className="form-grid"><label>Category Name*<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label>Color<input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} /></label><label>Icon<input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} /></label><label>Monthly Budget<input type="number" value={form.monthlyBudget} onChange={e => setForm({ ...form, monthlyBudget: Number(e.target.value) })} /></label><label>Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>Active</option><option>Inactive</option></select></label><label className="full">Description<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label></div><button className="primary-button"><Plus size={15} /> Save Category</button></form></section><section className="panel table-panel"><div className="panel-header"><div><h3>Expense Categories</h3><p>Default and custom categories.</p></div><div className="table-search"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search category" /></div></div><div className="table-scroll"><table><thead><tr><th>#</th><th>Category</th><th>Color</th><th>Icon</th><th>Budget</th><th>This Month</th><th>Remaining</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((row, index) => { const spent = spentFor(row); return <tr key={row.id}><td>{index + 1}</td><td>{row.name}</td><td><span className="expense-color-dot" style={{ background: row.color }} /></td><td>{row.icon}</td><td>{money(row.monthlyBudget)}</td><td>{money(spent)}</td><td>{money(Number(row.monthlyBudget || 0) - spent)}</td><td>{row.status}</td><td><button className="icon-button" onClick={() => setForm(row)}><Edit3 size={14} /></button>{!defaultCategories.some(cat => cat.id === row.id) && <button className="icon-button danger" onClick={() => deleteItem('categories', row.id)}><Trash2 size={14} /></button>}</td></tr> })}</tbody></table></div></section></div>
}

function SalaryPage({ expenses, staff, saveItem }) {
  const [tab, setTab] = useState('structure')
  const employees = values(staff)
  const [empId, setEmpId] = useState(employees[0]?.id || '')
  const [structure, setStructure] = useState({ basicSalary: 25000, da: 10, hra: 8, ta: 1000, medical: 500, pf: 12, esi: 0, tds: 0, professionalTax: 200, otherDeductions: [] })
  const [salaryMonth, setSalaryMonth] = useState(currentMonth())
  const selected = employees.find(item => item.id === empId) || {}
  const computed = calcSalary(structure)
  const saveStructure = async () => {
    await saveItem('salary/structures', { ...structure, id: empId, empId, empName: employeeName(selected), ...computed })
    alert('Salary structure saved.')
  }
  const structures = expenses.salary?.structures || {}
  const payments = values(expenses.salary?.payments)
  const salaryRows = employees.map(emp => {
    const st = structures[emp.id] || { basicSalary: 0, netSalary: 0, totalEarnings: 0, totalDeductions: 0 }
    const paid = payments.find(item => item.empId === emp.id && item.monthKey === salaryMonth)
    return { emp, structure: st, paid }
  })
  const paySalary = async row => {
    const payment = { empId: row.emp.id, empName: employeeName(row.emp), employeeCode: row.emp.employeeCode, month: monthLabel(salaryMonth), monthKey: salaryMonth, year: Number(salaryMonth.slice(0, 4)), paymentMode: 'Bank Transfer', paidDate: Date.now(), status: 'paid', ...row.structure }
    await saveItem('salary/payments', payment)
    await saveItem('items', { date: today(), categoryId: 'cat_salary', category: 'Salary & Wages', title: `Salary - ${employeeName(row.emp)} - ${monthLabel(salaryMonth)}`, amount: Number(row.structure.netSalary || 0), paymentMode: payment.paymentMode, paidTo: employeeName(row.emp), status: 'approved', approvedBy: 'Admin' })
  }
  const totalSalary = salaryRows.reduce((sum, row) => sum + Number(row.structure.netSalary || 0), 0)
  const paidAmount = salaryRows.filter(row => row.paid).reduce((sum, row) => sum + Number(row.structure.netSalary || 0), 0)
  return <div className="expense-page"><div className="expense-subtabs">{[['structure','Salary Structure'],['pay','Pay Salary'],['report','Salary Report']].map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</div>{tab === 'structure' && <section className="panel expense-form-panel"><div className="panel-header"><div><h3>Salary Structure</h3><p>Set earnings, deductions and net salary.</p></div></div><div className="form-grid"><label>Select Employee<select value={empId} onChange={e => { setEmpId(e.target.value); setStructure(structures[e.target.value] || structure) }}>{employees.map(emp => <option key={emp.id} value={emp.id}>{employeeName(emp)} - {emp.employeeCode}</option>)}</select></label>{[['basicSalary','Basic Salary'],['da','DA %'],['hra','HRA %'],['ta','TA'],['medical','Medical'],['pf','PF %'],['esi','ESI %'],['tds','TDS'],['professionalTax','Professional Tax']].map(([key, label]) => <label key={key}>{label}<input type="number" value={structure[key] || ''} onChange={e => setStructure({ ...structure, [key]: Number(e.target.value) })} /></label>)}<label>Net Salary<input readOnly value={money(computed.netSalary)} /></label></div><button className="primary-button" onClick={saveStructure}><Check size={15} /> Save Structure</button></section>}{tab === 'pay' && <section className="panel table-panel"><div className="panel-header"><div><h3>Pay Salary</h3><p>{monthLabel(salaryMonth)}</p></div><input type="month" value={salaryMonth} onChange={e => setSalaryMonth(e.target.value)} /></div><section className="expense-summary-bar"><span>Total Employees <strong>{salaryRows.length}</strong></span><span>Paid <strong>{salaryRows.filter(row => row.paid).length}</strong></span><span>Unpaid <strong>{salaryRows.filter(row => !row.paid).length}</strong></span><span>Total Salary <strong>{money(totalSalary)}</strong></span><span>Pending <strong>{money(totalSalary - paidAmount)}</strong></span></section><div className="table-scroll"><table><thead><tr><th>#</th><th>Name</th><th>Basic</th><th>Allow.</th><th>Deduct.</th><th>Net</th><th>Status</th><th>Action</th></tr></thead><tbody>{salaryRows.map((row, index) => <tr key={row.emp.id}><td>{index + 1}</td><td>{employeeName(row.emp)}<small>{row.emp.employeeCode}</small></td><td>{money(row.structure.basicSalary)}</td><td>{money((row.structure.totalEarnings || 0) - (row.structure.basicSalary || 0))}</td><td>{money(row.structure.totalDeductions)}</td><td>{money(row.structure.netSalary)}</td><td><span className={`expense-status ${row.paid ? 'approved' : 'pending'}`}>{row.paid ? 'Paid' : 'Due'}</span></td><td>{row.paid ? <button className="secondary-button" onClick={() => printSalarySlip(row, monthLabel(salaryMonth))}>Slip</button> : <button className="primary-button" onClick={() => paySalary(row)}>Pay</button>}</td></tr>)}</tbody></table></div></section>}{tab === 'report' && <ReportsPage expenses={expenses} staff={staff} initial="salary" />}</div>
}

function printSalarySlip(row, month) {
  const name = employeeName(row.emp)
  const s = row.structure
  const win = window.open('', '_blank', 'width=800,height=900')
  if (!win) return alert('Please allow popups to print salary slip.')
  win.document.write(`<html><head><title>Salary Slip</title><style>body{font-family:Arial;margin:24px}.slip{border:2px solid #052659;padding:24px;max-width:720px;margin:auto}.head{text-align:center;border-bottom:2px solid #052659}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border:1px solid #9db5d1;padding:8px}.net{font-size:22px;font-weight:800;color:#052659;text-align:center;margin:18px}</style></head><body><div class="slip"><div class="head"><h2>SALARY SLIP</h2><p>${month}</p></div><p><strong>Employee:</strong> ${name} &nbsp; <strong>Employee ID:</strong> ${row.emp.employeeCode || '-'}</p><div class="grid"><table><thead><tr><th>Earnings</th><th>Amount</th></tr></thead><tbody><tr><td>Basic</td><td>${money(s.basicSalary)}</td></tr><tr><td>DA</td><td>${money(s.daAmount)}</td></tr><tr><td>HRA</td><td>${money(s.hraAmount)}</td></tr><tr><td>TA</td><td>${money(s.ta)}</td></tr><tr><td>Medical</td><td>${money(s.medical)}</td></tr><tr><th>Total</th><th>${money(s.totalEarnings)}</th></tr></tbody></table><table><thead><tr><th>Deductions</th><th>Amount</th></tr></thead><tbody><tr><td>PF</td><td>${money(Math.round(Number(s.basicSalary || 0) * Number(s.pf || 0) / 100))}</td></tr><tr><td>ESI</td><td>${money(Math.round(Number(s.basicSalary || 0) * Number(s.esi || 0) / 100))}</td></tr><tr><td>TDS</td><td>${money(s.tds)}</td></tr><tr><td>Prof Tax</td><td>${money(s.professionalTax)}</td></tr><tr><th>Total</th><th>${money(s.totalDeductions)}</th></tr></tbody></table></div><div class="net">NET PAY: ${money(s.netSalary)}</div><p>Payment Mode: Bank Transfer</p><p>Date: ${dateLabel(today())}</p></div><script>window.onload=()=>window.print()</script></body></html>`)
  win.document.close()
}

function BudgetPage({ expenses, saveItem }) {
  const [year, setYear] = useState('2026-27')
  const [totalBudget, setTotalBudget] = useState(expenses.budget?.[year]?.totalBudget || 1500000)
  const cats = getCategories(expenses)
  const spentAnnual = cat => values(expenses.items).filter(item => item.categoryId === cat.id).reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const saveBudget = async () => saveItem('budget', { id: year, academicYear: year, totalBudget, categories: Object.fromEntries(cats.map(cat => [cat.id, { budget: Number(cat.monthlyBudget || 0) * 12, spent: spentAnnual(cat) }])) })
  return <div className="expense-page"><section className="panel expense-form-panel"><div className="panel-header"><div><h3>Academic Year Budget</h3><p>Track category-wise budget usage.</p></div></div><div className="form-grid"><label>Academic Year<input value={year} onChange={e => setYear(e.target.value)} /></label><label>Total Annual Budget<input type="number" value={totalBudget} onChange={e => setTotalBudget(Number(e.target.value))} /></label></div><button className="primary-button" onClick={saveBudget}>Save Budget</button></section><section className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>Category</th><th>Budget</th><th>Spent</th><th>Remaining</th><th>% Used</th></tr></thead><tbody>{cats.map(cat => { const budget = Number(cat.monthlyBudget || 0) * 12; const spent = spentAnnual(cat); const rate = budget ? Math.round(spent / budget * 100) : 0; return <tr key={cat.id}><td><CategoryBadge category={cat} /></td><td>{money(budget)}</td><td>{money(spent)}</td><td>{money(budget - spent)}</td><td><div className={`expense-progress ${rate > 100 ? 'over' : rate >= 80 ? 'danger' : rate >= 50 ? 'warn' : 'ok'}`}><i style={{ width: `${Math.min(rate, 100)}%` }} /><span>{rate}%</span></div></td></tr> })}</tbody></table></div></section></div>
}

function ReportsPage({ expenses, staff, initial = 'monthly' }) {
  const [type, setType] = useState(initial)
  const items = values(expenses.items)
  const salaryPayments = values(expenses.salary?.payments)
  const reports = {
    monthly: { title: 'Monthly Expense Summary', headers: ['Category', 'Amount'], rows: getCategories(expenses).map(cat => [cat.name, money(items.filter(item => item.categoryId === cat.id && String(item.date || '').startsWith(currentMonth())).reduce((sum, item) => sum + Number(item.amount || 0), 0))]) },
    income: { title: 'Income vs Expense', headers: ['Metric', 'Amount'], rows: [['Total Expense', money(items.reduce((sum, item) => sum + Number(item.amount || 0), 0))], ['Income Source', 'Fees module'], ['Surplus/Deficit', 'See Command Center']] },
    category: { title: 'Category-wise Report', headers: ['Date', 'Title', 'Category', 'Amount'], rows: items.map(item => [dateLabel(item.date), item.title, item.category, money(item.amount)]) },
    salary: { title: 'Salary Expense Report', headers: ['Employee', 'Month', 'Net Salary', 'Status'], rows: salaryPayments.map(item => [item.empName, item.month, money(item.netSalary), item.status]) },
    vendor: { title: 'Vendor/Payee Report', headers: ['Vendor', 'Total Paid', 'Last Payment'], rows: Object.entries(items.reduce((all, item) => ({ ...all, [item.paidTo || 'Unknown']: [...(all[item.paidTo || 'Unknown'] || []), item] }), {})).map(([vendor, rows]) => [vendor, money(rows.reduce((sum, item) => sum + Number(item.amount || 0), 0)), dateLabel(rows[0]?.date)]) },
    daily: { title: 'Daily Expense Report', headers: ['Date', 'Title', 'Amount', 'Mode'], rows: items.filter(item => item.date === today()).map(item => [dateLabel(item.date), item.title, money(item.amount), item.paymentMode]) },
    annual: { title: 'Annual Report', headers: ['Month', 'Expense'], rows: Array.from({ length: 12 }, (_, index) => { const key = `${currentYear()}-${String(index + 1).padStart(2, '0')}`; return [monthLabel(key), money(items.filter(item => String(item.date || '').startsWith(key)).reduce((sum, item) => sum + Number(item.amount || 0), 0))] }) },
  }
  const report = reports[type]
  const print = () => printReport(report)
  return <div className="expense-page"><section className="panel"><div className="panel-header"><div><h3>Expense Reports</h3><p>Print, PDF and Excel exports.</p></div><select value={type} onChange={e => setType(e.target.value)}>{Object.entries(reports).map(([id, row]) => <option key={id} value={id}>{row.title}</option>)}</select></div><div className="expense-report-actions"><button className="secondary-button" onClick={print}><Printer size={14} /> Print</button><button className="secondary-button" onClick={() => exportCsvRows(report)}><Download size={14} /> Excel</button><button className="secondary-button" onClick={print}><FileText size={14} /> PDF</button></div><div className="table-scroll expense-report-table"><table><thead><tr>{report.headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{report.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}{!report.rows.length && <tr><td colSpan={report.headers.length}><div className="empty-state">No records found.</div></td></tr>}</tbody></table></div></section></div>
}

function printReport(report) {
  const win = window.open('', '_blank', 'width=1000,height=800')
  if (!win) return alert('Please allow popups to print reports.')
  win.document.write(`<html><head><title>${report.title}</title><style>body{font-family:Arial;margin:24px}.header{text-align:center;margin-bottom:18px}.school{font-size:20px;font-weight:800;color:#052659}table{width:100%;border-collapse:collapse}th,td{border:1px solid #000;padding:8px;font-size:12px}th{background:#052659;color:white}.sign{display:flex;justify-content:space-between;margin-top:48px}.sign span{border-top:1px solid #111;width:170px;text-align:center;padding-top:8px}@media print{th{background:#052659!important;color:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="header"><div class="school">School Expense Management</div><h3>${report.title}</h3><p>Generated: ${new Date().toLocaleDateString('en-IN')}</p></div><table><thead><tr>${report.headers.map(header => `<th>${header}</th>`).join('')}</tr></thead><tbody>${report.rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table><p>Total Records: ${report.rows.length}</p><div class="sign"><span>Prepared By</span><span>Principal</span></div><script>window.onload=()=>window.print()</script></body></html>`)
  win.document.close()
}

function exportCsv(rows, filename) {
  const data = rows.map(row => Object.values(row).map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([data], { type: 'text/csv' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
function exportCsvRows(report) {
  const csv = [report.headers.join(','), ...report.rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${report.title.toLowerCase().replace(/\s+/g, '-')}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function ExpenseManager({ expenses = {}, staff = {}, fees = {}, saveExpenseItem, deleteExpenseItem }) {
  const [tab, setTab] = useState('add')
  const data = normalizeExpenses(expenses)
  const items = values(data.items)
  const todayItems = items.filter(item => item.date === today())
  const monthItems = items.filter(item => String(item.date || '').startsWith(currentMonth()))
  const monthExpense = monthItems.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const income = values(fees).reduce((sum, item) => sum + Number(item.amount || item.paidAmount || 0), 0)
  const topCategories = getCategories(data).map(cat => ({ ...cat, spent: monthItems.filter(item => item.categoryId === cat.id).reduce((sum, item) => sum + Number(item.amount || 0), 0) })).filter(item => item.spent > 0).sort((a, b) => b.spent - a.spent).slice(0, 5)
  return <div className="expense-module"><div className="section-actions"><div><h2>Expense Management</h2><p>Track expenses, salaries, budgets, vouchers and reports.</p></div></div><section className="expense-dashboard"><div><IndianRupee size={20} /><span>Today</span><strong>{money(todayItems.reduce((sum, item) => sum + Number(item.amount || 0), 0))}</strong><small>{todayItems.length} expenses</small></div><div><WalletCards size={20} /><span>This Month</span><strong>{money(monthExpense)}</strong><small>{income - monthExpense >= 0 ? 'Surplus' : 'Deficit'} {money(Math.abs(income - monthExpense))}</small></div><div><BarChart3 size={20} /><span>Top Categories</span><strong>{topCategories.length}</strong><small>{topCategories.map(item => item.name.split(' ')[0]).join(', ') || 'No spending'}</small></div><div><FileText size={20} /><span>Pending Salary</span><strong>{values(data.salary?.structures).length - values(data.salary?.payments).filter(item => item.monthKey === currentMonth()).length}</strong><small>Review payroll</small></div></section><ExpenseTabs tab={tab} setTab={setTab} />{tab === 'add' && <AddExpensePage expenses={data} saveItem={saveExpenseItem} />}{tab === 'list' && <ExpenseListPage expenses={data} saveItem={saveExpenseItem} deleteItem={deleteExpenseItem} />}{tab === 'categories' && <CategoriesPage expenses={data} saveItem={saveExpenseItem} deleteItem={deleteExpenseItem} />}{tab === 'salary' && <SalaryPage expenses={data} staff={staff} saveItem={saveExpenseItem} />}{tab === 'budget' && <BudgetPage expenses={data} saveItem={saveExpenseItem} />}{tab === 'reports' && <ReportsPage expenses={data} staff={staff} />}</div>
}
