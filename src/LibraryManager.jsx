import React, { useMemo, useState } from 'react'
import {
  BookOpen, Check, Download, Edit3, FileText, Plus, Printer, RotateCcw,
  Search, Trash2, Upload,
} from 'lucide-react'
import imageCompression from 'browser-image-compression'
import DatePicker from './DatePicker'

const today = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}
const addDays = (date, days) => {
  const next = new Date(`${date || today()}T00:00:00`)
  next.setDate(next.getDate() + Number(days || 0))
  return next.toISOString().slice(0, 10)
}
const values = object => Object.values(object || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
const money = value => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`
const dateLabel = value => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
const initials = name => String(name || 'Book').split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()
const studentName = student => student?.name || student?.full_name || student?.fullName || 'Student'
const studentAdmission = student => student?.roll || student?.admissionNo || student?.admission_number || ''
const studentClass = student => student?.className || `${student?.class_name || ''}-${student?.section || ''}`.replace(/^-|-$/g, '') || '-'
const normalize = library => ({
  books: {},
  issues: {},
  returns: {},
  categories: {},
  fines: {},
  ...library,
  settings: { finePerDay: 5, maxFine: 500, maxBooksPerStudent: 3, defaultIssuePeriod: 14, allowReference: false, allowOverdue: false, ...(library?.settings || {}) },
})

const defaultCategories = [
  'Fiction', 'Non-Fiction', 'Science', 'Mathematics', 'English Literature', 'Hindi Literature',
  'History', 'Geography', 'Computer Science', 'General Knowledge', 'Competitive Exams',
  'Comics/Story Books', 'Reference Books', 'Dictionary', 'Encyclopedia', 'Religious Books',
  'Biographies', 'Art & Craft', 'Music & Dance', 'Sports & Games', 'Health & Fitness',
  'Philosophy', 'Psychology', 'Business & Management', 'Children Books',
].map((name, index) => ({ id: `cat_${index + 1}`, name, icon: 'Book', description: '', createdAt: 0 }))

const getCategories = library => {
  const stored = values(library.categories)
  const names = new Set(stored.map(item => item.name))
  return [...stored, ...defaultCategories.filter(item => !names.has(item.name))]
}
const nextBookBaseId = books => {
  const max = values(books).reduce((highest, book) => {
    const match = String(book.baseId || book.bookId || '').match(/BK-(\d+)/)
    return Math.max(highest, match ? Number(match[1]) : 0)
  }, 0)
  return `BK-${String(max + 1).padStart(3, '0')}`
}
const activeIssues = library => values(library.issues).filter(item => item.status === 'issued')
const daysLate = dueDate => {
  const diff = Math.floor((new Date(`${today()}T00:00:00`) - new Date(`${String(dueDate || today()).slice(0, 10)}T00:00:00`)) / 86400000)
  return Math.max(0, diff)
}
const issueFine = (issue, settings) => Math.min(Number(settings.maxFine || 500), daysLate(issue.dueDate) * Number(settings.finePerDay || 5))
const bookStatus = book => Number(book.availableCopies || 0) > 0 && book.status !== 'issued' ? 'Available' : 'Issued'
const fileToDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('Could not read image.'))
  reader.readAsDataURL(file)
})
async function compressCover(file) {
  const compressed = await imageCompression(file, { maxSizeMB: 0.15, maxWidthOrHeight: 500, useWebWorker: true, initialQuality: 0.75 })
  return { url: await fileToDataUrl(compressed), size: compressed.size, originalSize: file.size, name: file.name }
}
function exportCsv(headers, rows, filename) {
  const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`
  const csv = [headers.map(escape).join(','), ...rows.map(row => row.map(escape).join(','))].join('\n')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  link.download = `${filename}.csv`
  link.click()
}
function printTable(title, headers, rows) {
  const win = window.open('', '_blank', 'width=900,height=900')
  if (!win) return alert('Please allow popups to print.')
  win.document.write(`<html><head><title>${title}</title><style>body{font-family:Arial;margin:24px;color:#021024}.head{text-align:center;margin-bottom:18px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #111;padding:7px;font-size:12px;text-align:left}th{background:#052659;color:#fff}.sign{display:flex;justify-content:space-between;margin-top:42px}.line{border-top:1px solid #111;width:180px;text-align:center;padding-top:6px}@media print{@page{size:A4;margin:12mm}}</style></head><body><div class="head"><h2>School Library Report</h2><p>${title} - Generated ${dateLabel(today())}</p></div><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table><div class="sign"><div class="line">Librarian</div><div class="line">Principal</div></div><script>window.onload=()=>window.print()</script></body></html>`)
  win.document.close()
}
function printSlip(title, rows) {
  const win = window.open('', '_blank', 'width=520,height=700')
  if (!win) return alert('Please allow popups to print slip.')
  win.document.write(`<html><head><title>${title}</title><style>body{font-family:Arial;margin:20px;color:#021024}.slip{border:2px solid #052659;padding:18px;max-width:380px;margin:auto}.head{text-align:center;border-bottom:1px solid #052659;margin-bottom:12px}dl{display:grid;grid-template-columns:120px 1fr;gap:8px}dt{font-weight:bold}.line{border-top:1px solid #111;margin-top:34px;text-align:center;padding-top:6px}</style></head><body><div class="slip"><div class="head"><h3>SCHOOL LIBRARY</h3><p>${title}</p></div><dl>${rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl><div class="line">Librarian</div></div><script>window.onload=()=>window.print()</script></body></html>`)
  win.document.close()
}

