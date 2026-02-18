'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { createInvoice, sendViaSquare, generatePaymentLink } from '@/lib/actions/invoices';

const InvoiceForm = ({
  clients = [],
  preselectedClientId = null,
  preselectedProjectId = null,
  preselectedMilestoneTitle = null,
  preselectedAmount = null,
  squareConfigured = false,
}) => {
  const router = useRouter();

  const [clientId, setClientId] = useState(preselectedClientId || '');
  const [projectId, setProjectId] = useState(preselectedProjectId || '');
  const [title, setTitle] = useState(
    preselectedMilestoneTitle ? `Invoice: ${preselectedMilestoneTitle}` : ''
  );
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(null);
  const [lineItems, setLineItems] = useState([
    {
      description: preselectedMilestoneTitle || '',
      quantity: 1,
      unitPrice: preselectedAmount ? Number(preselectedAmount) : 0,
      total: preselectedAmount ? Number(preselectedAmount) : 0,
    },
  ]);

  const [clientProjects, setClientProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingSquare, setSendingSquare] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  // Calculate total
  const grandTotal = useMemo(
    () => lineItems.reduce((sum, item) => sum + Number(item.total || 0), 0),
    [lineItems]
  );

  // Fetch projects when client changes
  useEffect(() => {
    if (!clientId) {
      setClientProjects([]);
      if (!preselectedProjectId) setProjectId('');
      return;
    }

    setLoadingProjects(true);
    fetch(`/api/invoices/client-projects?clientId=${clientId}`)
      .then((res) => res.json())
      .then((data) => {
        setClientProjects(data.projects || []);
        setLoadingProjects(false);
      })
      .catch(() => {
        toast.error('Failed to load projects for this client');
        setClientProjects([]);
        setLoadingProjects(false);
      });
  }, [clientId, preselectedProjectId]);

  const updateLineItem = (idx, field, value) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      // Recalculate total when quantity or unit price changes
      if (field === 'quantity' || field === 'unitPrice') {
        updated[idx].total = Number(updated[idx].quantity) * Number(updated[idx].unitPrice);
      }
      return updated;
    });
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { description: '', quantity: 1, unitPrice: 0, total: 0 },
    ]);
  };

  const removeLineItem = (idx) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const buildFormData = () => ({
    clientId,
    projectId: projectId || undefined,
    title,
    description: description || undefined,
    dueDate: dueDate ? dueDate.toISOString().split('T')[0] : undefined,
    lineItems: lineItems.map((item, idx) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
      sortOrder: idx,
    })),
  });

  const validate = () => {
    if (!clientId) {
      toast.error('Please select a client');
      return false;
    }
    if (!title.trim()) {
      toast.error('Please enter a title');
      return false;
    }
    if (lineItems.some((item) => !item.description.trim())) {
      toast.error('All line items need a description');
      return false;
    }
    if (grandTotal <= 0) {
      toast.error('Invoice total must be greater than $0');
      return false;
    }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!validate()) return;

    setSaving(true);
    const res = await createInvoice(buildFormData());
    setSaving(false);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Invoice saved as draft');
      router.push(`/invoices/${res.invoice.id}`);
    }
  };

  const handleSendViaSquare = async () => {
    if (!validate()) return;

    setSendingSquare(true);
    // First create the invoice
    const createRes = await createInvoice(buildFormData());
    if (createRes?.error) {
      toast.error(createRes.error);
      setSendingSquare(false);
      return;
    }

    // Then send via Square
    const sendRes = await sendViaSquare(createRes.invoice.id);
    setSendingSquare(false);

    if (sendRes?.error) {
      toast.error(sendRes.error);
      // Still redirect to invoice detail since it was created
      router.push(`/invoices/${createRes.invoice.id}`);
    } else {
      toast.success('Invoice created and sent via Square!');
      router.push(`/invoices/${createRes.invoice.id}`);
    }
  };

  const handleGenerateLink = async () => {
    if (!validate()) return;

    setGeneratingLink(true);
    const createRes = await createInvoice(buildFormData());
    if (createRes?.error) {
      toast.error(createRes.error);
      setGeneratingLink(false);
      return;
    }

    const linkRes = await generatePaymentLink(createRes.invoice.id);
    setGeneratingLink(false);

    if (linkRes?.error) {
      toast.error(linkRes.error);
      router.push(`/invoices/${createRes.invoice.id}`);
    } else {
      toast.success('Payment link generated!');
      router.push(`/invoices/${createRes.invoice.id}`);
    }
  };

  const isDisabled = saving || sendingSquare || generatingLink;

  return (
    <>
      {/* Header */}
      <div className="d-flex align-items-center gap-3 mb-4">
        <Link href="/invoices" className="btn btn-outline-secondary btn-sm">
          <Icon icon="mdi:arrow-left" style={{ fontSize: '18px' }} />
        </Link>
        <h4 className="text-white fw-semibold mb-0">Create Invoice</h4>
      </div>

      <div className="row g-4">
        {/* Left — Form */}
        <div className="col-lg-8">
          <div className="card">
            <div className="card-body">
              {/* Client + Project */}
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label text-white text-sm">Client *</label>
                  <select
                    className="form-select bg-base text-white"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    disabled={isDisabled}
                  >
                    <option value="">Select client...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName}{c.company ? ` (${c.company})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label text-white text-sm">Project (optional)</label>
                  <select
                    className="form-select bg-base text-white"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    disabled={isDisabled || !clientId || loadingProjects}
                  >
                    <option value="">
                      {loadingProjects ? 'Loading...' : 'Select project...'}
                    </option>
                    {clientProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title + Due Date */}
              <div className="row g-3 mb-3">
                <div className="col-md-8">
                  <label className="form-label text-white text-sm">Title *</label>
                  <input
                    type="text"
                    className="form-control bg-base text-white"
                    placeholder="Invoice title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isDisabled}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label text-white text-sm">Due Date</label>
                  <DatePicker
                    selected={dueDate}
                    onChange={(date) => setDueDate(date)}
                    className="form-control bg-base text-white"
                    placeholderText="Select due date..."
                    dateFormat="MMM d, yyyy"
                    minDate={new Date()}
                    disabled={isDisabled}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="form-label text-white text-sm">Description (optional)</label>
                <textarea
                  className="form-control bg-base text-white"
                  rows={2}
                  placeholder="Brief description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isDisabled}
                />
              </div>

              {/* Line Items */}
              <div className="mb-3">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <label className="form-label text-white text-sm mb-0">Line Items</label>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={addLineItem}
                    disabled={isDisabled}
                  >
                    <Icon icon="mdi:plus" className="me-1" style={{ fontSize: '14px' }} />
                    Add Row
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="table table-dark mb-0">
                    <thead>
                      <tr className="text-secondary-light text-xs">
                        <th style={{ width: '40%' }}>Description</th>
                        <th style={{ width: '15%' }}>Qty</th>
                        <th style={{ width: '20%' }}>Unit Price</th>
                        <th style={{ width: '20%' }}>Total</th>
                        <th style={{ width: '5%' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <input
                              type="text"
                              className="form-control form-control-sm bg-base text-white"
                              placeholder="Item description..."
                              value={item.description}
                              onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                              disabled={isDisabled}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="form-control form-control-sm bg-base text-white"
                              min="1"
                              step="1"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)}
                              disabled={isDisabled}
                            />
                          </td>
                          <td>
                            <div className="input-group input-group-sm">
                              <span className="input-group-text bg-base text-secondary-light border-secondary-subtle">$</span>
                              <input
                                type="number"
                                className="form-control bg-base text-white"
                                min="0"
                                step="0.01"
                                value={item.unitPrice}
                                onChange={(e) => updateLineItem(idx, 'unitPrice', e.target.value)}
                                disabled={isDisabled}
                              />
                            </div>
                          </td>
                          <td>
                            <span className="text-white text-sm fw-medium d-block py-1">
                              ${Number(item.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td>
                            {lineItems.length > 1 && (
                              <button
                                type="button"
                                className="btn btn-sm p-1 text-danger"
                                onClick={() => removeLineItem(idx)}
                                disabled={isDisabled}
                              >
                                <Icon icon="mdi:close" style={{ fontSize: '16px' }} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="3" className="text-end text-white fw-semibold">
                          Total:
                        </td>
                        <td className="text-white fw-semibold" style={{ color: '#03FF00' }}>
                          ${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right — Actions */}
        <div className="col-lg-4">
          <div className="card">
            <div className="card-header">
              <h6 className="text-white fw-semibold mb-0">Actions</h6>
            </div>
            <div className="card-body d-flex flex-column gap-3">
              <button
                className="btn btn-outline-secondary w-100 d-flex align-items-center justify-content-center gap-2"
                onClick={handleSaveDraft}
                disabled={isDisabled}
              >
                {saving ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <Icon icon="mdi:content-save-outline" style={{ fontSize: '18px' }} />
                )}
                Save Draft
              </button>

              {squareConfigured && (
                <>
                  <button
                    className="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2"
                    onClick={handleSendViaSquare}
                    disabled={isDisabled}
                  >
                    {sendingSquare ? (
                      <span className="spinner-border spinner-border-sm" />
                    ) : (
                      <Icon icon="mdi:send" style={{ fontSize: '18px' }} />
                    )}
                    Send via Square
                  </button>

                  <button
                    className="btn btn-outline-info w-100 d-flex align-items-center justify-content-center gap-2"
                    onClick={handleGenerateLink}
                    disabled={isDisabled}
                  >
                    {generatingLink ? (
                      <span className="spinner-border spinner-border-sm" />
                    ) : (
                      <Icon icon="mdi:link-variant" style={{ fontSize: '18px' }} />
                    )}
                    Generate Payment Link
                  </button>
                </>
              )}

              {!squareConfigured && (
                <div className="p-3 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-secondary-light text-xs mb-0">
                    <Icon icon="mdi:information-outline" className="me-1" style={{ fontSize: '14px' }} />
                    Configure Square in Settings to enable direct invoice sending and payment links.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Total Summary */}
          <div className="card mt-3">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-secondary-light text-sm">Grand Total</span>
                <span className="text-white fw-bold" style={{ fontSize: '20px' }}>
                  ${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default InvoiceForm;
