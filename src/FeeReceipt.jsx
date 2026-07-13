import React from 'react'
import { createPortal } from 'react-dom'
import { Printer, X } from 'lucide-react'
import { safePrint } from './print-utils'
import './FeeReceipt.css'

const money = value => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(Number(value || 0))

const formatDate = value => {
  const date = value ? new Date(value) : new Date()
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

const numberToWords = value => {
  const number = Math.round(Number(value || 0))
  if (number === 0) return 'Zero Rupees Only'

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const underHundred = amount => amount < 20
    ? ones[amount]
    : `${tens[Math.floor(amount / 10)]}${amount % 10 ? ` ${ones[amount % 10]}` : ''}`
  const underThousand = amount => {
    const hundreds = Math.floor(amount / 100)
    const rest = amount % 100
    return `${hundreds ? `${ones[hundreds]} Hundred` : ''}${hundreds && rest ? ' ' : ''}${rest ? underHundred(rest) : ''}`
  }

  let remaining = number
  const parts = []
  const units = [
    ['Crore', 10000000],
    ['Lakh', 100000],
    ['Thousand', 1000],
  ]
  units.forEach(([label, divisor]) => {
    const amount = Math.floor(remaining / divisor)
    if (amount) {
      parts.push(`${underThousand(amount)} ${label}`)
      remaining %= divisor
    }
  })
  if (remaining) parts.push(underThousand(remaining))
  return `${parts.join(' ')} Rupees Only`
}

export default function FeeReceipt({ receipt, student, school, settings = {}, onClose }) {
  const schoolName = school?.schoolName || school?.name || 'NXT School ERP'
  const feeItems = receipt.feeItems?.length
    ? receipt.feeItems
    : [{ head: 'Fee Payment', due: receipt.totalDue || receipt.amount, discount: receipt.discount || 0, total: receipt.totalDue || receipt.amount }]
  const paymentModes = receipt.payments?.length
    ? receipt.payments.map(payment => payment.type).join(' / ')
    : receipt.method || 'CASH'
  const transactionIds = (receipt.payments || [])
    .map(payment => payment.transactionId)
    .filter(Boolean)
    .join(', ')
  const paidAmount = Number(receipt.amount || receipt.paidAmount || 0)
  const totalAmount = Number(receipt.totalDue || feeItems.reduce((sum, item) => sum + Number(item.total || item.due || 0), 0))
  const totalDiscount = Number(receipt.discount || feeItems.reduce((sum, item) => sum + Number(item.discount || 0), 0))
  const balance = Number(receipt.balance || 0)
  const paymentYear = new Date(receipt.receiptDate || receipt.paidAt || Date.now()).getFullYear()

  return createPortal(<div className="fee-receipt-overlay" role="dialog" aria-modal="true" aria-label="Fee receipt">
    <div className="fee-receipt-shell">
      <div className="fee-receipt-toolbar">
        <div>
          <strong>Fee Receipt</strong>
          <span>{receipt.receiptNumber || receipt.invoiceNumber}</span>
        </div>
        <div>
          <button className="secondary-button" type="button" onClick={onClose}><X size={16} /> Close</button>
          <button className="primary-button" type="button" onClick={() => safePrint('#printable-fee-receipt', { pageSize: 'A5', pageMargin: '8mm' })}><Printer size={16} /> Print Receipt</button>
        </div>
      </div>

      <article className="fee-receipt-paper" id="printable-fee-receipt">
        <header className="fee-receipt-header">
          <div className="fee-receipt-logo">
            {school?.logo
              ? <img src={school.logo} alt={`${schoolName} logo`} />
              : <span>{schoolName.slice(0, 2).toUpperCase()}</span>}
          </div>
          <div className="fee-receipt-school">
            <h1>{schoolName}</h1>
            {settings.showAddress !== false && <p>{school?.address || 'School address'}</p>}
            <p>{[school?.phone, school?.email].filter(Boolean).join(' | ') || 'Phone and email'}</p>
          </div>
          <div className="fee-receipt-copy">ORIGINAL</div>
        </header>

        <h2>FEE RECEIPT</h2>

        <div className="fee-receipt-meta">
          <p><span>Receipt No.</span><strong>{receipt.receiptNumber || receipt.invoiceNumber || 'Auto generated'}</strong></p>
          <p><span>Date</span><strong>{formatDate(receipt.receiptDate || receipt.paidAt)}</strong></p>
        </div>

        <section className="fee-receipt-student">
          <dl>
            <div><dt>Student Name</dt><dd>{receipt.studentName || student?.name || '-'}</dd></div>
            <div><dt>Admission No.</dt><dd>{receipt.admissionNumber || student?.roll || '-'}</dd></div>
            <div><dt>Class & Section</dt><dd>{receipt.className || student?.className || '-'}</dd></div>
            <div><dt>Father Name</dt><dd>{receipt.fatherName || student?.fatherName || student?.guardian || '-'}</dd></div>
            <div><dt>Phone</dt><dd>{receipt.phone || student?.phone || '-'}</dd></div>
          </dl>
        </section>

        <table className="fee-receipt-table">
          <thead><tr><th>Fee Head</th><th>Amount</th><th>Discount</th><th>Net Amount</th></tr></thead>
          <tbody>
            {feeItems.map((item, index) => {
              const amount = Number(item.due || 0) + Number(item.previous || 0)
              const net = Number(item.total ?? Math.max(0, amount - Number(item.discount || 0)))
              return <tr key={`${item.head}-${index}`}>
                <td>{item.head || 'Fee Payment'}</td>
                <td>{money(amount || net)}</td>
                <td>{money(item.discount)}</td>
                <td>{money(net)}</td>
              </tr>
            })}
          </tbody>
          <tfoot>
            <tr><th>Total</th><td>{money(totalAmount + totalDiscount)}</td><td>{money(totalDiscount)}</td><td>{money(totalAmount)}</td></tr>
            <tr><th colSpan="3">Amount Paid</th><td>{money(paidAmount)}</td></tr>
            <tr className={balance > 0 ? 'has-balance' : ''}><th colSpan="3">Balance Due</th><td>{money(balance)}</td></tr>
          </tfoot>
        </table>

        <section className="fee-receipt-payment">
          <div><span>Payment Mode</span><strong>{paymentModes}</strong></div>
          <div><span>Transaction ID</span><strong>{transactionIds || 'Not applicable'}</strong></div>
          <div><span>Payment Month</span><strong>{receipt.billingMonth ? `${receipt.billingMonth} ${paymentYear}` : '-'}</strong></div>
        </section>

        <div className="fee-receipt-words">
          <span>Amount in Words</span>
          <strong>{numberToWords(paidAmount)}</strong>
        </div>

        {receipt.remark && <p className="fee-receipt-remark"><strong>Remark:</strong> {receipt.remark}</p>}

        <section className="fee-receipt-signatures">
          {['Prepared By', 'Cashier Sign', 'Principal Sign'].map(label => <div key={label}>
            <span />
            <strong>{label}</strong>
            <small>(Name & Signature)</small>
          </div>)}
        </section>

        <footer>
          <p>This is a computer generated receipt.</p>
          <strong>{schoolName}</strong>
          <span>{[school?.phone, school?.website].filter(Boolean).join(' | ')}</span>
          {settings.footer && <small>{settings.footer}</small>}
        </footer>
      </article>
    </div>
  </div>, document.body)
}
