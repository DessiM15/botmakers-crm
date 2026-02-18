'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import {
  sendViaSquare,
  generatePaymentLink,
  markPaid,
  sendReminder,
} from '@/lib/actions/invoices';
import { INVOICE_STATUSES } from '@/lib/utils/constants';

const STATUS_FLOW = ['draft', 'sent', 'viewed', 'paid'];

const InvoiceDetail = ({ invoice: initialInvoice, squareConfigured = false }) => {
  const router = useRouter();
  const [invoice, setInvoice] = useState(initialInvoice);
  const [actionLoading, setActionLoading] = useState(null);

  const statusConfig = INVOICE_STATUSES.find((s) => s.value === invoice.status) || INVOICE_STATUSES[0];
  const lineItems = invoice.lineItems || [];
  const paymentsList = invoice.payments || [];
  const totalAmount = Number(invoice.amount) || 0;

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount) => {
    return '$' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 });
  };

  const handleSendViaSquare = async () => {
    setActionLoading('send');
    const res = await sendViaSquare(invoice.id);
    setActionLoading(null);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Invoice sent via Square!');
      setInvoice((prev) => ({
        ...prev,
        status: 'sent',
        sentAt: new Date().toISOString(),
      }));
      router.refresh();
    }
  };

  const handleGenerateLink = async () => {
    setActionLoading('link');
    const res = await generatePaymentLink(invoice.id);
    setActionLoading(null);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Payment link generated!');
      setInvoice((prev) => ({
        ...prev,
        squarePaymentUrl: res.paymentUrl,
      }));
      navigator.clipboard.writeText(res.paymentUrl).catch(() => {});
    }
  };

  const handleSendReminder = async () => {
    setActionLoading('reminder');
    const res = await sendReminder(invoice.id);
    setActionLoading(null);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Reminder sent!');
    }
  };

  const handleMarkPaid = async () => {
    if (!window.confirm('Mark this invoice as paid manually?')) return;

    setActionLoading('paid');
    const res = await markPaid(invoice.id);
    setActionLoading(null);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Invoice marked as paid');
      setInvoice((prev) => ({
        ...prev,
        status: 'paid',
        paidAt: new Date().toISOString(),
      }));
      router.refresh();
    }
  };

  const copyPaymentUrl = () => {
    if (invoice.squarePaymentUrl) {
      navigator.clipboard.writeText(invoice.squarePaymentUrl).then(() => {
        toast.success('Payment URL copied!');
      }).catch(() => {
        toast.error('Failed to copy to clipboard');
      });
    }
  };

  return (
    <>
      {/* Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div className="d-flex align-items-center gap-3">
          <Link href="/invoices" className="btn btn-outline-secondary btn-sm">
            <Icon icon="mdi:arrow-left" style={{ fontSize: '18px' }} />
          </Link>
          <div>
            <h4 className="text-white fw-semibold mb-1">{invoice.title}</h4>
            <div className="d-flex align-items-center gap-2">
              <span
                className="badge fw-medium"
                style={{ background: `${statusConfig.color}22`, color: statusConfig.color }}
              >
                {statusConfig.label}
              </span>
              {invoice.squareInvoiceId && (
                <span className="badge bg-info bg-opacity-25 text-info">
                  <Icon icon="mdi:square-rounded" className="me-1" style={{ fontSize: '12px' }} />
                  Square Synced
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="d-flex gap-2 flex-wrap">
          {invoice.status === 'draft' && squareConfigured && (
            <button
              className="btn btn-primary btn-sm d-flex align-items-center gap-1"
              onClick={handleSendViaSquare}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'send' ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <Icon icon="mdi:send" style={{ fontSize: '16px' }} />
              )}
              Send via Square
            </button>
          )}

          {['sent', 'viewed', 'overdue'].includes(invoice.status) && (
            <button
              className="btn btn-outline-info btn-sm d-flex align-items-center gap-1"
              onClick={handleSendReminder}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'reminder' ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <Icon icon="mdi:bell-outline" style={{ fontSize: '16px' }} />
              )}
              Send Reminder
            </button>
          )}

          {squareConfigured && invoice.status !== 'paid' && (
            <button
              className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
              onClick={handleGenerateLink}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'link' ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <Icon icon="mdi:link-variant" style={{ fontSize: '16px' }} />
              )}
              Payment Link
            </button>
          )}

          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <button
              className="btn btn-outline-success btn-sm d-flex align-items-center gap-1"
              onClick={handleMarkPaid}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'paid' ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <Icon icon="mdi:check-circle-outline" style={{ fontSize: '16px' }} />
              )}
              Mark Paid
            </button>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      <div className="card mb-4">
        <div className="card-body py-3">
          <div className="d-flex align-items-center gap-0 overflow-auto">
            {STATUS_FLOW.map((step, idx) => {
              const currentIdx = STATUS_FLOW.indexOf(invoice.status);
              const isActive = idx <= currentIdx || (invoice.status === 'overdue' && idx <= 1);
              return (
                <div key={step} className="d-flex align-items-center flex-shrink-0">
                  <div
                    className="d-flex align-items-center justify-content-center rounded-circle"
                    style={{
                      width: '28px',
                      height: '28px',
                      background: isActive ? '#03FF00' : 'rgba(255,255,255,0.1)',
                    }}
                  >
                    <Icon
                      icon={isActive ? 'mdi:check' : 'mdi:circle-small'}
                      style={{
                        fontSize: isActive ? '16px' : '20px',
                        color: isActive ? '#033457' : '#6c757d',
                      }}
                    />
                  </div>
                  <span
                    className="text-xs ms-1 me-2"
                    style={{ color: isActive ? '#ffffff' : '#6c757d' }}
                  >
                    {step.charAt(0).toUpperCase() + step.slice(1)}
                  </span>
                  {idx < STATUS_FLOW.length - 1 && (
                    <div
                      style={{
                        width: '40px',
                        height: '2px',
                        background: isActive && idx < currentIdx ? '#03FF00' : 'rgba(255,255,255,0.1)',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* Left — Invoice Content */}
        <div className="col-lg-8">
          {/* Invoice Info */}
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="text-white fw-semibold mb-0">Invoice Details</h6>
            </div>
            <div className="card-body">
              <div className="row g-3 mb-3">
                <div className="col-sm-6">
                  <span className="text-secondary-light text-xs d-block mb-1">Client</span>
                  {invoice.clientId ? (
                    <Link
                      href={`/clients/${invoice.clientId}`}
                      className="text-white text-decoration-none text-sm"
                    >
                      {invoice.clientName || 'Unknown'}
                      {invoice.clientCompany && (
                        <span className="text-secondary-light"> ({invoice.clientCompany})</span>
                      )}
                    </Link>
                  ) : (
                    <span className="text-white text-sm">—</span>
                  )}
                </div>
                <div className="col-sm-6">
                  <span className="text-secondary-light text-xs d-block mb-1">Project</span>
                  {invoice.projectId ? (
                    <Link
                      href={`/projects/${invoice.projectId}`}
                      className="text-white text-decoration-none text-sm"
                    >
                      {invoice.projectName || 'Unknown'}
                    </Link>
                  ) : (
                    <span className="text-secondary-light text-sm">—</span>
                  )}
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-sm-4">
                  <span className="text-secondary-light text-xs d-block mb-1">Due Date</span>
                  <span className="text-white text-sm">{formatDate(invoice.dueDate)}</span>
                </div>
                <div className="col-sm-4">
                  <span className="text-secondary-light text-xs d-block mb-1">Sent</span>
                  <span className="text-white text-sm">{formatDateTime(invoice.sentAt)}</span>
                </div>
                <div className="col-sm-4">
                  <span className="text-secondary-light text-xs d-block mb-1">Paid</span>
                  <span className="text-white text-sm">{formatDateTime(invoice.paidAt)}</span>
                </div>
              </div>

              {invoice.description && (
                <div className="mb-0">
                  <span className="text-secondary-light text-xs d-block mb-1">Description</span>
                  <p className="text-white text-sm mb-0">{invoice.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="text-white fw-semibold mb-0">Line Items</h6>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-dark mb-0">
                  <thead>
                    <tr className="text-secondary-light text-xs">
                      <th>Description</th>
                      <th style={{ width: '100px' }}>Qty</th>
                      <th style={{ width: '120px' }}>Unit Price</th>
                      <th style={{ width: '120px' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center text-secondary-light py-4">
                          No line items
                        </td>
                      </tr>
                    ) : (
                      lineItems.map((item) => (
                        <tr key={item.id}>
                          <td className="text-white text-sm">{item.description}</td>
                          <td className="text-white text-sm">{Number(item.quantity)}</td>
                          <td className="text-white text-sm">{formatCurrency(item.unitPrice)}</td>
                          <td className="text-white text-sm fw-medium">
                            {formatCurrency(item.total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="3" className="text-end text-white fw-semibold">
                        Total:
                      </td>
                      <td className="fw-bold" style={{ color: '#03FF00' }}>
                        {formatCurrency(totalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Payment History */}
          <div className="card">
            <div className="card-header">
              <h6 className="text-white fw-semibold mb-0">Payment History</h6>
            </div>
            <div className="card-body p-0">
              {paymentsList.length === 0 ? (
                <div className="d-flex flex-column align-items-center py-4">
                  <Icon
                    icon="mdi:cash-off"
                    className="text-secondary-light mb-1"
                    style={{ fontSize: '28px' }}
                  />
                  <span className="text-secondary-light text-sm">No payments recorded</span>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-dark mb-0">
                    <thead>
                      <tr className="text-secondary-light text-xs">
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Square Payment ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentsList.map((payment) => (
                        <tr key={payment.id}>
                          <td className="text-white text-sm">{formatDateTime(payment.paidAt)}</td>
                          <td className="text-white text-sm fw-medium">
                            {formatCurrency(payment.amount)}
                          </td>
                          <td>
                            <span className="badge bg-secondary bg-opacity-25 text-secondary-light">
                              {payment.method.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="text-secondary-light text-xs">
                            {payment.squarePaymentId || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right — Sidebar */}
        <div className="col-lg-4">
          {/* Square Status */}
          <div className="card mb-3">
            <div className="card-header">
              <h6 className="text-white fw-semibold mb-0">Square Integration</h6>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <span className="text-secondary-light text-xs d-block mb-1">Sync Status</span>
                {invoice.squareInvoiceId ? (
                  <span className="badge bg-success bg-opacity-25 text-success">
                    <Icon icon="mdi:check-circle" className="me-1" style={{ fontSize: '14px' }} />
                    Synced
                  </span>
                ) : (
                  <span className="badge bg-secondary bg-opacity-25 text-secondary-light">
                    Not Synced
                  </span>
                )}
              </div>

              {invoice.squareInvoiceId && (
                <div className="mb-3">
                  <span className="text-secondary-light text-xs d-block mb-1">Square Invoice ID</span>
                  <span className="text-white text-xs" style={{ wordBreak: 'break-all' }}>
                    {invoice.squareInvoiceId}
                  </span>
                </div>
              )}

              {invoice.squarePaymentUrl && (
                <div>
                  <span className="text-secondary-light text-xs d-block mb-1">Payment URL</span>
                  <div className="input-group input-group-sm">
                    <input
                      type="text"
                      className="form-control form-control-sm bg-base text-white"
                      readOnly
                      value={invoice.squarePaymentUrl}
                    />
                    <button
                      className="btn btn-outline-secondary"
                      onClick={copyPaymentUrl}
                    >
                      <Icon icon="mdi:content-copy" style={{ fontSize: '14px' }} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="card">
            <div className="card-header">
              <h6 className="text-white fw-semibold mb-0">Details</h6>
            </div>
            <div className="card-body">
              <div className="mb-2">
                <span className="text-secondary-light text-xs d-block mb-1">Created By</span>
                <span className="text-white text-sm">{invoice.createdByName || '—'}</span>
              </div>
              <div className="mb-2">
                <span className="text-secondary-light text-xs d-block mb-1">Created</span>
                <span className="text-white text-sm">{formatDateTime(invoice.createdAt)}</span>
              </div>
              <div>
                <span className="text-secondary-light text-xs d-block mb-1">Last Updated</span>
                <span className="text-white text-sm">{formatDateTime(invoice.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default InvoiceDetail;