function Cover({ book, small = false }) {
  if (book?.coverPhotoURL) return <img className={small ? 'library-cover small' : 'library-cover'} src={book.coverPhotoURL} alt="" />
  return <span className={small ? 'library-cover small initials' : 'library-cover initials'}>{initials(book?.title)}</span>
}

function AddBookPage({ library, saveItem }) {
  const categories = getCategories(library)
  const [form, setForm] = useState({ title: '', author: '', publisher: '', isbn: '', category: categories[0]?.name || 'Fiction', language: 'English', edition: '', yearOfPublication: '', totalCopies: 1, price: '', rackNumber: '', rowNumber: '', condition: 'Good', description: '', referenceOnly: false })
  const [cover, setCover] = useState(null)
  const [saving, setSaving] = useState(false)
  const onFile = async file => file && setCover(await compressCover(file))
  const submit = async event => {
    event.preventDefault()
    setSaving(true)
    try {
      const baseId = nextBookBaseId(library.books)
      const copies = Math.max(1, Number(form.totalCopies || 1))
      await Promise.all(Array.from({ length: copies }, (_, index) => {
        const copyId = `${baseId}-${index + 1}`
        return saveItem('books', {
          ...form,
          id: copyId,
          baseId,
          copyNumber: index + 1,
          bookId: copyId,
          totalCopies: 1,
          availableCopies: 1,
          price: Number(form.price || 0),
          coverPhotoURL: cover?.url || '',
          coverPhotoSize: cover?.size || 0,
          status: 'available',
          addedAt: Date.now(),
        })
      }))
      alert(`${copies} book cop${copies === 1 ? 'y' : 'ies'} added successfully.`)
      setForm(current => ({ ...current, title: '', author: '', publisher: '', isbn: '', edition: '', yearOfPublication: '', totalCopies: 1, price: '', rackNumber: '', rowNumber: '', description: '' }))
      setCover(null)
    } catch (error) {
      console.error('Book save error:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }
  return <section className="panel library-form-panel"><div className="panel-header"><div><h3>Add Book</h3><p>Auto creates copy IDs like BK-001-1, BK-001-2.</p></div></div><form onSubmit={submit}><div className="form-grid">
    <label>Book Title*<input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
    <label>Author Name*<input required value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} /></label>
    <label>Publisher<input value={form.publisher} onChange={e => setForm({ ...form, publisher: e.target.value })} /></label>
    <label>ISBN Number<input value={form.isbn} onChange={e => setForm({ ...form, isbn: e.target.value })} /></label>
    <label>Book Category*<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{categories.map(item => <option key={item.id || item.name}>{item.name}</option>)}</select></label>
    <label>Language<select value={form.language} onChange={e => setForm({ ...form, language: e.target.value })}>{['English','Hindi','Urdu','Sanskrit','Other'].map(item => <option key={item}>{item}</option>)}</select></label>
    <label>Edition<input value={form.edition} onChange={e => setForm({ ...form, edition: e.target.value })} /></label>
    <label>Year of Publication<input type="number" value={form.yearOfPublication} onChange={e => setForm({ ...form, yearOfPublication: e.target.value })} /></label>
    <label>Number of Copies*<input required type="number" min="1" value={form.totalCopies} onChange={e => setForm({ ...form, totalCopies: e.target.value })} /></label>
    <label>Book Price<input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></label>
    <label>Rack / Shelf<input value={form.rackNumber} onChange={e => setForm({ ...form, rackNumber: e.target.value })} /></label>
    <label>Row Number<input value={form.rowNumber} onChange={e => setForm({ ...form, rowNumber: e.target.value })} /></label>
    <label>Book Condition<select value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })}>{['New','Good','Fair','Damaged'].map(item => <option key={item}>{item}</option>)}</select></label>
    <label>Reference Only<select value={form.referenceOnly ? 'Yes' : 'No'} onChange={e => setForm({ ...form, referenceOnly: e.target.value === 'Yes' })}><option>No</option><option>Yes</option></select></label>
    <label className="library-upload">Book Cover<input type="file" accept="image/*" onChange={e => onFile(e.target.files?.[0])} /><span>{cover ? <><img src={cover.url} alt="" />{Math.round(cover.size / 1024)} KB</> : <><Upload size={16} /> Upload Cover</>}</span></label>
    <label className="full">Description<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
  </div><button className="primary-button" disabled={saving}><Plus size={15} /> {saving ? 'Saving...' : 'Submit Book'}</button></form></section>
}

