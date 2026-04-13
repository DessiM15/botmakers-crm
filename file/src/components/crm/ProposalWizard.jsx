'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import { createProposal, updateProposal } from '@/lib/actions/proposals';
import { sanitizeHtml } from '@/lib/utils/sanitize';
import { printProposal } from '@/lib/utils/proposal-print';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

const DEFAULT_TERMS = `<h3>Terms &amp; Conditions</h3>
<ul>
  <li><strong>Payment:</strong> 50% deposit required before work begins. Remaining 50% due upon project completion. Net 15 terms on all invoices.</li>
  <li><strong>Timeline:</strong> Project timeline begins upon receipt of deposit and all required assets/access.</li>
  <li><strong>Revisions:</strong> Up to 2 rounds of revisions are included. Additional revisions billed at hourly rate.</li>
  <li><strong>IP Ownership:</strong> Upon full payment, all custom code and deliverables transfer to the client. Third-party licenses remain subject to their respective terms.</li>
  <li><strong>Confidentiality:</strong> Both parties agree to keep project details and proprietary information confidential.</li>
  <li><strong>Cancellation:</strong> Either party may cancel with 14 days written notice. Client is responsible for work completed to date.</li>
</ul>`;

const STEPS = [
  { key: 'context', label: 'Context', icon: 'mdi:information-outline' },
  { key: 'edit', label: 'Edit', icon: 'mdi:pencil-outline' },
  { key: 'preview', label: 'Preview', icon: 'mdi:eye-outline' },
];

