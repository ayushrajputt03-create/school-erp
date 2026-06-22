import React, { useMemo, useState } from 'react'
import {
  BarChart3, Check, CreditCard, Download, FileText, Plus, Printer,
  Search, Trash2, WalletCards,
} from 'lucide-react'
import DatePicker from './DatePicker'

const today = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}
const monthKey = () => today().slice(0, 7)
const money = value => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`
const values = object => Object.values(object || {}).filter(Boolean).sort((a, b) => (b.createdAt || b.date || 0) - (a.createdAt || a.date || 0))
const dateLabel = value => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
const studentName = student => student?.name || student?.full_name || student?.fullName || 'Student'
const studentAdmission = student => student?.roll || student?.admissionNo || student?.admission_number || ''
const studentClass = student => student?.className || `${student?.class_name || ''}-${student?.section || ''}`.replace(/^-|-$/g, '') || '-'
const employeeName = employee => `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() || employee?.name || employee?.employeeCode || 'Employee'
const daysSince = value => value ? Math.max(0, Math.floor((new Date(`${today()}T00:00:00`) - new Date(`${String(value).slice(0, 10)}T00:00:00`)) / 86400000)) : 0

const normalizeAccounts = accounts => ({
  transactions: {},
  cashBook: {},
  bankBook: {},
  pendingPayments: {},
  donations: {},
  concessions: {},
  fines: {},
  otherIncome: {},
  vouchers: {},
  bankAccounts: {},
  fixedAssets: {},
  auditLog: {},
  budget: {},
  tax: { settings: {} },
  yearClosing: {},
  settings: { financialYear: '2026-27', openingCashBalance: 0, openingBankBalance: 0 },
  ...accounts,
})

