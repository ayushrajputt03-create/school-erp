import React, { useState } from 'react'

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0)
}

function SkeletonFees() {
  return <div className="pd-card">
    <div className="pd-card-header">
      <div className="pd-skeleton pd-skeleton-title" style={{ width: 120 }} />
    </div>
    <div className="pd-card-body">
      {[1, 2, 3].map(i => <div key={i} className="pd-skeleton" style={{ height: 54, marginBottom: 8 }} />)}
    </div>
  </div>
}

function PaymentModal({ amount, onClose }) {
  return <div className="pd-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
    <div className="pd-modal">
      <div className="pd-modal-header">
        <span className="pd-modal-title">Pay {formatCurrency(amount)}</span>
        <button className="pd-modal-close" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div className="pd-modal-body">
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
          Choose a payment method to proceed
        </p>

        <button className="pd-payment-option">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
          </svg>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>Online Payment</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>UPI, Debit/Credit Card, Net Banking</div>
          </div>
        </button>

        <button className="pd-payment-option">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>Bank Transfer</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>NEFT / IMPS / RTGS</div>
          </div>
        </button>

        <button className="pd-payment-option">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>Pay at School</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Cash or Cheque at accounts office</div>
          </div>
        </button>
      </div>
    </div>
  </div>
}

export default function FeeWidget({ data = [], loading, error }) {
  const [showPayModal, setShowPayModal] = useState(false)

  if (loading) return <SkeletonFees />

  if (error) {
    return <div className="pd-card">
      <div className="pd-card-body">
        <div className="pd-error">
          <p className="pd-error-text">Failed to load fee data</p>
          <button className="pd-error-retry">Retry</button>
        </div>
      </div>
    </div>
  }

  const unpaid = data.filter(f => f.status !== 'paid')
  const totalDue = unpaid.reduce((sum, f) => sum + (f.amount || 0), 0)

  return <div className="pd-card">
    <div className="pd-card-header">
      <div>
        <div className="pd-card-title">Fee Summary</div>
        <div className="pd-card-subtitle">{data.length} fee items</div>
      </div>
      <button className="pd-card-link">View all receipts</button>
    </div>

    <div className="pd-card-body">
      {data.length === 0
        ? <div className="pd-empty">
            <div className="pd-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <p className="pd-empty-text">All fees paid</p>
          </div>
        : <>
            <div className="pd-fee-list">
              {data.slice(0, 5).map(fee => <div key={fee.id} className="pd-fee-item">
                <div className="pd-fee-item-info">
                  <span className="pd-fee-item-title">{fee.title}</span>
                  <span className="pd-fee-item-due">Due {formatDate(fee.dueDate)}</span>
                </div>
                <div className="pd-fee-item-right">
                  <span className="pd-fee-amount" style={{ color: fee.status === 'paid' ? 'var(--color-accent)' : 'var(--color-text)' }}>
                    {formatCurrency(fee.amount)}
                  </span>
                  <span className={`pd-pill ${fee.status || 'unpaid'}`}>
                    {fee.status === 'paid' ? 'Paid' : fee.status === 'partial' ? 'Partial' : 'Due'}
                  </span>
                </div>
              </div>)}
            </div>

            {totalDue > 0 && <>
              <div className="pd-fee-total">
                <span className="pd-fee-total-label">Total due</span>
                <span className="pd-fee-total-amount">{formatCurrency(totalDue)}</span>
              </div>
              <button className="pd-btn primary" style={{ marginTop: 16 }} onClick={() => setShowPayModal(true)}>
                Pay Now {formatCurrency(totalDue)}
              </button>
            </>}
          </>
      }
    </div>

    {showPayModal && <PaymentModal amount={totalDue} onClose={() => setShowPayModal(false)} />}
  </div>
}