function BookListPage({ library, saveItem, deleteItem, setTab, selectBook }) {
  const [view, setView] = useState('table')
  const [filters, setFilters] = useState({ query: '', category: '', language: '', condition: 'All', status: 'All', rack: '' })
  const categories = getCategories(library)
  const grouped = useMemo(() => {
    const map = {}
    values(library.books).forEach(book => {
      const key = book.baseId || book.bookId || book.id
      map[key] ||= { ...book, id: key, copies: [], totalCopies: 0, availableCopies: 0 }
      map[key].copies.push(book)
      map[key].totalCopies += 1
      map[key].availableCopies += Number(book.availableCopies || 0)
    })
    return Object.values(map).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }, [library.books])
  const rows = grouped.filter(book => {
    const text = `${book.title} ${book.author} ${book.isbn} ${book.category} ${book.bookId} ${book.baseId}`.toLowerCase()
    const status = book.availableCopies > 0 ? (book.availableCopies === book.totalCopies ? 'Available' : 'Issued') : 'All Issued'
    return (!filters.query || text.includes(filters.query.toLowerCase())) && (!filters.category || book.category === filters.category) && (!filters.language || book.language === filters.language) && (filters.condition === 'All' || book.condition === filters.condition) && (filters.status === 'All' || status === filters.status) && (!filters.rack || String(book.rackNumber || '').toLowerCase().includes(filters.rack.toLowerCase()))
  })
  const totalValue = values(library.books).reduce((sum, book) => sum + Number(book.price || 0), 0)
  const issueFirst = book => {
    const copy = book.copies.find(item => Number(item.availableCopies || 0) > 0 && item.status !== 'issued')
    if (!copy) return alert('No copy available for issue.')
    selectBook(copy)
    setTab('issue')
  }
  return <div className="library-page"><section className="panel library-filters"><div className="table-search"><Search size={15} /><input value={filters.query} onChange={e => setFilters({ ...filters, query: e.target.value })} placeholder="Search by title, author, ISBN or category" /></div><select value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value })}><option value="">All Categories</option>{categories.map(item => <option key={item.id || item.name}>{item.name}</option>)}</select><select value={filters.language} onChange={e => setFilters({ ...filters, language: e.target.value })}><option value="">All Languages</option>{['English','Hindi','Urdu','Sanskrit','Other'].map(item => <option key={item}>{item}</option>)}</select><select value={filters.condition} onChange={e => setFilters({ ...filters, condition: e.target.value })}>{['All','New','Good','Fair','Damaged'].map(item => <option key={item}>{item}</option>)}</select><select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>{['All','Available','Issued','All Issued'].map(item => <option key={item}>{item}</option>)}</select><input value={filters.rack} onChange={e => setFilters({ ...filters, rack: e.target.value })} placeholder="Rack no." /><button className="secondary-button" onClick={() => setView(view === 'table' ? 'cards' : 'table')}>{view === 'table' ? 'Card View' : 'Table View'}</button></section>
    <section className="library-summary-bar"><span>Total Books <strong>{values(library.books).length}</strong></span><span>Total Titles <strong>{grouped.length}</strong></span><span>Available <strong>{values(library.books).filter(book => Number(book.availableCopies || 0) > 0).length}</strong></span><span>Issued <strong>{activeIssues(library).length}</strong></span><span>Total Value <strong>{money(totalValue)}</strong></span></section>
    {view === 'cards' ? <section className="library-card-grid">{rows.map(book => <article className="library-book-card" key={book.id}><Cover book={book} /><div><span>{book.baseId}</span><h3>{book.title}</h3><p>By: {book.author}</p><p>{book.category}</p><p>{money(book.price)} - Rack {book.rackNumber || '-'}</p><strong>{book.availableCopies}/{book.totalCopies} Available</strong><div className="modal-actions"><button className="primary-button" onClick={() => issueFirst(book)}>Issue</button><button className="secondary-button" onClick={() => selectBook(book.copies[0])}><Edit3 size={14} /> Edit</button></div></div></article>)}</section> : <section className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>#</th><th>Cover</th><th>Book ID</th><th>Title</th><th>Author</th><th>Category</th><th>Publisher</th><th>Price</th><th>Rack</th><th>Copies</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((book, index) => <tr key={book.id}><td>{index + 1}</td><td><Cover book={book} small /></td><td>{book.baseId}</td><td><strong>{book.title}</strong><small>{book.isbn || ''}</small></td><td>{book.author}</td><td><span className="library-badge">{book.category}</span></td><td>{book.publisher || '-'}</td><td>{money(book.price)}</td><td>{book.rackNumber || '-'}</td><td>{book.availableCopies}/{book.totalCopies}</td><td><span className={`library-status ${book.availableCopies ? 'available' : 'overdue'}`}>{book.availableCopies ? 'Available' : 'All Out'}</span></td><td><div className="transport-row-actions"><button className="secondary-button" onClick={() => issueFirst(book)}>Issue</button><button className="icon-button danger" onClick={() => book.copies.forEach(copy => deleteItem('books', copy.id))}><Trash2 size={14} /></button></div></td></tr>)}{!rows.length && <tr><td colSpan="12"><div className="empty-state">No books added yet.</div></td></tr>}</tbody></table></div></section>}</div>
}