const ProposalWizard = ({ leads = [], clients = [], preselectedLeadId = null, editProposal = null, reviseProposal = null }) => {
  const router = useRouter();
  const isEditMode = !!editProposal;
  // reviseProposal pre-fills fields but creates a NEW proposal
  const prefill = editProposal || reviseProposal;

  // Start at step 1 (Edit) when editing or revising an existing proposal
  const [step, setStep] = useState(prefill ? 1 : 0);

  // Step 1: Context
  const [entityType, setEntityType] = useState(
    prefill
      ? (prefill.clientId ? 'client' : 'lead')
      : (preselectedLeadId ? 'lead' : 'lead')
  );
  const [selectedLeadId, setSelectedLeadId] = useState(
    prefill ? (prefill.leadId || '') : (preselectedLeadId || '')
  );
  const [selectedClientId, setSelectedClientId] = useState(
    prefill ? (prefill.clientId || '') : ''
  );
  const [discoveryNotes, setDiscoveryNotes] = useState('');
  const [pricingType, setPricingType] = useState(
    prefill ? (prefill.pricingType || 'fixed') : 'fixed'
  );
  const [aiGenerating, setAiGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Step 2: Edit — initialize from prefill if available
  const [title, setTitle] = useState(
    reviseProposal ? `${reviseProposal.title} (Revised)` : (prefill?.title || '')
  );
  const [scopeOfWork, setScopeOfWork] = useState(prefill ? (prefill.scopeOfWork || '') : '');
  const [deliverables, setDeliverables] = useState(prefill ? (prefill.deliverables || '') : '');
  const [termsAndConditions, setTermsAndConditions] = useState(
    prefill ? (prefill.termsAndConditions || DEFAULT_TERMS) : DEFAULT_TERMS
  );
  const [lineItems, setLineItems] = useState(() => {
    if (prefill && prefill.lineItems?.length > 0) {
      return prefill.lineItems.map((item) => ({
        description: item.description || '',
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice) || 0,
        total: Number(item.total) || 0,
        phaseLabel: item.phaseLabel || '',
      }));
    }
    return [{ description: '', quantity: 1, unitPrice: 0, total: 0, phaseLabel: '' }];
  });
  const [aiGenerated, setAiGenerated] = useState(prefill ? (prefill.aiGenerated || false) : false);

  // Saving
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // Track if auto-generate has been triggered
  const [autoGenerateTriggered, setAutoGenerateTriggered] = useState(!!prefill);

  // Pre-populate discovery notes from AI analysis when lead is selected
  const handleLeadSelect = useCallback((leadId) => {
    setSelectedLeadId(leadId);
    setSelectedClientId('');
    if (leadId) {
      const lead = leads.find((l) => l.id === leadId);
      if (lead) {
        const parts = [];

        if (lead.discoveryCallSummary) {
          const s = lead.discoveryCallSummary;
          if (s.key_points?.length > 0) parts.push(`Key Points:\n${s.key_points.map(p => `- ${p}`).join('\n')}`);
          if (s.client_needs?.length > 0) parts.push(`Client Needs:\n${s.client_needs.map(n => `- ${n}`).join('\n')}`);
          if (s.technical_requirements?.length > 0) parts.push(`Technical Requirements: ${s.technical_requirements.join(', ')}`);
          if (s.budget) parts.push(`Budget: ${s.budget}`);
          if (s.timeline) parts.push(`Timeline: ${s.timeline}`);
          if (s.decisions?.length > 0) parts.push(`Decisions:\n${s.decisions.map(d => `- ${d}`).join('\n')}`);
          if (s.action_items?.length > 0) parts.push(`Action Items:\n${s.action_items.map(a => `- ${a}`).join('\n')}`);
        }

        if (lead.projectDetails) parts.push(`Project Details:\n${lead.projectDetails}`);
        if (lead.projectType) parts.push(`Project Type: ${lead.projectType}`);
        if (lead.notes) parts.push(`Notes:\n${lead.notes}`);
        if (lead.aiProspectSummary) parts.push(`AI Summary:\n${lead.aiProspectSummary}`);
        if (parts.length > 0 && !discoveryNotes.trim()) {
          setDiscoveryNotes(parts.join('\n\n'));
        }
      }
    }
  }, [leads, discoveryNotes]);

  // Pre-select lead on mount + handle discovery proposal data from sessionStorage
  useEffect(() => {
    // Skip all auto-population when editing
    if (isEditMode) return;

    // Check for discovery proposal data passed from DiscoveryCallSection
    let discoveryData = null;
    try {
      const stored = sessionStorage.getItem('discoveryProposalData');
      if (stored) {
        discoveryData = JSON.parse(stored);
        sessionStorage.removeItem('discoveryProposalData');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('[ProposalWizard] Failed to read discovery data from session:', error);
    }

    if (discoveryData && discoveryData.leadId) {
      setSelectedLeadId(discoveryData.leadId);
      if (discoveryData.pricingType) setPricingType(discoveryData.pricingType);
      if (discoveryData.title) setTitle(discoveryData.title);
      if (discoveryData.scope_of_work) setScopeOfWork(discoveryData.scope_of_work);
      if (discoveryData.deliverables) setDeliverables(discoveryData.deliverables);
      if (discoveryData.terms_and_conditions) setTermsAndConditions(discoveryData.terms_and_conditions);
      if (discoveryData.suggested_line_items?.length > 0) {
        setLineItems(
          discoveryData.suggested_line_items.map((item) => ({
            description: item.description || '',
            quantity: item.quantity || 1,
            unitPrice: item.unit_price || 0,
            total: (item.quantity || 1) * (item.unit_price || 0),
            phaseLabel: item.phase_label || '',
          }))
        );
      }
      setAiGenerated(true);
      setAutoGenerateTriggered(true);
      setStep(1);
    } else if (preselectedLeadId) {
      handleLeadSelect(preselectedLeadId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClientSelect = (clientId) => {
    setSelectedClientId(clientId);
    setSelectedLeadId('');
  };

  // Filtered entity list
  const filteredLeads = useMemo(() => {
    if (!searchTerm.trim()) return leads;
    const term = searchTerm.toLowerCase();
    return leads.filter(
      (l) =>
        l.fullName.toLowerCase().includes(term) ||
        l.email.toLowerCase().includes(term) ||
        l.companyName?.toLowerCase().includes(term)
    );
  }, [leads, searchTerm]);

  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return clients;
    const term = searchTerm.toLowerCase();
    return clients.filter(
      (c) =>
        c.fullName.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        c.company?.toLowerCase().includes(term)
    );
  }, [clients, searchTerm]);

  // AI Generation
  const handleGenerate = async () => {
    if (!discoveryNotes.trim()) {
      toast.error('Please enter discovery notes first');
      return;
    }

    setAiGenerating(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000);
      const res = await fetch('/api/ai/generate-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLeadId || undefined,
          clientId: selectedClientId || undefined,
          discoveryNotes,
          pricingType,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const json = await res.json();

      if (json.error) {
        toast.error(json.error);
      } else {
        const p = json.proposal;
        setTitle(p.title || '');
        setScopeOfWork(p.scope_of_work || '');
        setDeliverables(p.deliverables || '');
        if (p.terms_and_conditions) {
          setTermsAndConditions(p.terms_and_conditions);
        }
        if (p.suggested_line_items?.length > 0) {
          setLineItems(
            p.suggested_line_items.map((item, idx) => ({
              description: item.description || '',
              quantity: item.quantity || 1,
              unitPrice: item.unit_price || 0,
              total: (item.quantity || 1) * (item.unit_price || 0),
              phaseLabel: item.phase_label || '',
            }))
          );
        }
        setAiGenerated(true);
        toast.success('Proposal generated! Review and edit below.');
        setStep(1);
      }
    } catch (err) {
      if (err?.name === 'AbortError') {
        toast.error('AI generation timed out. Please try again.');
      } else {
        toast.error('CB-INT-002: AI generation failed');
      }
    } finally {
      setAiGenerating(false);
    }
  };

  // Auto-trigger AI generation when lead is preselected and discovery notes are populated
  const autoGenRef = useRef(false);
  useEffect(() => {
    if (isEditMode) return;
    if (
      preselectedLeadId &&
      discoveryNotes.trim().length > 50 &&
      !autoGenerateTriggered &&
      !autoGenRef.current &&
      !aiGenerating &&
      step === 0
    ) {
      autoGenRef.current = true;
      setAutoGenerateTriggered(true);
      const timer = setTimeout(() => handleGenerate(), 600);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discoveryNotes, preselectedLeadId]);

  // Line items
  const updateLineItem = (index, field, value) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = field === 'quantity' ? value : updated[index].quantity;
        const price = field === 'unitPrice' ? value : updated[index].unitPrice;
        updated[index].total = Number(qty) * Number(price);
      }
      return updated;
    });
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { description: '', quantity: 1, unitPrice: 0, total: 0, phaseLabel: '' },
    ]);
  };

  const removeLineItem = (index) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const totalAmount = useMemo(
    () => lineItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0),
    [lineItems]
  );

  // Save / Send
  const buildFormData = () => ({
    leadId: selectedLeadId || undefined,
    clientId: selectedClientId || undefined,
    title,
    scopeOfWork,
    deliverables,
    termsAndConditions,
    pricingType,
    totalAmount,
    lineItems: lineItems.map((item, idx) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
      sortOrder: idx,
      phaseLabel: item.phaseLabel || undefined,
    })),
    aiGenerated,
    aiPromptContext: aiGenerated ? discoveryNotes : undefined,
  });

  const handleSaveDraft = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    setSaving(true);

    if (isEditMode) {
      const res = await updateProposal(editProposal.id, buildFormData());
      setSaving(false);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success('Proposal updated');
        router.push(`/proposals/${editProposal.id}`);
      }
    } else {
      const res = await createProposal(buildFormData());
      setSaving(false);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success('Proposal saved as draft');
        router.push(`/proposals/${res.proposal.id}`);
      }
    }
  };

  const handleSendToClient = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    if (!selectedClientId && !selectedLeadId) {
      toast.error('Please select a client or lead first');
      return;
    }
    setSending(true);

    let proposalId;

    if (isEditMode) {
      // Update first, then send
      const updateRes = await updateProposal(editProposal.id, buildFormData());
      if (updateRes?.error) {
        toast.error(updateRes.error);
        setSending(false);
        return;
      }
      proposalId = editProposal.id;
    } else {
      // Create first, then send
      const createRes = await createProposal(buildFormData());
      if (createRes?.error) {
        toast.error(createRes.error);
        setSending(false);
        return;
      }
      proposalId = createRes.proposal.id;
    }

    const { sendProposal } = await import('@/lib/actions/proposals');
    const sendRes = await sendProposal(proposalId);
    setSending(false);

    if (sendRes?.error) {
      toast.error(sendRes.error);
      router.push(`/proposals/${proposalId}`);
    } else {
      toast.success('Proposal sent to client!');
      router.push(`/proposals/${proposalId}`);
    }
  };

  // Download PDF
  const handleDownloadPDF = () => {
    const recipientName = selectedLeadId
      ? leads.find((l) => l.id === selectedLeadId)?.fullName
      : selectedClientId
        ? clients.find((c) => c.id === selectedClientId)?.fullName
        : null;

    const ok = printProposal({
      title,
      recipientName,
      scopeOfWork,
      deliverables,
      termsAndConditions,
      lineItems,
      pricingType,
      totalAmount,
    });
    if (!ok) {
      toast.error('Please allow popups to download the PDF');
    }
  };

  const quillModules = useMemo(
    () => ({
      toolbar: [
        [{ header: [3, 4, false] }],
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['clean'],
      ],
    }),
    []
  );

  return (
    <>
      {/* Back Button */}
      <div className="d-flex align-items-center gap-2 mb-4">
        <button
          className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
          onClick={() => router.push(isEditMode ? `/proposals/${editProposal.id}` : '/proposals')}
        >
          <Icon icon="mdi:arrow-left" style={{ fontSize: '16px' }} />
          {isEditMode ? 'Back to Proposal' : 'Proposals'}
        </button>
      </div>

      <h4 className="text-white fw-semibold mb-4">
        {isEditMode ? 'Edit Proposal' : 'New Proposal'}
      </h4>

      {/* Step Indicator */}
      <div className="d-flex align-items-center gap-3 mb-4">
        {STEPS.map((s, idx) => (
          <button
            key={s.key}
            className="btn btn-sm d-flex align-items-center gap-1"
            style={{
              background: step === idx ? '#03FF00' : 'rgba(255,255,255,0.06)',
              color: step === idx ? '#033457' : step > idx ? '#03FF00' : 'rgba(255,255,255,0.5)',
              border: 'none',
              fontWeight: step === idx ? '600' : '400',
              padding: '6px 16px',
            }}
            onClick={() => {
              if (idx < step || (idx === 1 && step === 0)) setStep(idx);
            }}
          >
            <Icon icon={s.icon} style={{ fontSize: '16px' }} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Step 1: Context */}
      {step === 0 && (
        <div className="row g-4">
          <div className="col-xxl-8">
            <div className="card mb-4">
              <div className="card-header">
                <h6 className="text-white fw-semibold mb-0">Select Lead or Client</h6>
              </div>
              <div className="card-body">
                <div className="d-flex gap-2 mb-3">
                  <button
                    className={`btn btn-sm ${entityType === 'lead' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => { setEntityType('lead'); setSelectedClientId(''); }}
                  >
                    Lead
                  </button>
                  <button
                    className={`btn btn-sm ${entityType === 'client' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => { setEntityType('client'); setSelectedLeadId(''); }}
                  >
                    Client
                  </button>
                </div>

                <input
                  type="text"
                  className="form-control bg-base text-white mb-3"
                  placeholder="Search by name, email, or company..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />

                <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                  {entityType === 'lead' ? (
                    filteredLeads.length === 0 ? (
                      <p className="text-secondary-light text-sm mb-0">No leads found.</p>
                    ) : (
                      filteredLeads.map((lead) => (
                        <div
                          key={lead.id}
                          className="d-flex align-items-center gap-3 p-2 rounded cursor-pointer"
                          style={{
                            background: selectedLeadId === lead.id ? 'rgba(3,255,0,0.1)' : 'transparent',
                            border: selectedLeadId === lead.id ? '1px solid rgba(3,255,0,0.3)' : '1px solid transparent',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleLeadSelect(lead.id)}
                        >
                          <Icon
                            icon={selectedLeadId === lead.id ? 'mdi:radiobox-marked' : 'mdi:radiobox-blank'}
                            className={selectedLeadId === lead.id ? 'text-success' : 'text-secondary-light'}
                            style={{ fontSize: '18px', flexShrink: 0 }}
                          />
                          <div className="flex-grow-1 min-w-0">
                            <div className="text-white text-sm fw-medium">{lead.fullName}</div>
                            <div className="text-secondary-light text-xs">
                              {lead.email}
                              {lead.companyName ? ` · ${lead.companyName}` : ''}
                            </div>
                          </div>
                        </div>
                      ))
                    )
                  ) : (
                    filteredClients.length === 0 ? (
                      <p className="text-secondary-light text-sm mb-0">No clients found.</p>
                    ) : (
                      filteredClients.map((client) => (
                        <div
                          key={client.id}
                          className="d-flex align-items-center gap-3 p-2 rounded cursor-pointer"
                          style={{
                            background: selectedClientId === client.id ? 'rgba(3,255,0,0.1)' : 'transparent',
                            border: selectedClientId === client.id ? '1px solid rgba(3,255,0,0.3)' : '1px solid transparent',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleClientSelect(client.id)}
                        >
                          <Icon
                            icon={selectedClientId === client.id ? 'mdi:radiobox-marked' : 'mdi:radiobox-blank'}
                            className={selectedClientId === client.id ? 'text-success' : 'text-secondary-light'}
                            style={{ fontSize: '18px', flexShrink: 0 }}
                          />
                          <div className="flex-grow-1 min-w-0">
                            <div className="text-white text-sm fw-medium">{client.fullName}</div>
                            <div className="text-secondary-light text-xs">
                              {client.email}
                              {client.company ? ` · ${client.company}` : ''}
                            </div>
                          </div>
                        </div>
                      ))
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="card mb-4">
              <div className="card-header">
                <h6 className="text-white fw-semibold mb-0">Discovery Notes</h6>
              </div>
              <div className="card-body">
                <textarea
                  className="form-control bg-base text-white"
                  rows={6}
                  placeholder="Paste meeting notes, requirements, project details, etc..."
                  value={discoveryNotes}
                  onChange={(e) => setDiscoveryNotes(e.target.value)}
                />
                <p className="text-secondary-light text-xs mt-1 mb-0">
                  Include as much detail as possible for better AI results
                </p>
              </div>
            </div>
          </div>

          <div className="col-xxl-4">
            <div className="card mb-4">
              <div className="card-header">
                <h6 className="text-white fw-semibold mb-0">Pricing Type</h6>
              </div>
              <div className="card-body">
                {['fixed', 'phased', 'hourly'].map((type) => (
                  <div
                    key={type}
                    className="d-flex align-items-center gap-2 p-2 rounded mb-1"
                    style={{
                      background: pricingType === type ? 'rgba(3,255,0,0.1)' : 'transparent',
                      cursor: 'pointer',
                    }}
                    onClick={() => setPricingType(type)}
                  >
                    <Icon
                      icon={pricingType === type ? 'mdi:radiobox-marked' : 'mdi:radiobox-blank'}
                      className={pricingType === type ? 'text-success' : 'text-secondary-light'}
                      style={{ fontSize: '18px' }}
                    />
                    <span className="text-white text-sm text-capitalize">{type}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              className="btn w-100 d-flex align-items-center justify-content-center gap-2"
              style={{
                background: '#03FF00',
                color: '#033457',
                fontWeight: '700',
                padding: '14px',
                fontSize: '15px',
              }}
              onClick={handleGenerate}
              disabled={aiGenerating}
            >
              {aiGenerating ? (
                <>
                  <span className="spinner-border spinner-border-sm" />
                  Generating...
                </>
              ) : (
                <>
                  <Icon icon="mdi:robot-outline" style={{ fontSize: '20px' }} />
                  Generate with AI
                </>
              )}
            </button>
            <p className="text-secondary-light text-xs mt-2 text-center">
              Or skip AI and{' '}
              <button
                className="btn btn-link text-primary-light p-0 text-xs"
                onClick={() => setStep(1)}
              >
                write manually
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Step 2: Edit */}
      {step === 1 && (
        <div className="row g-4">
          <div className="col-12">
            <div className="card mb-4">
              <div className="card-header">
                <h6 className="text-white fw-semibold mb-0">Proposal Title</h6>
              </div>
              <div className="card-body">
                <input
                  type="text"
                  className="form-control bg-base text-white"
                  placeholder="Enter proposal title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
            </div>

            <div className="card mb-4">
              <div className="card-header">
                <h6 className="text-white fw-semibold mb-0">Scope of Work</h6>
              </div>
              <div className="card-body">
                <ReactQuill
                  theme="snow"
                  value={scopeOfWork}
                  onChange={setScopeOfWork}
                  modules={quillModules}
                  className="bg-base text-white"
                />
              </div>
            </div>

            <div className="card mb-4">
              <div className="card-header">
                <h6 className="text-white fw-semibold mb-0">Deliverables</h6>
              </div>
              <div className="card-body">
                <ReactQuill
                  theme="snow"
                  value={deliverables}
                  onChange={setDeliverables}
                  modules={quillModules}
                  className="bg-base text-white"
                />
              </div>
            </div>

            <div className="card mb-4">
              <div className="card-header">
                <h6 className="text-white fw-semibold mb-0">Terms & Conditions</h6>
              </div>
              <div className="card-body">
                <ReactQuill
                  theme="snow"
                  value={termsAndConditions}
                  onChange={setTermsAndConditions}
                  modules={quillModules}
                  className="bg-base text-white"
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="card mb-4">
              <div className="card-header d-flex align-items-center justify-content-between">
                <h6 className="text-white fw-semibold mb-0">Line Items</h6>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={addLineItem}
                >
                  <Icon icon="mdi:plus" className="me-1" />
                  Add Item
                </button>
              </div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table table-dark table-borderless mb-0">
                    <thead>
                      <tr className="text-secondary-light text-xs">
                        <th style={{ minWidth: '250px' }}>Description</th>
                        {pricingType === 'phased' && (
                          <th style={{ minWidth: '120px' }}>Phase</th>
                        )}
                        <th style={{ width: '100px' }}>Qty</th>
                        <th style={{ width: '130px' }}>Unit Price</th>
                        <th style={{ width: '130px' }}>Total</th>
                        <th style={{ width: '50px' }}></th>
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
                              onChange={(e) =>
                                updateLineItem(idx, 'description', e.target.value)
                              }
                            />
                          </td>
                          {pricingType === 'phased' && (
                            <td>
                              <input
                                type="text"
                                className="form-control form-control-sm bg-base text-white"
                                placeholder="Phase..."
                                value={item.phaseLabel}
                                onChange={(e) =>
                                  updateLineItem(idx, 'phaseLabel', e.target.value)
                                }
                              />
                            </td>
                          )}
                          <td>
                            <input
                              type="number"
                              className="form-control form-control-sm bg-base text-white"
                              min="0"
                              step="1"
                              value={item.quantity}
                              onChange={(e) =>
                                updateLineItem(idx, 'quantity', Number(e.target.value))
                              }
                            />
                          </td>
                          <td>
                            <div className="input-group input-group-sm">
                              <span className="input-group-text bg-base text-secondary-light border-secondary-subtle">$</span>
                              <input
                                type="number"
                                className="form-control form-control-sm bg-base text-white"
                                min="0"
                                step="0.01"
                                value={item.unitPrice}
                                onChange={(e) =>
                                  updateLineItem(idx, 'unitPrice', Number(e.target.value))
                                }
                              />
                            </div>
                          </td>
                          <td>
                            <span className="text-white text-sm fw-medium">
                              ${Number(item.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td>
                            {lineItems.length > 1 && (
                              <button
                                className="btn btn-sm text-danger p-1"
                                onClick={() => removeLineItem(idx)}
                                title="Remove"
                              >
                                <Icon icon="mdi:close" style={{ fontSize: '16px' }} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="d-flex justify-content-end mt-3 pe-2">
                  <div className="text-end">
                    <span className="text-secondary-light text-sm me-3">Total:</span>
                    <span className="text-white text-lg fw-bold">
                      ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="d-flex justify-content-between">
              <button
                className="btn btn-outline-secondary"
                onClick={() => setStep(0)}
              >
                <Icon icon="mdi:arrow-left" className="me-1" />
                Back to Context
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setStep(2)}
                disabled={!title.trim()}
              >
                Preview
                <Icon icon="mdi:arrow-right" className="ms-1" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 2 && (() => {
        const recipientName = selectedLeadId
          ? leads.find((l) => l.id === selectedLeadId)?.fullName
          : selectedClientId
            ? clients.find((c) => c.id === selectedClientId)?.fullName
            : null;
        const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        return (
          <div className="row g-4">
            <div className="col-xxl-9 mx-auto">
              {/* Branded Proposal Document */}
              <div className="proposal-preview" style={{ borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>

                {/* Header — navy gradient */}
                <div style={{
                  background: 'linear-gradient(135deg, #033457 0%, #022038 100%)',
                  padding: '40px 40px 32px',
                  color: '#fff',
                }}>
                  <div className="d-flex align-items-start justify-content-between mb-4">
                    <div className="d-flex align-items-center gap-3">
                      <img
                        src="https://botmakers.ai/assets/botmakers-white-green-logo.png"
                        alt="BotMakers"
                        style={{ height: '44px', width: 'auto' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <div>
                        <div style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '0.5px' }}>BotMakers Inc.</div>
                        <div style={{ fontSize: '13px', opacity: 0.7 }}>botmakers.ai &nbsp;·&nbsp; 832.790.5001</div>
                      </div>
                    </div>
                    <div className="text-end" style={{ fontSize: '13px', opacity: 0.7 }}>
                      <div>{today}</div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', margin: '0 0 24px' }} />

                  <h2 style={{ fontSize: '28px', fontWeight: '800', margin: '0 0 8px', lineHeight: 1.2, wordWrap: 'break-word' }}>{title}</h2>
                  {recipientName && (
                    <div style={{ fontSize: '15px', opacity: 0.8 }}>Prepared for: <strong style={{ opacity: 1, color: '#fff' }}>{recipientName}</strong></div>
                  )}
                </div>

                {/* Body — white background */}
                <div style={{ background: '#ffffff', padding: '36px 40px', color: '#333', minWidth: 0, overflow: 'hidden' }}>

                  {/* Scope of Work */}
                  <div style={{ marginBottom: '32px' }}>
                    <h5 style={{
                      color: '#033457', fontWeight: '600', fontSize: '17px', marginBottom: '16px',
                      paddingLeft: '14px', borderLeft: '3px solid #03FF00',
                    }}>Scope of Work</h5>
                    <div
                      className="proposal-content proposal-preview-content"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(scopeOfWork) }}
                    />
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid #e9ecef', margin: '0 0 32px' }} />

                  {/* Deliverables */}
                  <div style={{ marginBottom: '32px' }}>
                    <h5 style={{
                      color: '#033457', fontWeight: '600', fontSize: '17px', marginBottom: '16px',
                      paddingLeft: '14px', borderLeft: '3px solid #03FF00',
                    }}>Deliverables</h5>
                    <div
                      className="proposal-content proposal-preview-content"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(deliverables) }}
                    />
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid #e9ecef', margin: '0 0 32px' }} />

                  {/* Pricing */}
                  <div style={{ marginBottom: '32px' }}>
                    <h5 style={{
                      color: '#033457', fontWeight: '600', fontSize: '17px', marginBottom: '16px',
                      paddingLeft: '14px', borderLeft: '3px solid #03FF00',
                    }}>Pricing</h5>
                    <div className="table-responsive">
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f8f9fa' }}>
                            <th style={{ padding: '10px 14px', fontSize: '13px', fontWeight: '600', color: '#033457', textAlign: 'left', borderBottom: '2px solid #e9ecef' }}>Description</th>
                            {pricingType === 'phased' && (
                              <th style={{ padding: '10px 14px', fontSize: '13px', fontWeight: '600', color: '#033457', textAlign: 'left', borderBottom: '2px solid #e9ecef' }}>Phase</th>
                            )}
                            <th style={{ padding: '10px 14px', fontSize: '13px', fontWeight: '600', color: '#033457', textAlign: 'right', width: '80px', borderBottom: '2px solid #e9ecef' }}>Qty</th>
                            <th style={{ padding: '10px 14px', fontSize: '13px', fontWeight: '600', color: '#033457', textAlign: 'right', width: '120px', borderBottom: '2px solid #e9ecef' }}>Unit Price</th>
                            <th style={{ padding: '10px 14px', fontSize: '13px', fontWeight: '600', color: '#033457', textAlign: 'right', width: '120px', borderBottom: '2px solid #e9ecef' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ padding: '10px 14px', fontSize: '14px', color: '#333' }}>{item.description}</td>
                              {pricingType === 'phased' && (
                                <td style={{ padding: '10px 14px', fontSize: '14px', color: '#666' }}>{item.phaseLabel}</td>
                              )}
                              <td style={{ padding: '10px 14px', fontSize: '14px', color: '#333', textAlign: 'right' }}>{item.quantity}</td>
                              <td style={{ padding: '10px 14px', fontSize: '14px', color: '#333', textAlign: 'right' }}>
                                ${Number(item.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ padding: '10px 14px', fontSize: '14px', color: '#333', textAlign: 'right', fontWeight: '500' }}>
                                ${Number(item.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#03FF00' }}>
                            <td
                              colSpan={pricingType === 'phased' ? 4 : 3}
                              style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', fontSize: '15px', color: '#033457' }}
                            >
                              Total
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '800', fontSize: '18px', color: '#033457' }}>
                              ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid #e9ecef', margin: '0 0 32px' }} />

                  {/* Terms */}
                  <div>
                    <h5 style={{
                      color: '#033457', fontWeight: '600', fontSize: '17px', marginBottom: '16px',
                      paddingLeft: '14px', borderLeft: '3px solid #03FF00',
                    }}>Terms &amp; Conditions</h5>
                    <div
                      className="proposal-content proposal-preview-content"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(termsAndConditions) }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div style={{
                  background: '#f5f5f5', padding: '20px 40px', textAlign: 'center',
                  fontSize: '13px', color: '#888', borderTop: '1px solid #e9ecef',
                }}>
                  <div>&copy; {new Date().getFullYear()} BotMakers Inc.</div>
                  <div>832.790.5001 &nbsp;|&nbsp; botmakers.ai &nbsp;|&nbsp; Houston, TX</div>
                </div>
              </div>

              {/* Actions — outside document, in admin dark theme */}
              <div className="d-flex flex-wrap justify-content-between gap-2 mt-4">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setStep(1)}
                >
                  <Icon icon="mdi:arrow-left" className="me-1" />
                  Back to Edit
                </button>
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-outline-info"
                    onClick={handleDownloadPDF}
                  >
                    <Icon icon="mdi:download" className="me-1" />
                    Download PDF
                  </button>
                  <button
                    className="btn btn-outline-primary"
                    onClick={handleSaveDraft}
                    disabled={saving || sending}
                  >
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Icon icon="mdi:content-save-outline" className="me-1" />
                        {isEditMode ? 'Save Changes' : 'Save Draft'}
                      </>
                    )}
                  </button>
                  <button
                    className="btn btn-success"
                    onClick={handleSendToClient}
                    disabled={saving || sending || (!selectedClientId && !selectedLeadId)}
                    title={!selectedClientId && !selectedLeadId ? 'Select a client or lead first' : ''}
                  >
                    {sending ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Icon icon="mdi:send" className="me-1" />
                        Send to Client
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
};

export default ProposalWizard;