const printTable = (title, headers, rows) => {
  const win = window.open('', '_blank', 'width=900,height=900')
  if (!win) return alert('Please allow popups to print.')
  win.document.write(`<html><head><title>${title}</title><style>body{font-family:Arial;margin:24px;color:#021024}.header{text-align:center;margin-bottom:18px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #111;padding:7px;font-size:12px;text-align:left}th{background:#052659;color:white}.sign{display:flex;justify-content:space-between;margin-top:42px}.line{border-top:1px solid #111;width:180px;text-align:center;padding-top:6px}@media print{@page{size:A4;margin:12mm}}</style></head><body><div class="header"><h2>Accounts Report</h2><p>${title} - Generated ${dateLabel(today())}</p></div><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table><div class="sign"><div class="line">Accountant</div><div class="line">Principal</div></div><script>window.onload=()=>window.print()</script></body></html>`)
  win.document.close()
}
const exportCsv = (headers, rows, filename) => {
  const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`
  const csv = [headers.map(escape).join(','), ...rows.map(row => row.map(escape).join(','))].join('\n')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  link.download = `${filename}.csv`
  link.click()
}
const printDonationReceipt = (school, donation) => {
  const win = window.open('', '_blank', 'width=760,height=900')
  if (!win) return alert('Please allow popups to print receipt.')
  win.document.write(`<html><head><title>${donation.receiptNo}</title><style>body{font-family:Arial;margin:20px;color:#021024}.receipt{border:2px solid #052659;padding:24px;max-width:680px;margin:auto}.school{text-align:center;border-bottom:3px double #052659;padding-bottom:12px}.title{text-align:center;font-size:22px;font-weight:bold;margin:18px 0;border:1px solid #052659;padding:10px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 18px}.box{border:1px solid #9db5d1;padding:12px;margin:12px 0}.sign{display:flex;justify-content:space-between;margin-top:44px}.line{border-top:1px solid #111;width:180px;text-align:center;padding-top:6px}</style></head><body><div class="receipt"><div class="school"><h2>${school?.schoolName || 'School Name'}</h2><p>${school?.address || ''} | ${school?.phone || ''} | ${school?.email || ''}</p><p>Reg. No: ${school?.registrationNo || '-'} | 80G Reg. No: ${school?.eightyGNo || '-'}</p></div><div class="title">DONATION RECEIPT</div><div class="grid"><b>Receipt No:</b><span>${donation.receiptNo}</span><b>Date:</b><span>${dateLabel(donation.date)}</span></div><div class="box"><h3>Donor Details</h3><p><b>Name:</b> ${donation.donorName}</p><p><b>Address:</b> ${donation.donorAddress || '-'}</p><p><b>PAN:</b> ${donation.panNumber || '-'}</p></div><div class="box"><p><b>Donation For:</b> ${donation.purpose}</p><p><b>Amount:</b> ${money(donation.amount)}</p><p><b>Payment Mode:</b> ${donation.paymentMode}</p><p><b>Reference:</b> ${donation.transactionId || '-'}</p></div>${donation.is80G === 'Yes' ? '<p>This donation is eligible for deduction under Section 80G of the Income Tax Act, 1961.</p>' : ''}<p><b>Thank you for your generous contribution.</b></p><div class="sign"><div class="line">Authorized By</div><div class="line">Principal</div></div></div><script>window.onload=()=>window.print()</script></body></html>`)
  win.document.close()
}

function buildAccounting({ students, fees, expenses, transport, library, staff, employeeConfig, accounts }) {
  const feeRows = values(fees)
  const expenseRows = values(expenses?.items || {})
  const salaryStructures = values(expenses?.salary?.structures || {})
  const salaryPayments = values(expenses?.salary?.payments || {})
  const transportFees = values(transport?.fees || {})
  const libraryFines = values(library?.fines || {})
  const donations = values(accounts.donations)
  const otherIncome = values(accounts.otherIncome)
  const accountFines = values(accounts.fines)
  const month = monthKey()
  const inMonth = row => String(row.date || row.paidDate || row.paidAt || row.createdAt || '').startsWith(month) || (Number(row.paidAt || row.createdAt || 0) && new Date(row.paidAt || row.createdAt).toISOString().startsWith(month))
  const feeIncome = feeRows.filter(row => row.status === 'paid' || Number(row.amount || row.paidAmount || 0) > 0).reduce((sum, row) => sum + Number(row.amount || row.paidAmount || 0), 0)
  const transportIncome = transportFees.filter(row => row.status === 'paid').reduce((sum, row) => sum + Number(row.paidAmount || row.amount || 0), 0)
  const donationIncome = donations.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const otherIncomeTotal = otherIncome.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const fineIncome = [...libraryFines.filter(row => row.paid), ...accountFines.filter(row => row.status === 'paid')].reduce((sum, row) => sum + Number(row.fineAmount || row.amount || 0), 0)
  const expenseTotal = expenseRows.filter(row => row.status !== 'rejected').reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const salaryPaid = salaryPayments.reduce((sum, row) => sum + Number(row.netSalary || 0), 0)
  const totalIncome = feeIncome + transportIncome + donationIncome + otherIncomeTotal + fineIncome
  const totalExpense = expenseTotal + salaryPaid
  const feePendingRows = feeRows.filter(row => Number(row.balance || row.pendingAmount || 0) > 0)
  const feePending = feePendingRows.reduce((sum, row) => sum + Number(row.balance || row.pendingAmount || 0), 0)
  const transportPendingRows = values(transport?.allocations || {}).filter(allocation => !transportFees.some(fee => fee.studentId === allocation.studentId && String(fee.month || '').includes(new Date().toLocaleDateString('en-IN', { month: 'long' }))))
  const transportPending = transportPendingRows.length * 700
  const salaryPending = Math.max(0, salaryStructures.reduce((sum, row) => sum + Number(row.netSalary || 0), 0) - salaryPayments.filter(row => row.monthKey === month).reduce((sum, row) => sum + Number(row.netSalary || 0), 0))
  const salaryPendingCount = Math.max(0, salaryStructures.length - salaryPayments.filter(row => row.monthKey === month).length)
  const expensePendingRows = expenseRows.filter(row => row.status === 'pending')
  const expensePending = expensePendingRows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const libraryPendingRows = libraryFines.filter(row => !row.paid && !row.waived)
  const libraryPending = libraryPendingRows.reduce((sum, row) => sum + Number(row.fineAmount || 0), 0)
  const pendingRows = [
    ...feePendingRows.map(row => ({ type: 'Fee', name: row.studentName || students.find(s => s.id === row.studentId)?.name || 'Student', category: row.feeType || 'Fee', amount: Number(row.balance || row.pendingAmount || 0), since: row.date || row.createdAt || today() })),
    ...expensePendingRows.map(row => ({ type: 'Expense', name: row.title, category: row.category, amount: Number(row.amount || 0), since: row.date || row.createdAt || today() })),
    ...transportPendingRows.map(row => ({ type: 'Transport', name: row.studentName || students.find(s => s.id === row.studentId)?.name || 'Student', category: 'Bus Fee', amount: 700, since: row.allocatedAt || today() })),
    ...libraryPendingRows.map(row => ({ type: 'Library', name: row.studentName, category: 'Fine', amount: Number(row.fineAmount || 0), since: row.createdAt || today() })),
    ...salaryStructures.filter(row => !salaryPayments.some(pay => pay.empId === row.empId && pay.monthKey === month)).map(row => ({ type: 'Salary', name: row.empName || row.employeeName || 'Employee', category: 'Salary', amount: Number(row.netSalary || 0), since: today() })),
  ]
  const cashIncome = [...feeRows, ...transportFees, ...donations, ...otherIncome].filter(row => /cash/i.test(row.method || row.paymentMode || '')).reduce((sum, row) => sum + Number(row.amount || row.paidAmount || 0), 0)
  const cashExpense = expenseRows.filter(row => /cash/i.test(row.paymentMode || '')).reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const bankIncome = totalIncome - cashIncome
  const bankExpense = totalExpense - cashExpense
  const recentTransactions = [
    ...feeRows.map(row => ({ type: 'Income', category: 'Fee', particular: `Fee received from ${row.studentName || 'student'}`, amount: Number(row.amount || row.paidAmount || 0), date: row.date || row.createdAt || row.paidAt })),
    ...expenseRows.map(row => ({ type: 'Expense', category: row.category || 'Expense', particular: row.title, amount: Number(row.amount || 0), date: row.date || row.createdAt })),
    ...salaryPayments.map(row => ({ type: 'Expense', category: 'Salary', particular: `Salary paid to ${row.empName}`, amount: Number(row.netSalary || 0), date: row.paidDate || row.createdAt })),
    ...donations.map(row => ({ type: 'Income', category: 'Donation', particular: `Donation from ${row.donorName}`, amount: Number(row.amount || 0), date: row.date || row.createdAt })),
    ...otherIncome.map(row => ({ type: 'Income', category: 'Other Income', particular: row.source, amount: Number(row.amount || 0), date: row.date || row.createdAt })),
  ].filter(row => row.amount).sort((a, b) => (b.date || 0) - (a.date || 0))
  return {
    feeRows, expenseRows, salaryStructures, salaryPayments, transportFees, libraryFines,
    totalIncome, totalExpense, netBalance: totalIncome - totalExpense,
    feeIncome, transportIncome, donationIncome, otherIncomeTotal, fineIncome,
    feePendingRows, feePending, transportPendingRows, transportPending, salaryPending, salaryPendingCount, expensePendingRows, expensePending, libraryPendingRows, libraryPending,
    totalPending: feePending + transportPending + salaryPending + expensePending + libraryPending,
    pendingRows, cashBalance: Number(accounts.settings?.openingCashBalance || 0) + cashIncome - cashExpense,
    bankBalance: Number(accounts.settings?.openingBankBalance || 0) + bankIncome - bankExpense,
    recentTransactions,
    inMonth,
    staffRows: values(staff),
    employeeConfig,
  }
}

function StatCard({ label, value, tone, note }) {
  return <div className={`accounts-stat ${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
}

function AccountsDashboard({ summary, setTab }) {
  const pendingSummary = [
    ['Fee Pending', summary.feePendingRows.length, summary.feePending, 'fee'],
    ['Transport Fee Pending', summary.transportPendingRows.length, summary.transportPending, 'pending'],
    ['Salary Unpaid', summary.salaryPendingCount, summary.salaryPending, 'salary'],
    ['Expense Pending Approve', summary.expensePendingRows.length, summary.expensePending, 'expense'],
    ['Library Fine Pending', summary.libraryPendingRows.length, summary.libraryPending, 'pending'],
  ]
  const max = Math.max(summary.totalIncome, summary.totalExpense, 1)
  return <div className="accounts-page">
    <section className="accounts-stat-grid">
      <StatCard label="Total Income" value={money(summary.totalIncome)} tone="income" note="Fees, transport, fines, donations and other income" />
      <StatCard label="Total Expense" value={money(summary.totalExpense)} tone="expense" note="Expenses and salaries paid" />
      <StatCard label="Net Balance" value={money(summary.netBalance)} tone={summary.netBalance >= 0 ? 'balance' : 'expense'} note={summary.netBalance >= 0 ? 'Surplus' : 'Deficit'} />
      <StatCard label="Total Pending" value={money(summary.totalPending)} tone="pending" note="Fees, salary, expense, transport and library" />
      <StatCard label="Total Donations" value={money(summary.donationIncome)} tone="donation" note="Donation receipts recorded" />
      <StatCard label="Cash + Bank" value={money(summary.cashBalance + summary.bankBalance)} tone="bank" note="Current account balance estimate" />
    </section>
    <section className="panel accounts-chart-panel"><div className="panel-header"><div><h3>Income vs Expense</h3><p>Current financial position</p></div></div><div className="accounts-bars"><div><span>Income</span><i className="income" style={{ width: `${summary.totalIncome / max * 100}%` }} /><strong>{money(summary.totalIncome)}</strong></div><div><span>Expense</span><i className="expense" style={{ width: `${summary.totalExpense / max * 100}%` }} /><strong>{money(summary.totalExpense)}</strong></div><div><span>Net</span><i className="balance" style={{ width: `${Math.abs(summary.netBalance) / max * 100}%` }} /><strong>{money(summary.netBalance)}</strong></div></div></section>
    <section className="accounts-grid-two">
      <section className="panel table-panel"><div className="panel-header"><div><h3>Pending Summary</h3><p>Click a row to open details.</p></div></div><div className="table-scroll"><table><thead><tr><th>Type</th><th>Count</th><th>Amount</th></tr></thead><tbody>{pendingSummary.map(row => <tr key={row[0]} onClick={() => setTab(row[3])}><td>{row[0]}</td><td>{row[1]}</td><td>{money(row[2])}</td></tr>)}<tr><th>Total Pending</th><th>{pendingSummary.reduce((s, r) => s + r[1], 0)}</th><th>{money(summary.totalPending)}</th></tr></tbody></table></div></section>
      <section className="panel"><div className="panel-header"><div><h3>Cash In Hand</h3><p>Cash and bank book estimate</p></div></div><div className="accounts-balance-box"><span>Cash Balance<strong>{money(summary.cashBalance)}</strong></span><span>Bank Balance<strong>{money(summary.bankBalance)}</strong></span><span>Total<strong>{money(summary.cashBalance + summary.bankBalance)}</strong></span></div></section>
    </section>
    <section className="panel table-panel"><div className="panel-header"><div><h3>Recent Transactions</h3><p>Last 10 financial actions</p></div></div><div className="table-scroll"><table><thead><tr><th>Date</th><th>Type</th><th>Particular</th><th>Category</th><th>Amount</th></tr></thead><tbody>{summary.recentTransactions.slice(0, 10).map((row, index) => <tr key={index}><td>{dateLabel(row.date)}</td><td><span className={`accounts-badge ${row.type.toLowerCase()}`}>{row.type}</span></td><td>{row.particular}</td><td>{row.category}</td><td>{money(row.amount)}</td></tr>)}{!summary.recentTransactions.length && <tr><td colSpan="5"><div className="empty-state">No transactions yet.</div></td></tr>}</tbody></table></div></section>
  </div>
}

function FeeAccounts({ summary, students, setPage }) {
  const [sub, setSub] = useState('collection')
  const [query, setQuery] = useState('')
  const rows = sub === 'collection' ? summary.feeRows.filter(row => Number(row.amount || row.paidAmount || 0) > 0) : summary.feePendingRows
  const filtered = rows.filter(row => `${row.studentName || ''} ${row.admissionNo || ''} ${row.className || ''}`.toLowerCase().includes(query.toLowerCase()))
  const headers = sub === 'collection' ? ['Receipt No','Student','Adm No','Class','Amount','Mode','Date','Status'] : ['Adm No','Student','Class','Father','Phone','Total','Paid','Pending','Actions']
  const exportRows = filtered.map(row => sub === 'collection' ? [row.receiptNo || row.id, row.studentName || students.find(s => s.id === row.studentId)?.name || '-', row.admissionNo || '-', row.className || '-', money(row.amount || row.paidAmount), row.method || row.paymentMode || '-', dateLabel(row.date || row.createdAt), 'Paid'] : [row.admissionNo || '-', row.studentName || '-', row.className || '-', row.fatherName || '-', row.phone || '-', money(row.total || 0), money(row.paidAmount || row.amount || 0), money(row.balance || row.pendingAmount || 0), 'Collect Fee'])
  return <TabbedPage title="Fee Accounts" tabs={[['collection','Collection'],['pending','Pending'],['defaulters','Defaulters'],['writeoff','Write Off']]} active={sub} setActive={setSub}>
    {sub === 'writeoff' ? <WriteOffForm /> : <><Toolbar query={query} setQuery={setQuery} onPrint={() => printTable(`Fee ${sub}`, headers, exportRows)} onExport={() => exportCsv(headers, exportRows, `fee-${sub}`)} /><SummaryStrip items={[['Total Records', filtered.length], ['Total Collected', money(filtered.reduce((s, r) => s + Number(r.amount || r.paidAmount || 0), 0))], ['Total Pending', money(filtered.reduce((s, r) => s + Number(r.balance || r.pendingAmount || 0), 0))]]} /><section className="panel table-panel"><div className="table-scroll"><table><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{exportRows.map((row, index) => <tr key={index}>{row.map((cell, i) => <td key={i}>{i === row.length - 1 && sub !== 'collection' ? <button className="secondary-button" onClick={() => setPage('fees')}>Collect Fee</button> : cell}</td>)}</tr>)}{!exportRows.length && <tr><td colSpan={headers.length}><div className="empty-state">No fee records found.</div></td></tr>}</tbody></table></div></section></>}
  </TabbedPage>
}

function WriteOffForm() {
  return <section className="panel accounts-form"><div className="panel-header"><div><h3>Fee Write Off</h3><p>Record non-collectable fees for audit trail.</p></div></div><div className="form-grid"><label>Select Student<input placeholder="Search student" /></label><label>Amount<input type="number" /></label><label>Reason<select><option>Student Left School</option><option>Scholarship Granted</option><option>Fee Waiver</option><option>RTE Student</option><option>Other</option></select></label><label>Approved By<input placeholder="Principal/Admin" /></label></div><button className="primary-button">Write Off</button></section>
}

function ExpenseAccounts({ summary, saveExpenseItem }) {
  const [sub, setSub] = useState('all')
  const rows = summary.expenseRows.filter(row => sub === 'all' || row.status === sub)
  const approve = row => saveExpenseItem('items', { ...row, status: 'approved' })
  const reject = row => {
    const reason = window.prompt('Reason for rejection:')
    if (reason) saveExpenseItem('items', { ...row, status: 'rejected', rejectionReason: reason })
  }
  return <TabbedPage title="Expense Accounts" tabs={[['all','All Expenses'],['pending','Pending Approval'],['approved','Approved'],['rejected','Rejected']]} active={sub} setActive={setSub}>
    <section className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>#</th><th>Date</th><th>Title</th><th>Category</th><th>Amount</th><th>Mode</th><th>Paid To</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td>{dateLabel(row.date)}</td><td>{row.title}</td><td>{row.category}</td><td>{money(row.amount)}</td><td>{row.paymentMode}</td><td>{row.paidTo}</td><td><span className={`accounts-badge ${row.status || 'pending'}`}>{row.status || 'pending'}</span></td><td><div className="transport-row-actions"><button className="secondary-button" onClick={() => approve(row)}>Approve</button><button className="secondary-button danger" onClick={() => reject(row)}>Reject</button></div></td></tr>)}{!rows.length && <tr><td colSpan="9"><div className="empty-state">No expenses found.</div></td></tr>}</tbody></table></div></section>
  </TabbedPage>
}

function SalaryAccounts({ summary, staff, employeeConfig, saveExpenseItem }) {
  const [sub, setSub] = useState('summary')
  const [month, setMonth] = useState(monthKey())
  const paid = summary.salaryPayments.filter(row => row.monthKey === month)
  const pending = summary.salaryStructures.filter(row => !paid.some(pay => pay.empId === row.empId))
  const payNow = async row => {
    const payment = { empId: row.empId, empName: row.empName, monthKey: month, month: month, paymentMode: 'Bank Transfer', paidDate: Date.now(), status: 'paid', ...row }
    await saveExpenseItem('salary/payments', payment)
    alert('Salary marked paid.')
  }
  const staffRows = values(staff)
  const deptRows = Object.values(employeeConfig?.departments || {}).map(dept => {
    const employees = staffRows.filter(emp => emp.departmentId === dept.id)
    const structures = summary.salaryStructures.filter(row => employees.some(emp => emp.id === row.empId))
    return [dept.name, employees.length, structures.length - structures.filter(row => pending.some(p => p.empId === row.empId)).length, structures.filter(row => pending.some(p => p.empId === row.empId)).length, money(structures.reduce((s, r) => s + Number(r.netSalary || 0), 0))]
  })
  return <TabbedPage title="Salary Accounts" tabs={[['summary','Salary Summary'],['pending','Pending Salary'],['paid','Paid Salary']]} active={sub} setActive={setSub}>
    <section className="panel accounts-filters"><label>Select Month<input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label></section>
    {sub === 'summary' && <><SummaryStrip items={[['Total Employees', summary.salaryStructures.length], ['Paid', paid.length], ['Unpaid', pending.length], ['Total Salary', money(summary.salaryStructures.reduce((s, r) => s + Number(r.netSalary || 0), 0))], ['Paid Amount', money(paid.reduce((s, r) => s + Number(r.netSalary || 0), 0))], ['Pending', money(pending.reduce((s, r) => s + Number(r.netSalary || 0), 0))]]} /><SimpleTable headers={['Department','Staff','Paid','Unpaid','Amount']} rows={deptRows} empty="No department salary data." /></>}
    {sub === 'pending' && <SimpleTable headers={['Employee','Employee ID','Department','Net Salary','Month','Action']} rows={pending.map(row => [row.empName, row.employeeCode || row.empId, '-', money(row.netSalary), month, <button className="primary-button" onClick={() => payNow(row)}>Pay Now</button>])} empty="No pending salary." />}
    {sub === 'paid' && <SimpleTable headers={['Employee','Net Salary','Payment Mode','Paid Date','Status']} rows={paid.map(row => [row.empName, money(row.netSalary), row.paymentMode, dateLabel(row.paidDate), 'Paid'])} empty="No salary paid for this month." />}
  </TabbedPage>
}

function PendingPayments({ summary }) {
  const [type, setType] = useState('All')
  const rows = summary.pendingRows.filter(row => type === 'All' || row.type === type)
  return <div className="accounts-page"><section className="accounts-stat-grid small"><StatCard label="Total Pending" value={money(summary.totalPending)} tone="pending" note={`${summary.pendingRows.length} records`} /><StatCard label="Fee Pending" value={money(summary.feePending)} tone="pending" note={`${summary.feePendingRows.length} students`} /><StatCard label="Salary Pending" value={money(summary.salaryPending)} tone="pending" note={`${summary.salaryPendingCount} staff`} /><StatCard label="Expense Pending" value={money(summary.expensePending)} tone="pending" note={`${summary.expensePendingRows.length} records`} /></section><section className="panel accounts-filters"><select value={type} onChange={e => setType(e.target.value)}>{['All','Fee','Salary','Expense','Transport','Library'].map(item => <option key={item}>{item}</option>)}</select><button className="secondary-button" onClick={() => printTable('All Pending Payments', ['Type','Name','Category','Amount','Since'], rows.map(row => [row.type, row.name, row.category, money(row.amount), `${daysSince(row.since)} days`]))}><Printer size={14} /> Print</button><button className="secondary-button" onClick={() => exportCsv(['Type','Name','Category','Amount','Since'], rows.map(row => [row.type, row.name, row.category, row.amount, `${daysSince(row.since)} days`]), 'pending-payments')}><Download size={14} /> Excel</button></section><SimpleTable headers={['#','Type','Name','Category','Amount','Since','Status']} rows={rows.map((row, index) => [index + 1, row.type, row.name, row.category, money(row.amount), `${daysSince(row.since)} days`, daysSince(row.since) > 30 ? 'Urgent' : daysSince(row.since) >= 15 ? 'Overdue' : 'Recent'])} empty="No pending payments." /></div>
}

function BankCash({ summary, accounts, saveAccountsItem }) {
  const [sub, setSub] = useState('cash')
  const [form, setForm] = useState({ date: today(), particular: '', amount: '', mode: 'Debit', referenceNo: '', bankName: '' })
  const saveEntry = async () => {
    const debit = form.mode === 'Debit' ? Number(form.amount || 0) : 0
    const credit = form.mode === 'Credit' ? Number(form.amount || 0) : 0
    await saveAccountsItem(sub === 'cash' ? 'cashBook' : 'bankBook', { ...form, debit, credit, balance: 0, type: form.mode.toLowerCase() })
    setForm({ date: today(), particular: '', amount: '', mode: 'Debit', referenceNo: '', bankName: '' })
  }
  const rows = values(accounts[sub === 'cash' ? 'cashBook' : 'bankBook'])
  return <TabbedPage title="Bank & Cash" tabs={[['cash','Cash Book'],['bank','Bank Book'],['transfer','Transfer']]} active={sub} setActive={setSub}>
    {sub === 'transfer' ? <VoucherForm type="contra" saveAccountsItem={saveAccountsItem} /> : <><section className="panel accounts-form"><div className="form-grid"><label>Date<DatePicker value={form.date} onChange={value => setForm({ ...form, date: value })} /></label><label>Particular<input value={form.particular} onChange={e => setForm({ ...form, particular: e.target.value })} /></label><label>Amount<input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label><label>Type<select value={form.mode} onChange={e => setForm({ ...form, mode: e.target.value })}><option>Debit</option><option>Credit</option></select></label><label>Reference No<input value={form.referenceNo} onChange={e => setForm({ ...form, referenceNo: e.target.value })} /></label></div><button className="primary-button" onClick={saveEntry}><Plus size={14} /> Add Entry</button></section><SimpleTable headers={['Date','Particular','Voucher/Ref','Debit','Credit','Balance']} rows={rows.map(row => [dateLabel(row.date), row.particular, row.voucherNo || row.referenceNo || '-', money(row.debit), money(row.credit), money(row.balance)])} empty="No entries found." /><SummaryStrip items={sub === 'cash' ? [['Cash Balance', money(summary.cashBalance)], ['Total Debit', money(rows.reduce((s, r) => s + Number(r.debit || 0), 0))], ['Total Credit', money(rows.reduce((s, r) => s + Number(r.credit || 0), 0))]] : [['Bank Balance', money(summary.bankBalance)], ['Total Debit', money(rows.reduce((s, r) => s + Number(r.debit || 0), 0))], ['Total Credit', money(rows.reduce((s, r) => s + Number(r.credit || 0), 0))]]} /></>}
  </TabbedPage>
}

function DonationPage({ accounts, saveAccountsItem, deleteAccountsItem, school }) {
  const [form, setForm] = useState({ donorName: '', donorType: 'Individual', donorPhone: '', donorEmail: '', donorAddress: '', panNumber: '', amount: '', date: today(), purpose: 'General Donation', paymentMode: 'Cash', transactionId: '', bankName: '', category: 'One Time', is80G: 'No', remarks: '' })
  const [query, setQuery] = useState('')
  const rows = values(accounts.donations).filter(row => `${row.donorName} ${row.purpose} ${row.donorPhone}`.toLowerCase().includes(query.toLowerCase()))
  const submit = async event => {
    event.preventDefault()
    const count = values(accounts.donations).filter(row => String(row.receiptNo || '').includes(`DON-${new Date().getFullYear()}`)).length + 1
    const saved = await saveAccountsItem('donations', { ...form, amount: Number(form.amount || 0), receiptNo: `DON-${new Date().getFullYear()}-${String(count).padStart(3, '0')}` })
    await saveAccountsItem('transactions', { date: form.date, type: 'income', category: 'donation', particular: `Donation from ${form.donorName}`, voucherNo: saved.receiptNo, debit: Number(form.amount || 0), credit: 0, paymentMode: form.paymentMode, referenceId: saved.id })
    alert('Donation saved.')
    printDonationReceipt(school, saved)
    setForm(current => ({ ...current, donorName: '', donorPhone: '', donorEmail: '', donorAddress: '', panNumber: '', amount: '', transactionId: '', remarks: '' }))
  }
  return <div className="accounts-page"><section className="panel accounts-form"><div className="panel-header"><div><h3>Add Donation</h3><p>Generate donation receipt with 80G details.</p></div></div><form onSubmit={submit}><div className="form-grid"><label>Donor Name*<input required value={form.donorName} onChange={e => setForm({ ...form, donorName: e.target.value })} /></label><label>Donor Type<select value={form.donorType} onChange={e => setForm({ ...form, donorType: e.target.value })}>{['Individual','Alumni','Trust/Foundation','Corporate/Company','Government','NGO','Parent','Other'].map(item => <option key={item}>{item}</option>)}</select></label><label>Phone*<input required value={form.donorPhone} onChange={e => setForm({ ...form, donorPhone: e.target.value })} /></label><label>Email<input value={form.donorEmail} onChange={e => setForm({ ...form, donorEmail: e.target.value })} /></label><label>PAN<input value={form.panNumber} onChange={e => setForm({ ...form, panNumber: e.target.value })} /></label><label>Amount*<input required type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label><label>Date<DatePicker value={form.date} onChange={value => setForm({ ...form, date: value })} /></label><label>Purpose<select value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })}>{['General Donation','Building Fund','Scholarship Fund','Sports Fund','Lab Equipment Fund','Library Book Fund','Computer Fund','Poor Student Fund','Mid Day Meal Fund','Emergency Relief Fund','Teacher Welfare Fund','Infrastructure Development','Custom Purpose'].map(item => <option key={item}>{item}</option>)}</select></label><label>Payment Mode<select value={form.paymentMode} onChange={e => setForm({ ...form, paymentMode: e.target.value })}>{['Cash','UPI','NEFT','Cheque','DD','Online'].map(item => <option key={item}>{item}</option>)}</select></label><label>Transaction / Cheque No<input value={form.transactionId} onChange={e => setForm({ ...form, transactionId: e.target.value })} /></label><label>80G Eligible<select value={form.is80G} onChange={e => setForm({ ...form, is80G: e.target.value })}><option>No</option><option>Yes</option></select></label><label>Category<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{['One Time','Monthly','Quarterly','Yearly'].map(item => <option key={item}>{item}</option>)}</select></label><label className="full">Address<textarea value={form.donorAddress} onChange={e => setForm({ ...form, donorAddress: e.target.value })} /></label><label className="full">Remarks<textarea value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} /></label></div><button className="primary-button"><Plus size={14} /> Submit Donation</button></form></section><section className="accounts-stat-grid small"><StatCard label="This Month" value={money(rows.filter(row => String(row.date || '').startsWith(monthKey())).reduce((s, r) => s + Number(r.amount || 0), 0))} tone="donation" note="Donation collected" /><StatCard label="This Year" value={money(rows.reduce((s, r) => s + Number(r.amount || 0), 0))} tone="donation" note="Total donations" /><StatCard label="Donors" value={new Set(rows.map(row => row.donorPhone || row.donorName)).size} tone="bank" note="Unique donors" /></section><section className="panel table-panel"><div className="panel-header"><div><h3>Donation List</h3><p>Receipts and donor database.</p></div><div className="table-search"><Search size={14} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search donor" /></div></div><div className="table-scroll"><table><thead><tr><th>Receipt No</th><th>Donor</th><th>Type</th><th>Amount</th><th>Purpose</th><th>Mode</th><th>Date</th><th>80G</th><th>Actions</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.receiptNo}</td><td>{row.donorName}<small>{row.donorPhone}</small></td><td><span className="accounts-badge donation">{row.donorType}</span></td><td>{money(row.amount)}</td><td>{row.purpose}</td><td>{row.paymentMode}</td><td>{dateLabel(row.date)}</td><td>{row.is80G}</td><td><button className="icon-button" onClick={() => printDonationReceipt(school, row)}><Printer size={14} /></button><button className="icon-button danger" onClick={() => deleteAccountsItem('donations', row.id)}><Trash2 size={14} /></button></td></tr>)}{!rows.length && <tr><td colSpan="9"><div className="empty-state">No donations recorded.</div></td></tr>}</tbody></table></div></section></div>
}

function ConcessionPage({ accounts, students, saveAccountsItem, deleteAccountsItem }) {
  const [form, setForm] = useState({ studentId: '', concessionType: 'Scholarship (Merit Based)', concessionOn: 'Tuition Fee', discountType: 'Percentage', discountValue: '', reason: '', approvedBy: 'Principal', validFrom: today(), validTill: '', status: 'active' })
  const student = students.find(item => item.id === form.studentId)
  const submit = async event => {
    event.preventDefault()
    await saveAccountsItem('concessions', { ...form, studentName: studentName(student), className: studentClass(student) })
    setForm(current => ({ ...current, studentId: '', discountValue: '', reason: '' }))
  }
  const rows = values(accounts.concessions)
  return <GenericFormList title="Fee Concession" onSubmit={submit} form={<div className="form-grid"><label>Select Student<select required value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })}><option value="">Select student</option>{students.map(student => <option key={student.id} value={student.id}>{studentName(student)} - {studentAdmission(student)}</option>)}</select></label><label>Concession Type<select value={form.concessionType} onChange={e => setForm({ ...form, concessionType: e.target.value })}>{['Scholarship (Merit Based)','Scholarship (Need Based)','Sibling Discount','Staff Ward Discount','RTE Quota (Free)','EWS Quota','Sports Scholarship','Full Fee Waiver','Partial Fee Waiver','Custom'].map(item => <option key={item}>{item}</option>)}</select></label><label>Concession On<select value={form.concessionOn} onChange={e => setForm({ ...form, concessionOn: e.target.value })}><option>Tuition Fee</option><option>Exam Fee</option><option>All Fees</option><option>Custom</option></select></label><label>Discount Type<select value={form.discountType} onChange={e => setForm({ ...form, discountType: e.target.value })}><option>Percentage</option><option>Fixed Amount</option></select></label><label>Discount Value<input required type="number" value={form.discountValue} onChange={e => setForm({ ...form, discountValue: e.target.value })} /></label><label>Approved By<input value={form.approvedBy} onChange={e => setForm({ ...form, approvedBy: e.target.value })} /></label><label>Valid From<DatePicker value={form.validFrom} onChange={value => setForm({ ...form, validFrom: value })} /></label><label>Valid Till<DatePicker value={form.validTill} onChange={value => setForm({ ...form, validTill: value })} /></label><label className="full">Reason<textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></label></div>} headers={['Student','Class','Type','Discount','Approved By','Status','Actions']} rows={rows.map(row => [row.studentName, row.className, row.concessionType, `${row.discountValue}${row.discountType === 'Percentage' ? '%' : ''}`, row.approvedBy, row.status, <button className="icon-button danger" onClick={() => deleteAccountsItem('concessions', row.id)}><Trash2 size={14} /></button>])} />
}

function FinesPage({ accounts, students, saveAccountsItem, deleteAccountsItem }) {
  const [form, setForm] = useState({ studentId: '', fineType: 'Late Fee Fine', amount: '', reason: '', date: today(), status: 'pending' })
  const student = students.find(item => item.id === form.studentId)
  const submit = async event => {
    event.preventDefault()
    await saveAccountsItem('fines', { ...form, studentName: studentName(student), amount: Number(form.amount || 0) })
    setForm(current => ({ ...current, studentId: '', amount: '', reason: '' }))
  }
  const rows = values(accounts.fines)
  return <GenericFormList title="Fine Management" onSubmit={submit} form={<div className="form-grid"><label>Select Student<select required value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })}><option value="">Select student</option>{students.map(student => <option key={student.id} value={student.id}>{studentName(student)} - {studentAdmission(student)}</option>)}</select></label><label>Fine Type<select value={form.fineType} onChange={e => setForm({ ...form, fineType: e.target.value })}>{['Late Fee Fine','Absent Fine','Library Fine','Custom Fine'].map(item => <option key={item}>{item}</option>)}</select></label><label>Amount<input required type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label><label>Date<DatePicker value={form.date} onChange={value => setForm({ ...form, date: value })} /></label><label>Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>pending</option><option>paid</option><option>waived</option></select></label><label className="full">Reason<textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></label></div>} headers={['Student','Type','Amount','Date','Status','Actions']} rows={rows.map(row => [row.studentName, row.fineType, money(row.amount), dateLabel(row.date), row.status, <button className="icon-button danger" onClick={() => deleteAccountsItem('fines', row.id)}><Trash2 size={14} /></button>])} />
}

function OtherIncomePage({ accounts, saveAccountsItem, deleteAccountsItem }) {
  const [form, setForm] = useState({ source: 'TC Fee', amount: '', date: today(), receivedFrom: '', paymentMode: 'Cash', description: '' })
  const submit = async event => {
    event.preventDefault()
    const count = values(accounts.otherIncome).length + 1
    await saveAccountsItem('otherIncome', { ...form, amount: Number(form.amount || 0), receiptNo: `OI-${new Date().getFullYear()}-${String(count).padStart(3, '0')}` })
    setForm(current => ({ ...current, amount: '', receivedFrom: '', description: '' }))
  }
  const rows = values(accounts.otherIncome)
  return <GenericFormList title="Other Income" onSubmit={submit} form={<div className="form-grid"><label>Income Source<select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>{['TC Fee','Certificate Fee','ID Card Fee','Sports Fee','Lab Fee','Computer Fee','Registration Fee','Interest Income','Government Grant','Any Other Income'].map(item => <option key={item}>{item}</option>)}</select></label><label>Amount<input required type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label><label>Date<DatePicker value={form.date} onChange={value => setForm({ ...form, date: value })} /></label><label>Received From<input value={form.receivedFrom} onChange={e => setForm({ ...form, receivedFrom: e.target.value })} /></label><label>Payment Mode<select value={form.paymentMode} onChange={e => setForm({ ...form, paymentMode: e.target.value })}>{['Cash','UPI','NEFT','Cheque','Bank Transfer'].map(item => <option key={item}>{item}</option>)}</select></label><label className="full">Description<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label></div>} headers={['Receipt','Source','Amount','From','Date','Mode','Actions']} rows={rows.map(row => [row.receiptNo, row.source, money(row.amount), row.receivedFrom, dateLabel(row.date), row.paymentMode, <button className="icon-button danger" onClick={() => deleteAccountsItem('otherIncome', row.id)}><Trash2 size={14} /></button>])} />
}

function VoucherForm({ type = 'payment', saveAccountsItem }) {
  const [form, setForm] = useState({ voucherType: type, date: today(), debitAccount: '', creditAccount: '', amount: '', narration: '', chequeNo: '', approvedBy: 'Admin' })
  const submit = async event => {
    event?.preventDefault?.()
    const prefix = form.voucherType === 'payment' ? 'PV' : form.voucherType === 'receipt' ? 'RV' : form.voucherType === 'contra' ? 'CV' : 'JV'
    await saveAccountsItem('vouchers', { ...form, amount: Number(form.amount || 0), voucherNo: `${prefix}-${Date.now().toString().slice(-5)}` })
    setForm(current => ({ ...current, debitAccount: '', creditAccount: '', amount: '', narration: '', chequeNo: '' }))
  }
  return <section className="panel accounts-form"><div className="panel-header"><div><h3>Create Voucher</h3><p>Payment, receipt, journal and contra vouchers.</p></div></div><form onSubmit={submit}><div className="form-grid"><label>Voucher Type<select value={form.voucherType} onChange={e => setForm({ ...form, voucherType: e.target.value })}><option value="payment">Payment Voucher</option><option value="receipt">Receipt Voucher</option><option value="journal">Journal Voucher</option><option value="contra">Contra Voucher</option></select></label><label>Date<DatePicker value={form.date} onChange={value => setForm({ ...form, date: value })} /></label><label>Debit Account<input required value={form.debitAccount} onChange={e => setForm({ ...form, debitAccount: e.target.value })} /></label><label>Credit Account<input required value={form.creditAccount} onChange={e => setForm({ ...form, creditAccount: e.target.value })} /></label><label>Amount<input required type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label><label>Cheque / Transaction ID<input value={form.chequeNo} onChange={e => setForm({ ...form, chequeNo: e.target.value })} /></label><label className="full">Narration<textarea required value={form.narration} onChange={e => setForm({ ...form, narration: e.target.value })} /></label></div><button className="primary-button">Submit Voucher</button></form></section>
}

function AdvancedPage({ accounts, saveAccountsItem, deleteAccountsItem, page }) {
  const [form, setForm] = useState({})
  const configs = {
    tax: { title: 'Tax Management', collection: 'tax/settings', fields: [['gstNumber','GST Number'],['gstApplicable','GST Applicable'],['gstRate','GST Rate'],['tdsApplicable','TDS Applicable'],['tdsRate','TDS Rate'],['panNumber','PAN Number']] },
    closing: { title: 'Financial Year Closing', collection: 'yearClosing', fields: [['financialYear','Financial Year'],['totalIncome','Total Income'],['totalExpense','Total Expense'],['surplus','Surplus/Deficit'],['status','Status']] },
    budget: { title: 'Budget vs Actual', collection: 'budget', fields: [['category','Category'],['monthlyBudget','Monthly Budget'],['annualBudget','Annual Budget']] },
    banks: { title: 'Bank Accounts', collection: 'bankAccounts', fields: [['bankName','Bank Name'],['accountNumber','Account Number'],['holderName','Account Holder'],['ifscCode','IFSC'],['branch','Branch'],['type','Type'],['balance','Opening Balance']] },
    assets: { title: 'Fixed Assets', collection: 'fixedAssets', fields: [['name','Asset Name'],['category','Category'],['purchaseDate','Purchase Date'],['purchasePrice','Purchase Price'],['expectedLife','Expected Life'],['depreciationMethod','Depreciation Method'],['salvageValue','Salvage Value'],['location','Location'],['status','Status']] },
  }
  if (page === 'vouchers') return <div className="accounts-page"><VoucherForm saveAccountsItem={saveAccountsItem} /><SimpleTable headers={['Voucher No','Type','Date','Debit','Credit','Amount','Narration']} rows={values(accounts.vouchers).map(row => [row.voucherNo, row.voucherType, dateLabel(row.date), row.debitAccount, row.creditAccount, money(row.amount), row.narration])} /></div>
  if (page === 'audit') return <SimpleTable headers={['Date Time','User','Action','Module','Description','Amount']} rows={values(accounts.auditLog).map(row => [dateLabel(row.timestamp), row.user, row.action, row.module, row.description, money(row.amount)])} empty="Audit logs will appear as financial actions are recorded." />
  const config = configs[page]
  const rows = values(page === 'tax' ? { settings: accounts.tax?.settings } : accounts[config.collection])
  const submit = async event => {
    event.preventDefault()
    await saveAccountsItem(config.collection, form)
    setForm({})
  }
  return <GenericFormList title={config.title} onSubmit={submit} form={<div className="form-grid">{config.fields.map(([key, label]) => <label key={key}>{label}{/date/i.test(key) ? <DatePicker value={form[key] || today()} onChange={value => setForm({ ...form, [key]: value })} /> : <input value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })} />}</label>)}</div>} headers={[...config.fields.slice(0, 5).map(([, label]) => label), 'Actions']} rows={rows.map(row => [...config.fields.slice(0, 5).map(([key]) => row?.[key] || '-'), <button className="icon-button danger" onClick={() => row?.id && deleteAccountsItem(config.collection, row.id)}><Trash2 size={14} /></button>])} />
}

function Ledger({ summary, accounts }) {
  const [account, setAccount] = useState('Fee Account')
  const rows = summary.recentTransactions.filter(row => account === 'Fee Account' ? row.category === 'Fee' : account === 'Salary Account' ? row.category === 'Salary' : account === 'Expense Account' ? row.type === 'Expense' : account === 'Transport Account' ? row.category === 'Transport' : account === 'Library Account' ? row.category === 'Library' : true)
  let balance = 0
  const ledgerRows = rows.map(row => {
    const debit = row.type === 'Income' ? Number(row.amount || 0) : 0
    const credit = row.type === 'Expense' ? Number(row.amount || 0) : 0
    balance += debit - credit
    return [dateLabel(row.date), row.particular, money(debit), money(credit), money(balance)]
  })
  return <div className="accounts-page"><section className="panel accounts-filters"><select value={account} onChange={e => setAccount(e.target.value)}>{['Fee Account','Salary Account','Expense Account','Transport Account','Library Account','Cash Account','Bank Account'].map(item => <option key={item}>{item}</option>)}</select><button className="secondary-button" onClick={() => printTable(`${account} Ledger`, ['Date','Particular','Debit','Credit','Balance'], ledgerRows)}><Printer size={14} /> Print Ledger</button></section><SimpleTable headers={['Date','Particular','Debit','Credit','Balance']} rows={ledgerRows} empty="No ledger records." /></div>
}

function Reports({ summary, accounts }) {
  const reports = {
    income: { title: 'Income Report', headers: ['Source','Amount'], rows: [['Fee', money(summary.feeIncome)], ['Transport', money(summary.transportIncome)], ['Donation', money(summary.donationIncome)], ['Fine', money(summary.fineIncome)], ['Other', money(summary.otherIncomeTotal)]] },
    expense: { title: 'Expense Report', headers: ['Category','Amount'], rows: Object.entries(summary.expenseRows.reduce((map, row) => ({ ...map, [row.category || 'Other']: (map[row.category || 'Other'] || 0) + Number(row.amount || 0) }), {})).map(([k, v]) => [k, money(v)]) },
    pnl: { title: 'Profit & Loss Statement', headers: ['Particular','Amount'], rows: [['Total Income', money(summary.totalIncome)], ['Total Expense', money(summary.totalExpense)], ['Net Profit/Loss', money(summary.netBalance)]] },
    balance: { title: 'Balance Sheet', headers: ['Particular','Amount'], rows: [['Cash', money(summary.cashBalance)], ['Bank', money(summary.bankBalance)], ['Receivables', money(summary.totalPending)], ['Net Worth', money(summary.netBalance + summary.cashBalance + summary.bankBalance)]] },
    donation: { title: 'Donation Report', headers: ['Receipt','Donor','Purpose','Amount'], rows: values(accounts.donations).map(row => [row.receiptNo, row.donorName, row.purpose, money(row.amount)]) },
    concession: { title: 'Concession Report', headers: ['Student','Type','Discount'], rows: values(accounts.concessions).map(row => [row.studentName, row.concessionType, row.discountValue]) },
    fine: { title: 'Fine Collection Report', headers: ['Student','Type','Amount','Status'], rows: values(accounts.fines).map(row => [row.studentName, row.fineType, money(row.amount), row.status]) },
    voucher: { title: 'Voucher Register', headers: ['Voucher','Type','Amount','Narration'], rows: values(accounts.vouchers).map(row => [row.voucherNo, row.voucherType, money(row.amount), row.narration]) },
    assets: { title: 'Fixed Asset Report', headers: ['Asset','Category','Purchase','Current'], rows: values(accounts.fixedAssets).map(row => [row.name, row.category, money(row.purchasePrice), money(row.currentValue || row.purchasePrice)]) },
  }
  const [selected, setSelected] = useState('income')
  const current = reports[selected]
  return <div className="accounts-page"><section className="panel accounts-filters"><select value={selected} onChange={e => setSelected(e.target.value)}>{Object.entries(reports).map(([id, report]) => <option key={id} value={id}>{report.title}</option>)}</select><button className="secondary-button" onClick={() => printTable(current.title, current.headers, current.rows)}><Printer size={14} /> Print</button><button className="secondary-button" onClick={() => exportCsv(current.headers, current.rows, current.title.replace(/\s+/g, '-').toLowerCase())}><Download size={14} /> Excel</button><button className="secondary-button" onClick={() => printTable(current.title, current.headers, current.rows)}><FileText size={14} /> PDF</button></section><SimpleTable headers={current.headers} rows={current.rows} empty="No report data." /></div>
}

function GenericFormList({ title, form, onSubmit, headers, rows }) {
  return <div className="accounts-page"><section className="panel accounts-form"><div className="panel-header"><div><h3>{title}</h3><p>Add, update and track records.</p></div></div><form onSubmit={onSubmit}>{form}<button className="primary-button"><Plus size={14} /> Submit</button></form></section><SimpleTable headers={headers} rows={rows} /></div>
}
function TabbedPage({ title, tabs, active, setActive, children }) {
  return <div className="accounts-page"><div className="panel-header loose"><div><h3>{title}</h3><p>Unified school accounting controls.</p></div></div><div className="accounts-subtabs">{tabs.map(([id, label]) => <button key={id} className={active === id ? 'active' : ''} onClick={() => setActive(id)}>{label}</button>)}</div>{children}</div>
}
function Toolbar({ query, setQuery, onPrint, onExport }) {
  return <section className="panel accounts-filters"><div className="table-search"><Search size={14} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search records" /></div><button className="secondary-button" onClick={onPrint}><Printer size={14} /> Print</button><button className="secondary-button" onClick={onExport}><Download size={14} /> Excel</button></section>
}
function SummaryStrip({ items }) {
  return <section className="accounts-summary-strip">{items.map(([label, value]) => <span key={label}>{label}<strong>{value}</strong></span>)}</section>
}
function SimpleTable({ headers, rows = [], empty = 'No records found.' }) {
  return <section className="panel table-panel"><div className="table-scroll"><table><thead><tr>{headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}{!rows.length && <tr><td colSpan={headers.length}><div className="empty-state">{empty}</div></td></tr>}</tbody></table></div></section>
}

export default function AccountsManager({ students = [], fees = {}, expenses = {}, transport = {}, library = {}, staff = {}, employeeConfig = {}, accounts = {}, school = {}, saveAccountsItem, deleteAccountsItem, saveExpenseItem, setPage }) {
  const safeAccounts = normalizeAccounts(accounts)
  const summary = useMemo(() => buildAccounting({ students, fees, expenses, transport, library, staff, employeeConfig, accounts: safeAccounts }), [students, fees, expenses, transport, library, staff, employeeConfig, safeAccounts])
  const [tab, setTab] = useState('dashboard')
  const tabs = [
    ['dashboard', 'Dashboard'], ['fee', 'Fee Accounts'], ['expense', 'Expense Accounts'], ['salary', 'Salary Accounts'],
    ['pending', 'Pending Payments'], ['bank', 'Bank & Cash'], ['ledger', 'Ledger'], ['donations', 'Donations'],
    ['concession', 'Fee Concession'], ['fines', 'Fines'], ['income', 'Other Income'], ['tax', 'Tax Management'],
    ['closing', 'Year Closing'], ['audit', 'Audit Log'], ['budget', 'Budget vs Actual'], ['banks', 'Bank Accounts'],
    ['vouchers', 'Vouchers'], ['assets', 'Fixed Assets'], ['reports', 'Reports'],
  ]
  return <div className="accounts-module"><div className="section-actions"><div><h2>Accounts</h2><p>Income, expense, pending payments, donations, vouchers and audit reports.</p></div></div><div className="accounts-tabs">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</div>
    {tab === 'dashboard' && <AccountsDashboard summary={summary} setTab={setTab} />}
    {tab === 'fee' && <FeeAccounts summary={summary} students={students} setPage={setPage} />}
    {tab === 'expense' && <ExpenseAccounts summary={summary} saveExpenseItem={saveExpenseItem} />}
    {tab === 'salary' && <SalaryAccounts summary={summary} staff={staff} employeeConfig={employeeConfig} saveExpenseItem={saveExpenseItem} />}
    {tab === 'pending' && <PendingPayments summary={summary} />}
    {tab === 'bank' && <BankCash summary={summary} accounts={safeAccounts} saveAccountsItem={saveAccountsItem} />}
    {tab === 'ledger' && <Ledger summary={summary} accounts={safeAccounts} />}
    {tab === 'donations' && <DonationPage accounts={safeAccounts} saveAccountsItem={saveAccountsItem} deleteAccountsItem={deleteAccountsItem} school={school} />}
    {tab === 'concession' && <ConcessionPage accounts={safeAccounts} students={students} saveAccountsItem={saveAccountsItem} deleteAccountsItem={deleteAccountsItem} />}
    {tab === 'fines' && <FinesPage accounts={safeAccounts} students={students} saveAccountsItem={saveAccountsItem} deleteAccountsItem={deleteAccountsItem} />}
    {tab === 'income' && <OtherIncomePage accounts={safeAccounts} saveAccountsItem={saveAccountsItem} deleteAccountsItem={deleteAccountsItem} />}
    {['tax', 'closing', 'audit', 'budget', 'banks', 'vouchers', 'assets'].includes(tab) && <AdvancedPage accounts={safeAccounts} saveAccountsItem={saveAccountsItem} deleteAccountsItem={deleteAccountsItem} page={tab} />}
    {tab === 'reports' && <Reports summary={summary} accounts={safeAccounts} />}
  </div>
}