function IssueBookPage({ library, students, saveItem, preselectedBook }) {
  const [studentQuery, setStudentQuery] = useState('')
  const [bookQuery, setBookQuery] = useState(preselectedBook?.bookId || '')
  const [studentId, setStudentId] = useState('')
  const [bookId, setBookId] = useState(preselectedBook?.id || '')
  const [issueDate, setIssueDate] = useState(today())
  const [dueDate, setDueDate] = useState(addDays(today(), library.settings.defaultIssuePeriod))
  const [override, setOverride] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const availableBooks = values(library.books).filter(book => Number(book.availableCopies || 0) > 0 && book.status !== 'issued')
  const studentResults = students.filter(student => `${studentName(student)} ${studentAdmission(student)} ${student.phone || ''}`.toLowerCase().includes(studentQuery.toLowerCase())).slice(0, 6)
  const bookResults = availableBooks.filter(book => `${book.title} ${book.author} ${book.bookId}`.toLowerCase().includes(bookQuery.toLowerCase())).slice(0, 6)
  const student = students.find(item => item.id === studentId)
  const book = values(library.books).find(item => item.id === bookId)
  const studentIssues = activeIssues(library).filter(item => item.studentId === studentId)
  const overdue = studentIssues.filter(item => daysLate(item.dueDate) > 0)
  const blocked = !student || !book || (!override && (studentIssues.length >= Number(library.settings.maxBooksPerStudent || 3) || overdue.length > 0 || (book.referenceOnly && !library.settings.allowReference)))
  const submit = async () => {
    if (blocked) return alert('Please fix validation warnings or use admin override.')
    setSaving(true)
    try {
      const row = await saveItem('issues', { bookId: book.bookId, bookRecordId: book.id, bookTitle: book.title, studentId: student.id, studentName: studentName(student), admissionNo: studentAdmission(student), class: studentClass(student), issueDate, dueDate, returnDate: null, fineAmount: 0, finePaid: false, conditionOnReturn: null, status: 'issued', notes, issuedBy: 'admin' })
      await saveItem('books', { ...book, availableCopies: 0, status: 'issued' })
      alert(`Book issued to ${studentName(student)}. Due date: ${dateLabel(dueDate)}`)
      printSlip('Book Issue Slip', [['Book', book.title], ['Book ID', book.bookId], ['Student', studentName(student)], ['Class', studentClass(student)], ['Issue Date', dateLabel(issueDate)], ['Due Date', dateLabel(dueDate)], ['Fine', `${money(library.settings.finePerDay)}/day after due`]])
      setNotes('')
      return row
    } catch (error) {
      console.error('Issue book error:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }
  return <div className="library-page"><section className="panel library-form-panel"><div className="panel-header"><div><h3>Issue Book</h3><p>Search student and book, then issue with due date validation.</p></div></div><div className="library-issue-grid"><div><label>Search Student*</label><div className="table-search"><Search size={15} /><input value={studentQuery} onChange={e => setStudentQuery(e.target.value)} placeholder="Admission no / name / phone" /></div>{studentQuery && <div className="library-search-list">{studentResults.map(item => <button key={item.id} className={studentId === item.id ? 'active' : ''} onClick={() => { setStudentId(item.id); setStudentQuery(studentName(item)) }}><span className="library-student-photo">{item.photoURL ? <img src={item.photoURL} alt="" /> : initials(studentName(item))}</span><strong>{studentName(item)}<small>{studentAdmission(item)} - {studentClass(item)}</small></strong></button>)}</div>}</div><div><label>Search Book*</label><div className="table-search"><Search size={15} /><input value={bookQuery} onChange={e => setBookQuery(e.target.value)} placeholder="Title / author / book ID" /></div>{bookQuery && <div className="library-search-list">{bookResults.map(item => <button key={item.id} className={bookId === item.id ? 'active' : ''} onClick={() => { setBookId(item.id); setBookQuery(`${item.bookId} - ${item.title}`) }}><Cover book={item} small /><strong>{item.title}<small>{item.bookId} - Rack {item.rackNumber || '-'}</small></strong></button>)}</div>}</div></div>{student && <div className="library-summary-bar"><span>Student <strong>{studentName(student)}</strong></span><span>Class <strong>{studentClass(student)}</strong></span><span>Issued Books <strong>{studentIssues.length}</strong></span><span>Overdue <strong>{overdue.length}</strong></span></div>}{book && <div className="library-summary-bar"><span>Book <strong>{book.title}</strong></span><span>Book ID <strong>{book.bookId}</strong></span><span>Available <strong>{bookStatus(book)}</strong></span><span>Rack <strong>{book.rackNumber || '-'}</strong></span></div>}<div className="form-grid"><label>Issue Date*<DatePicker value={issueDate} onChange={value => { setIssueDate(value); setDueDate(addDays(value, library.settings.defaultIssuePeriod)) }} /></label><label>Due Date*<DatePicker value={dueDate} onChange={setDueDate} /></label><label>Issue Type<select><option>Regular</option><option>Reference Only</option></select></label><label className="full">Notes<textarea value={notes} onChange={e => setNotes(e.target.value)} /></label></div>{studentIssues.length >= Number(library.settings.maxBooksPerStudent || 3) && <div className="library-warning">Max {library.settings.maxBooksPerStudent} books already issued.</div>}{overdue.length > 0 && <div className="library-warning">This student has {overdue.length} overdue book(s).</div>}{book?.referenceOnly && <div className="library-warning">Reference book - not for regular issue.</div>}<label className="library-inline-check"><input type="checkbox" checked={override} onChange={e => setOverride(e.target.checked)} /> Admin override warnings</label><button className="primary-button" disabled={saving || !student || !book} onClick={submit}><Check size={15} /> {saving ? 'Issuing...' : 'Issue Book'}</button></section></div>
}

function ReturnBookPage({ library, saveItem }) {
  const [query, setQuery] = useState('')
  const [returning, setReturning] = useState(null)
  const [form, setForm] = useState({ returnDate: today(), finePaid: 'No', conditionOnReturn: 'Good', damageFine: 0, remarks: '' })
  const rows = activeIssues(library).filter(issue => `${issue.bookId} ${issue.bookTitle} ${issue.studentName} ${issue.admissionNo}`.toLowerCase().includes(query.toLowerCase()))
  const confirmReturn = async issue => {
    const fineAmount = issueFine(issue, library.settings) + Number(form.damageFine || 0)
    await saveItem('returns', { issueId: issue.id, bookId: issue.bookId, bookTitle: issue.bookTitle, studentId: issue.studentId, studentName: issue.studentName, returnDate: form.returnDate, daysLate: daysLate(issue.dueDate), fineAmount, finePaid: form.finePaid === 'Yes', conditionOnReturn: form.conditionOnReturn, damageFine: Number(form.damageFine || 0), remarks: form.remarks, returnedTo: 'admin' })
    await saveItem('issues', { ...issue, status: 'returned', returnDate: form.returnDate, fineAmount, finePaid: form.finePaid === 'Yes', conditionOnReturn: form.conditionOnReturn })
    const book = values(library.books).find(item => item.id === issue.bookRecordId)
    if (book) await saveItem('books', { ...book, availableCopies: 1, status: 'available' })
    if (fineAmount > 0) await saveItem('fines', { studentId: issue.studentId, studentName: issue.studentName, bookId: issue.bookId, daysLate: daysLate(issue.dueDate), fineAmount, paid: form.finePaid === 'Yes', paidDate: form.finePaid === 'Yes' ? Date.now() : null, waived: false, waiveReason: '' })
    alert('Book returned successfully.')
    printSlip('Book Return Receipt', [['Book', issue.bookTitle], ['Book ID', issue.bookId], ['Student', issue.studentName], ['Return Date', dateLabel(form.returnDate)], ['Fine', money(fineAmount)], ['Condition', form.conditionOnReturn]])
    setReturning(null)
  }
  return <div className="library-page"><section className="panel library-filters"><div className="table-search"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by book ID, student name or admission no" /></div></section><section className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>#</th><th>Book</th><th>Student</th><th>Issued</th><th>Due Date</th><th>Days Late</th><th>Fine</th><th>Action</th></tr></thead><tbody>{rows.map((issue, index) => <tr key={issue.id}><td>{index + 1}</td><td>{issue.bookTitle}<small>{issue.bookId}</small></td><td>{issue.studentName}<small>{issue.class}</small></td><td>{dateLabel(issue.issueDate)}</td><td>{dateLabel(issue.dueDate)}</td><td>{daysLate(issue.dueDate)}</td><td>{money(issueFine(issue, library.settings))}</td><td><button className="primary-button" onClick={() => setReturning(issue)}><RotateCcw size={14} /> Return</button></td></tr>)}{!rows.length && <tr><td colSpan="8"><div className="empty-state">No active issued books found.</div></td></tr>}</tbody></table></div></section>{returning && <div className="modal-backdrop"><div className="modal"><div className="modal-header"><h3>Return Book</h3><button onClick={() => setReturning(null)} className="icon-button">x</button></div><div className="form-grid"><label>Book<input readOnly value={returning.bookTitle} /></label><label>Student<input readOnly value={returning.studentName} /></label><label>Return Date<DatePicker value={form.returnDate} onChange={value => setForm({ ...form, returnDate: value })} /></label><label>Days Late<input readOnly value={daysLate(returning.dueDate)} /></label><label>Fine Paid<select value={form.finePaid} onChange={e => setForm({ ...form, finePaid: e.target.value })}><option>No</option><option>Yes</option></select></label><label>Condition<select value={form.conditionOnReturn} onChange={e => setForm({ ...form, conditionOnReturn: e.target.value })}>{['Good','Slightly Damaged','Damaged'].map(item => <option key={item}>{item}</option>)}</select></label><label>Damage Fine<input type="number" value={form.damageFine} onChange={e => setForm({ ...form, damageFine: e.target.value })} /></label><label className="full">Remarks<textarea value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} /></label></div><div className="modal-actions"><button className="primary-button" onClick={() => confirmReturn(returning)}>Confirm Return</button></div></div></div>}</div>
}

function IssuedBooksPage({ library }) {
  const [query, setQuery] = useState('')
  const rows = activeIssues(library).filter(issue => `${issue.bookTitle} ${issue.bookId} ${issue.studentName} ${issue.admissionNo}`.toLowerCase().includes(query.toLowerCase()))
  return <LibraryIssueTable title="Issued Books" rows={rows} query={query} setQuery={setQuery} settings={library.settings} />
}

function OverduePage({ library, saveItem }) {
  const rows = activeIssues(library).filter(issue => daysLate(issue.dueDate) > 0)
  const totalFine = rows.reduce((sum, issue) => sum + issueFine(issue, library.settings), 0)
  const waive = async issue => {
    const reason = window.prompt('Reason for waiving fine:')
    if (!reason) return
    await saveItem('fines', { studentId: issue.studentId, studentName: issue.studentName, bookId: issue.bookId, daysLate: daysLate(issue.dueDate), fineAmount: 0, paid: false, waived: true, waiveReason: reason })
    alert('Fine waived.')
  }
  return <div className="library-page"><section className="library-summary-bar"><span>Total Overdue Books <strong>{rows.length}</strong></span><span>Total Fine Due <strong>{money(totalFine)}</strong></span><span>Longest Overdue <strong>{Math.max(0, ...rows.map(issue => daysLate(issue.dueDate)))} days</strong></span></section><section className="panel table-panel"><div className="panel-header"><div><h3>Overdue Books</h3><p>Fine is calculated at {money(library.settings.finePerDay)} per day.</p></div><button className="secondary-button" onClick={() => printTable('Overdue Books', ['Book','Student','Class','Due Date','Days','Fine'], rows.map(issue => [issue.bookTitle, issue.studentName, issue.class, dateLabel(issue.dueDate), daysLate(issue.dueDate), money(issueFine(issue, library.settings))]))}><Printer size={14} /> Print</button></div><div className="table-scroll"><table><thead><tr><th>#</th><th>Book</th><th>Student</th><th>Class</th><th>Due Date</th><th>Days Overdue</th><th>Fine</th><th>Actions</th></tr></thead><tbody>{rows.map((issue, index) => <tr key={issue.id}><td>{index + 1}</td><td>{issue.bookTitle}<small>{issue.bookId}</small></td><td>{issue.studentName}</td><td>{issue.class}</td><td>{dateLabel(issue.dueDate)}</td><td>{daysLate(issue.dueDate)}</td><td>{money(issueFine(issue, library.settings))}</td><td><button className="secondary-button" onClick={() => waive(issue)}>Waive Fine</button></td></tr>)}{!rows.length && <tr><td colSpan="8"><div className="empty-state">No overdue books.</div></td></tr>}</tbody></table></div></section></div>
}

function LibraryIssueTable({ title, rows, query, setQuery, settings }) {
  return <div className="library-page"><section className="panel library-filters"><div className="table-search"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search student/book/book ID" /></div></section><section className="panel table-panel"><div className="panel-header"><div><h3>{title}</h3><p>Currently active issues.</p></div></div><div className="table-scroll"><table><thead><tr><th>#</th><th>Book ID</th><th>Book Title</th><th>Student</th><th>Class</th><th>Issue Date</th><th>Due Date</th><th>Status</th><th>Reminder</th></tr></thead><tbody>{rows.map((issue, index) => { const late = daysLate(issue.dueDate); const left = Math.ceil((new Date(`${issue.dueDate}T00:00:00`) - new Date(`${today()}T00:00:00`)) / 86400000); return <tr key={issue.id}><td>{index + 1}</td><td>{issue.bookId}</td><td>{issue.bookTitle}</td><td>{issue.studentName}<small>{issue.admissionNo}</small></td><td>{issue.class}</td><td>{dateLabel(issue.issueDate)}</td><td>{dateLabel(issue.dueDate)}</td><td><span className={`library-status ${late ? 'overdue' : left <= 3 ? 'soon' : 'available'}`}>{late ? `${late} days overdue` : left <= 3 ? 'Due Soon' : 'On Time'}</span></td><td><a className="secondary-button" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Library Reminder: ${issue.studentName} has book ${issue.bookTitle}. Due date: ${dateLabel(issue.dueDate)}. Fine: Rs. ${settings.finePerDay}/day after due date.`)}`}>WhatsApp</a></td></tr> })}{!rows.length && <tr><td colSpan="9"><div className="empty-state">No issued books found.</div></td></tr>}</tbody></table></div></section></div>
}

function CategoriesPage({ library, saveItem, deleteItem }) {
  const [form, setForm] = useState({ name: '', icon: 'Book', description: '' })
  const [query, setQuery] = useState('')
  const rows = getCategories(library).filter(item => item.name.toLowerCase().includes(query.toLowerCase()))
  const bookCount = category => values(library.books).filter(book => book.category === category.name).length
  const save = async event => {
    event.preventDefault()
    await saveItem('categories', form)
    setForm({ name: '', icon: 'Book', description: '' })
  }
  return <div className="library-page"><section className="panel library-form-panel"><div className="panel-header"><div><h3>Book Categories</h3><p>Add custom library categories.</p></div></div><form onSubmit={save}><div className="form-grid"><label>Category Name*<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label>Icon<input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} /></label><label className="full">Description<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label></div><button className="primary-button"><Plus size={15} /> Save Category</button></form></section><section className="panel table-panel"><div className="panel-header"><div><h3>Categories</h3><p>Default and custom categories.</p></div><div className="table-search"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search category" /></div></div><div className="table-scroll"><table><thead><tr><th>#</th><th>Category</th><th>Total Books</th><th>Available</th><th>Most Popular</th><th>Actions</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || row.name}><td>{index + 1}</td><td>{row.name}</td><td>{bookCount(row)}</td><td>{values(library.books).filter(book => book.category === row.name && Number(book.availableCopies || 0) > 0).length}</td><td>-</td><td><button className="icon-button" onClick={() => setForm(row)}><Edit3 size={14} /></button>{!defaultCategories.some(cat => cat.name === row.name) && <button className="icon-button danger" onClick={() => deleteItem('categories', row.id)}><Trash2 size={14} /></button>}</td></tr>)}</tbody></table></div></section></div>
}

function ReportsPage({ library, students, saveItem }) {
  const [report, setReport] = useState('inventory')
  const [settings, setSettings] = useState(library.settings)
  const allBooks = values(library.books)
  const issues = values(library.issues)
  const returns = values(library.returns)
  const overdue = activeIssues(library).filter(issue => daysLate(issue.dueDate) > 0)
  const reports = {
    inventory: { title: 'Book Inventory Report', headers: ['Book ID','Title','Author','Category','Rack','Status','Price'], rows: allBooks.map(book => [book.bookId, book.title, book.author, book.category, book.rackNumber || '-', bookStatus(book), money(book.price)]) },
    issueReturn: { title: 'Issue / Return Report', headers: ['Type','Book','Student','Date','Status'], rows: [...issues.map(item => ['Issue', item.bookTitle, item.studentName, dateLabel(item.issueDate), item.status]), ...returns.map(item => ['Return', item.bookTitle, item.studentName, dateLabel(item.returnDate), item.conditionOnReturn])] },
    overdue: { title: 'Overdue Report', headers: ['Book','Student','Class','Due Date','Fine'], rows: overdue.map(item => [item.bookTitle, item.studentName, item.class, dateLabel(item.dueDate), money(issueFine(item, library.settings))]) },
    reading: { title: 'Student Reading Report', headers: ['Student','Class','Books Issued'], rows: students.map(student => [studentName(student), studentClass(student), issues.filter(item => item.studentId === student.id).length]).filter(row => row[2] > 0).sort((a, b) => b[2] - a[2]) },
    popular: { title: 'Popular Books Report', headers: ['Book','Issue Count'], rows: Object.entries(issues.reduce((map, item) => ({ ...map, [item.bookTitle]: (map[item.bookTitle] || 0) + 1 }), {})).map(([name, count]) => [name, count]).sort((a, b) => b[1] - a[1]) },
    fines: { title: 'Fine Collection Report', headers: ['Student','Book ID','Fine','Paid','Waived'], rows: values(library.fines).map(item => [item.studentName, item.bookId, money(item.fineAmount), item.paid ? 'Yes' : 'No', item.waived ? 'Yes' : 'No']) },
    condition: { title: 'Book Condition Report', headers: ['Book ID','Title','Condition','Rack'], rows: allBooks.map(book => [book.bookId, book.title, book.condition, book.rackNumber || '-']) },
  }
  const current = reports[report]
  const saveSettings = async () => {
    await saveItem('settings', { id: 'config', ...settings })
    alert('Library settings saved.')
  }
  return <div className="library-page"><section className="panel library-form-panel"><div className="panel-header"><div><h3>Fine Settings</h3><p>Configure issue limits and fines.</p></div></div><div className="form-grid"><label>Fine per day<input type="number" value={settings.finePerDay} onChange={e => setSettings({ ...settings, finePerDay: Number(e.target.value) })} /></label><label>Max fine per book<input type="number" value={settings.maxFine} onChange={e => setSettings({ ...settings, maxFine: Number(e.target.value) })} /></label><label>Max books per student<input type="number" value={settings.maxBooksPerStudent} onChange={e => setSettings({ ...settings, maxBooksPerStudent: Number(e.target.value) })} /></label><label>Default issue period<input type="number" value={settings.defaultIssuePeriod} onChange={e => setSettings({ ...settings, defaultIssuePeriod: Number(e.target.value) })} /></label><label>Allow reference books<select value={settings.allowReference ? 'Yes' : 'No'} onChange={e => setSettings({ ...settings, allowReference: e.target.value === 'Yes' })}><option>No</option><option>Yes</option></select></label><label>Allow overdue students<select value={settings.allowOverdue ? 'Yes' : 'No'} onChange={e => setSettings({ ...settings, allowOverdue: e.target.value === 'Yes' })}><option>No</option><option>Yes</option></select></label></div><button className="primary-button" onClick={saveSettings}><Check size={15} /> Save Settings</button></section><section className="panel"><div className="panel-header"><div><h3>Library Reports</h3><p>Inventory, overdue, reading and fine reports.</p></div><select value={report} onChange={e => setReport(e.target.value)}>{Object.entries(reports).map(([id, item]) => <option key={id} value={id}>{item.title}</option>)}</select></div><div className="expense-report-actions"><button className="secondary-button" onClick={() => printTable(current.title, current.headers, current.rows)}><Printer size={14} /> Print</button><button className="secondary-button" onClick={() => exportCsv(current.headers, current.rows, current.title.replace(/\s+/g, '-').toLowerCase())}><Download size={14} /> Excel</button><button className="secondary-button" onClick={() => printTable(current.title, current.headers, current.rows)}><FileText size={14} /> PDF</button></div><div className="table-scroll"><table><thead><tr>{current.headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{current.rows.map((row, index) => <tr key={index}>{row.map((cell, i) => <td key={i}>{cell}</td>)}</tr>)}{!current.rows.length && <tr><td colSpan={current.headers.length}><div className="empty-state">No records found.</div></td></tr>}</tbody></table></div></section></div>
}

export default function LibraryManager({ students = [], library = {}, saveLibraryItem, deleteLibraryItem }) {
  const safe = normalize(library)
  const [tab, setTab] = useState('add')
  const [selectedBook, setSelectedBook] = useState(null)
  const books = values(safe.books)
  const issued = activeIssues(safe)
  const overdue = issued.filter(issue => daysLate(issue.dueDate) > 0)
  const tabs = [['add','Add Book'], ['list','Book List'], ['issue','Issue Book'], ['return','Return Book'], ['issued','Issued Books'], ['overdue','Overdue Books'], ['categories','Categories'], ['reports','Reports']]
  return <div className="library-module"><div className="section-actions"><div><h2>Library Management</h2><p>Books, issue-return, overdue fines, categories and reports.</p></div></div><section className="library-dashboard"><div><BookOpen size={20} /><span>Total Books</span><strong>{books.length}</strong></div><div><Check size={20} /><span>Available</span><strong>{books.filter(book => Number(book.availableCopies || 0) > 0).length}</strong></div><div><FileText size={20} /><span>Issued</span><strong>{issued.length}</strong></div><div><RotateCcw size={20} /><span>Overdue</span><strong>{overdue.length}</strong></div></section><div className="library-tabs">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</div>{tab === 'add' && <AddBookPage library={safe} saveItem={saveLibraryItem} />}{tab === 'list' && <BookListPage library={safe} saveItem={saveLibraryItem} deleteItem={deleteLibraryItem} setTab={setTab} selectBook={book => { setSelectedBook(book); setTab('issue') }} />}{tab === 'issue' && <IssueBookPage library={safe} students={students} saveItem={saveLibraryItem} preselectedBook={selectedBook} />}{tab === 'return' && <ReturnBookPage library={safe} saveItem={saveLibraryItem} />}{tab === 'issued' && <IssuedBooksPage library={safe} />}{tab === 'overdue' && <OverduePage library={safe} saveItem={saveLibraryItem} />}{tab === 'categories' && <CategoriesPage library={safe} saveItem={saveLibraryItem} deleteItem={deleteLibraryItem} />}{tab === 'reports' && <ReportsPage library={safe} students={students} saveItem={saveLibraryItem} />}</div>
}
