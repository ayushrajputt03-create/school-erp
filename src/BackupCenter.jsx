import React, { useRef, useState } from 'react'
import { Check, DatabaseBackup, Download, FileJson, FileSpreadsheet, Mail, RotateCcw, ShieldCheck, Upload } from 'lucide-react'

const downloadBlob = (blob, name) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const backupName = extension => `northstar-school-backup-${new Date().toISOString().slice(0, 10)}.${extension}`

export default function BackupCenter({ students, fees, attendance, settings, createBackup, restoreBackup, saveSettings, role }) {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [emailSettings, setEmailSettings] = useState(settings)
  const admin = role === 'Owner' || role === 'Administrator'

  const exportJson = async () => {
    const payload = await createBackup()
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), backupName('json'))
    setMessage('Full restore backup downloaded.')
  }

  const exportExcel = async () => {
    setBusy('excel')
    try {
      // createBackup() fetches the full attendance history, so the workbook covers every month.
      const payload = await createBackup()
      const attendanceRows = Object.values(payload.data.attendance || {}).map(record => ({ date: record.date, studentId: record.studentId || record.student_id, status: record.status || record.mark }))
      const ExcelJS = (await import('exceljs')).default
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'Northstar School OS'
      workbook.created = new Date()
      const addSheet = (name, rows) => {
        const sheet = workbook.addWorksheet(name)
        if (!rows.length) {
          sheet.addRow(['No records'])
          return
        }
        const columns = [...new Set(rows.flatMap(row => Object.keys(row)))]
        sheet.columns = columns.map(key => ({ header: key.replace(/([A-Z])/g, ' $1').replace(/^./, value => value.toUpperCase()), key, width: Math.min(35, Math.max(14, key.length + 4)) }))
        rows.forEach(row => sheet.addRow(row))
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17233A' } }
        sheet.views = [{ state: 'frozen', ySplit: 1 }]
        sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + Math.min(columns.length, 26))}1` }
      }
      addSheet('Students', students.map(student => ({
        admissionNumber: student.roll, name: student.name, class: student.className,
        fatherName: student.fatherName || student.guardian, phone: student.phone,
        gender: student.gender, dateOfBirth: student.dob, feeGroup: student.feeGroup,
        feeStatus: student.fee, attendancePercent: student.attendance,
      })))
      addSheet('Fees', Object.values(fees).map(fee => ({
        receiptNumber: fee.receiptNumber || fee.invoiceNumber, admissionNumber: fee.admissionNumber,
        studentName: fee.studentName, class: fee.className, feeMonth: fee.billingMonth,
        paidAmount: fee.amount, balance: fee.balance || 0, paymentMode: fee.method,
        status: fee.status, receiptDate: fee.receiptDate || (fee.paidAt ? new Date(fee.paidAt).toLocaleDateString('en-IN') : ''),
      })))
      addSheet('Attendance', attendanceRows.map(row => ({
        date: row.date, admissionNumber: students.find(student => String(student.id) === String(row.studentId))?.roll || '',
        studentName: students.find(student => String(student.id) === String(row.studentId))?.name || row.studentId,
        status: row.status === 'P' ? 'Present' : row.status === 'A' ? 'Absent' : 'Leave',
      })))
      const buffer = await workbook.xlsx.writeBuffer()
      downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), backupName('xlsx'))
      setMessage('Excel workbook downloaded with Students, Fees and Attendance sheets.')
    } finally {
      setBusy('')
    }
  }

  const selectRestore = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setMessage('Backup file is too large. Maximum supported size is 10 MB.')
      return
    }
    setBusy('restore')
    try {
      const payload = JSON.parse(await file.text())
      if (payload?.format !== 'northstar-school-backup' || payload?.version !== 1 || !payload?.data || typeof payload.data !== 'object') throw new Error('Please select a valid NXT School ERP JSON backup file.')
      const confirmed = window.confirm(`Restore backup from ${new Date(payload.exportedAt).toLocaleString('en-IN')}?\n\nCurrent Students, Fees and Attendance will be replaced.`)
      if (!confirmed) return
      await exportJson()
      await restoreBackup(payload)
      setMessage('Backup restored successfully. A safety copy of the previous data was downloaded first.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy('')
    }
  }

  const saveEmail = async event => {
    event.preventDefault()
    setBusy('email')
    try {
      await saveSettings(emailSettings)
      setMessage(emailSettings.enabled ? 'Monthly backup email schedule saved.' : 'Monthly backup email disabled.')
    } finally {
      setBusy('')
    }
  }

  return <>
    <div className="section-actions"><div><h2>Data Backup Center</h2><p>Export, schedule and restore your complete school workspace.</p></div><span className="backup-role"><ShieldCheck size={15} /> {role} access</span></div>
    {!admin && <div className="backup-warning">Only Owner and Administrator accounts can export or restore school data.</div>}
    <section className="backup-stats">
      <div><span>Students</span><strong>{students.length}</strong></div>
      <div><span>Fee records</span><strong>{Object.keys(fees).length}</strong></div>
      <div><span>Attendance records</span><strong>{attendanceRows.length}</strong></div>
      <div><span>Last email backup</span><strong>{settings.lastSentAt ? new Date(settings.lastSentAt).toLocaleDateString('en-IN') : 'Not sent'}</strong></div>
    </section>

    <div className="backup-grid">
      <section className="panel backup-card">
        <div className="backup-icon excel"><FileSpreadsheet size={23} /></div>
        <div><h3>Download Excel</h3><p>Students, fee receipts and attendance in one formatted workbook.</p></div>
        <button className="primary-button" disabled={!admin || busy === 'excel'} onClick={exportExcel}><Download size={15} /> {busy === 'excel' ? 'Creating workbook...' : 'Download .xlsx'}</button>
      </section>
      <section className="panel backup-card">
        <div className="backup-icon json"><FileJson size={23} /></div>
        <div><h3>Full Restore Backup</h3><p>Complete JSON copy including notices, timetable, documents and fee settings.</p></div>
        <button className="secondary-button" disabled={!admin} onClick={exportJson}><Download size={15} /> Download .json</button>
      </section>
      <section className="panel backup-card restore-card">
        <div className="backup-icon restore"><RotateCcw size={23} /></div>
        <div><h3>One-click Restore</h3><p>Validate and restore a Northstar JSON backup. A safety backup downloads first.</p></div>
        <input ref={fileRef} hidden type="file" accept=".json,application/json" onChange={selectRestore} />
        <button className="secondary-button" disabled={!admin || busy === 'restore'} onClick={() => fileRef.current?.click()}><Upload size={15} /> {busy === 'restore' ? 'Restoring...' : 'Choose backup & restore'}</button>
      </section>
    </div>

    <form className="panel email-backup-panel" onSubmit={saveEmail}>
      <div className="email-backup-copy"><div className="backup-icon mail"><Mail size={22} /></div><div><h3>Monthly automatic backup email</h3><p>On the 1st of every month, an Excel backup will be emailed to the configured administrator.</p></div></div>
      <label>Email address<input required type="email" value={emailSettings.email || ''} onChange={event => setEmailSettings({ ...emailSettings, email: event.target.value })} placeholder="admin@school.com" /></label>
      <label className="backup-toggle"><input type="checkbox" checked={Boolean(emailSettings.enabled)} onChange={event => setEmailSettings({ ...emailSettings, enabled: event.target.checked })} /><span>Enable monthly email</span></label>
      <button className="primary-button" disabled={!admin || busy === 'email'}>{busy === 'email' ? <DatabaseBackup size={15} /> : <Check size={15} />} {busy === 'email' ? 'Saving...' : 'Save schedule'}</button>
      <small>Scheduled delivery requires the deployment email credentials to be configured.</small>
    </form>
    {message && <div className="backup-message"><Check size={15} /> {message}</div>}
  </>
}
