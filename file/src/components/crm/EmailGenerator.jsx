'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { toast } from 'react-toastify';
import { getRecipients, sendEmailFromCRM, saveDraft, getDrafts, loadDraft, deleteDraft, markDraftSent, getContactsForPanel, getContactById } from '@/lib/actions/emails';
import { wrapInBrandedTemplate } from '@/lib/email/branded-template';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

const CATEGORIES = [
  { value: 'follow_up', label: 'Follow-Up', icon: 'mdi:reply' },
  { value: 'introduction', label: 'Introduction', icon: 'mdi:handshake-outline' },
  { value: 'proposal_follow_up', label: 'Proposal Follow-Up', icon: 'mdi:file-document-check-outline' },
  { value: 'check_in', label: 'Check-In', icon: 'mdi:coffee-outline' },
  { value: 'thank_you', label: 'Thank You', icon: 'mdi:heart-outline' },
  { value: 'project_update', label: 'Project Update', icon: 'mdi:progress-check' },
  { value: 'holiday', label: 'Holiday Greeting', icon: 'mdi:party-popper' },
  { value: 'win_back', label: 'Win-Back', icon: 'mdi:account-reactivate' },
  { value: 'referral_request', label: 'Referral Request', icon: 'mdi:account-multiple-plus-outline' },
];

const HOLIDAY_TYPES = [
  'New Year',
  "Valentine's Day",
  'Easter',
  'Independence Day (4th of July)',
  'Thanksgiving',
  'Christmas / Holiday Season',
  'Client Anniversary',
];

const TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'casual', label: 'Casual' },
];

/**
 * Reusable multi-recipient input with CRM contact search.
 * Shows selected recipients as chips, with inline search to add more.
 */
function RecipientInput({ selected, onAdd, onRemove, placeholder, excludeEmails }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [showDd, setShowDd] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (search.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await getRecipients(search);
      if (res.success) {
        setResults(res.recipients);
        setShowDd(true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setShowDd(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const excludeSet = useMemo(() => new Set(excludeEmails || []), [excludeEmails]);
  const filteredResults = results.filter((r) => !excludeSet.has(r.email));

  const handleSelect = (r) => {
    onAdd(r);
    setSearch('');
    setShowDd(false);
    setResults([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = search.trim();
      if (!val) return;
      if (showDd && filteredResults.length > 0) {
        handleSelect(filteredResults[0]);
        return;
      }
      if (val.includes('@') && val.includes('.')) {
        handleSelect({
          id: null,
          name: val.split('@')[0],
          email: val,
          company: null,
          type: 'manual',
        });
      }
    }
    if (e.key === 'Backspace' && !search && selected.length > 0) {
      onRemove(selected[selected.length - 1].email);
    }
  };

  return (
    <div className="position-relative" ref={ref}>
      <div
        className="form-control d-flex flex-wrap align-items-center gap-2"
        style={{ minHeight: 42, height: 'auto', padding: '4px 8px', cursor: 'text' }}
        onClick={(e) => e.currentTarget.querySelector('input')?.focus()}
      >
        {selected.map((r) => (
          <span
            key={r.email}
            className="d-inline-flex align-items-center gap-1 py-2 px-8 rounded-pill"
            style={{ background: 'rgba(255,255,255,0.1)', fontSize: '12px' }}
          >
            <span
              className={`badge ${
                r.type === 'client'
                  ? 'bg-success-600'
                  : r.type === 'teammate'
                  ? 'bg-warning-600'
                  : r.type === 'lead'
                  ? 'bg-info-600'
                  : 'bg-secondary'
              }`}
              style={{ fontSize: '9px', padding: '1px 5px' }}
            >
              {r.type === 'client'
                ? 'Client'
                : r.type === 'teammate'
                ? 'Team'
                : r.type === 'lead'
                ? 'Lead'
                : 'Email'}
            </span>
            <span className="text-white">{r.name}</span>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>&lt;{r.email}&gt;</span>
            <button
              type="button"
              className="btn p-0 border-0 bg-transparent text-white ms-1 d-flex align-items-center"
              style={{ fontSize: '14px', lineHeight: 1, opacity: 0.7 }}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(r.email);
              }}
            >
              &times;
            </button>
          </span>
        ))}
        <input
          type="text"
          className="border-0 bg-transparent text-white flex-grow-1"
          style={{ outline: 'none', minWidth: 180, height: 32 }}
          placeholder={selected.length === 0 ? placeholder : 'Add more...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => filteredResults.length > 0 && setShowDd(true)}
          onKeyDown={handleKeyDown}
        />
      </div>
      {showDd && filteredResults.length > 0 && (
        <div
          className="position-absolute w-100 border rounded-8 mt-4 shadow-lg"
          style={{
            zIndex: 1050,
            maxHeight: 200,
            overflowY: 'auto',
            background: '#1a2332',
            borderColor: 'rgba(255,255,255,0.15)',
          }}
        >
          {filteredResults.map((r) => (
            <button
              key={`${r.type}-${r.id || r.email}`}
              className="d-flex align-items-center gap-2 w-100 px-12 py-8 border-0 bg-transparent text-white"
              style={{ cursor: 'pointer' }}
              onClick={() => handleSelect(r)}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span
                className={`badge ${
                  r.type === 'client'
                    ? 'bg-success-600'
                    : r.type === 'teammate'
                    ? 'bg-warning-600'
                    : 'bg-info-600'
                } text-xs`}
              >
                {r.type === 'client' ? 'Client' : r.type === 'teammate' ? 'Teammate' : 'Lead'}
              </span>
              <span className="fw-medium text-white">{r.name}</span>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {r.email}
              </span>
              {r.company && (
                <span className="text-sm ms-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {r.company}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EmailGenerator({ teamUser }) {
  const urlParams = useSearchParams();

  // Recipient state (multi-select for both To and CC)
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [selectedCcRecipients, setSelectedCcRecipients] = useState([]);

  // Email config state
  const [category, setCategory] = useState('follow_up');
  const [holidayType, setHolidayType] = useState('');
  const [tone, setTone] = useState('professional');
  const [customInstructions, setCustomInstructions] = useState('');

  // Generated email state
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);

  // UI state
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState(null);

  // Drafts state
  const [drafts, setDrafts] = useState([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);

  // Contacts panel state
  const [showContacts, setShowContacts] = useState(false);
  const [contactsList, setContactsList] = useState([]);
  const [contactsSearch, setContactsSearch] = useState('');
  const [contactsTypeFilter, setContactsTypeFilter] = useState('all');
  const [contactsLoading, setContactsLoading] = useState(false);

  // Combined exclude list for both recipient inputs
  const allSelectedEmails = useMemo(
    () => [...selectedRecipients, ...selectedCcRecipients].map((r) => r.email),
    [selectedRecipients, selectedCcRecipients]
  );

  // Load drafts on mount
  useEffect(() => {
    loadDrafts();
  }, []);

  // Auto-fill recipient from URL params (from Contacts page "Compose Email")
  useEffect(() => {
    const recipientId = urlParams.get('recipient_id');
    const recipientType = urlParams.get('type');
    if (recipientId && recipientType) {
      getContactById(recipientId, recipientType).then((result) => {
        if (result.success && result.contact) {
          setSelectedRecipients((prev) => {
            if (prev.some((r) => r.email === result.contact.email)) return prev;
            return [...prev, result.contact];
          });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load contacts when panel is opened or search/filter changes
  useEffect(() => {
    if (!showContacts) return;

    const timer = setTimeout(async () => {
      setContactsLoading(true);
      const result = await getContactsForPanel(contactsSearch, contactsTypeFilter);
      if (result.success) {
        setContactsList(result.contacts);
      }
      setContactsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [showContacts, contactsSearch, contactsTypeFilter]);

  const loadDrafts = async () => {
    setLoadingDrafts(true);
    const result = await getDrafts();
    if (result.success) {
      setDrafts(result.drafts);
    }
    setLoadingDrafts(false);
  };

  // Add/remove handlers for To recipients
  const addRecipient = (r) => {
    if (allSelectedEmails.includes(r.email)) {
      toast.info('Recipient already added');
      return;
    }
    setSelectedRecipients((prev) => [...prev, r]);
  };

  const removeRecipient = (email) => {
    setSelectedRecipients((prev) => prev.filter((r) => r.email !== email));
  };

  // Add/remove handlers for CC recipients
  const addCcRecipient = (r) => {
    if (allSelectedEmails.includes(r.email)) {
      toast.info('Recipient already added');
      return;
    }
    setSelectedCcRecipients((prev) => [...prev, r]);
  };

  const removeCcRecipient = (email) => {
    setSelectedCcRecipients((prev) => prev.filter((r) => r.email !== email));
  };

  // Primary recipient (first in To list) used for AI generation and branded template
  const getPrimaryRecipient = () => selectedRecipients[0] || null;

  const getFullBrandedHtml = useCallback(() => {
    const primary = selectedRecipients[0];
    return wrapInBrandedTemplate({
      recipientName: primary?.name || '',
      bodyHtml: bodyHtml,
      senderName: teamUser.fullName || 'The BotMakers Team',
      senderTitle: 'Co-Founder',
    });
  }, [bodyHtml, teamUser.fullName, selectedRecipients]);

  const handleGenerate = async () => {
    const primary = getPrimaryRecipient();
    if (!primary) {
      toast.error('Please add at least one recipient');
      return;
    }
    if (!primary.name) {
      toast.error('Primary recipient name is required');
      return;
    }
    if (category === 'holiday' && !holidayType) {
      toast.error('Please select a holiday type');
      return;
    }

    setGenerating(true);
    try {
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 60000);
      const res = await fetch('/api/ai/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: primary.name,
          recipientEmail: primary.email,
          recipientCompany: primary.company || '',
          category,
          holidayType: category === 'holiday' ? holidayType : undefined,
          tone,
          customInstructions: customInstructions || undefined,
          senderName: teamUser.fullName,
        }),
        signal: controller.signal,
      });
      clearTimeout(fetchTimeout);

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to generate email');
        return;
      }

      setSubject(data.email.subject || '');
      setBodyHtml(data.email.body_html || '');
      setBodyText(data.email.body_text || '');
      toast.success('Email generated!');
    } catch (err) {
      if (err?.name === 'AbortError') {
        toast.error('Email generation timed out. Please try again.');
      } else {
        toast.error('Failed to generate email. Please try again.');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyHtml = async () => {
    if (!bodyHtml) {
      toast.error('No email content to copy');
      return;
    }
    try {
      const fullHtml = getFullBrandedHtml();
      await navigator.clipboard.writeText(fullHtml);
      toast.success('Full branded HTML copied! Paste into your email client.');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleCopyText = async () => {
    if (!bodyText) {
      toast.error('No email content to copy');
      return;
    }
    try {
      await navigator.clipboard.writeText(bodyText);
      toast.success('Plain text copied to clipboard!');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleSend = async () => {
    if (selectedRecipients.length === 0 || !subject || !bodyHtml) {
      toast.error('At least one recipient, subject, and body are required');
      return;
    }

    const toEmails = selectedRecipients.map((r) => r.email);
    const ccEmails = selectedCcRecipients.map((r) => r.email);
    const primary = getPrimaryRecipient();

    setSending(true);
    try {
      const result = await sendEmailFromCRM({
        to: toEmails,
        cc: ccEmails.length > 0 ? ccEmails : undefined,
        subject,
        html: bodyHtml,
        recipientLeadId: primary?.type === 'lead' ? primary.id : undefined,
        recipientClientId: primary?.type === 'client' ? primary.id : undefined,
        recipientName: primary?.name || '',
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      // Mark draft as sent if we have one
      if (currentDraftId) {
        await markDraftSent(currentDraftId);
        setCurrentDraftId(null);
      }

      toast.success('Email sent successfully!');
      loadDrafts();
    } catch {
      toast.error('Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    if (selectedRecipients.length === 0) {
      toast.error('Please add at least one recipient');
      return;
    }

    const primary = getPrimaryRecipient();

    setSavingDraft(true);
    try {
      const result = await saveDraft({
        id: currentDraftId || undefined,
        recipientEmail: primary.email,
        recipientName: primary.name || undefined,
        recipientLeadId: primary.type === 'lead' ? primary.id : null,
        recipientClientId: primary.type === 'client' ? primary.id : null,
        subject: subject || undefined,
        bodyHtml: bodyHtml || undefined,
        bodyText: bodyText || undefined,
        category: category || undefined,
        tone: tone || undefined,
        customInstructions: customInstructions || undefined,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setCurrentDraftId(result.id);
      toast.success('Draft saved!');
      loadDrafts();
    } catch {
      toast.error('Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleLoadDraft = async (draftId) => {
    const result = await loadDraft(draftId);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    const d = result.draft;
    setCurrentDraftId(d.id);
    setSubject(d.subject || '');
    setBodyHtml(d.bodyHtml || '');
    setBodyText(d.bodyText || '');
    setCategory(d.category || 'follow_up');
    setTone(d.tone || 'professional');
    setCustomInstructions(d.customInstructions || '');

    // Set recipient from draft
    if (d.recipientLeadId || d.recipientClientId) {
      setSelectedRecipients([
        {
          id: d.recipientLeadId || d.recipientClientId,
          name: d.recipientName || '',
          email: d.recipientEmail,
          type: d.recipientClientId ? 'client' : 'lead',
          company: null,
        },
      ]);
    } else if (d.recipientEmail) {
      setSelectedRecipients([
        {
          id: null,
          name: d.recipientName || d.recipientEmail.split('@')[0],
          email: d.recipientEmail,
          type: 'manual',
          company: null,
        },
      ]);
    } else {
      setSelectedRecipients([]);
    }
    setSelectedCcRecipients([]);

    setShowDrafts(false);
    toast.success('Draft loaded');
  };

  const handleDeleteDraft = async (draftId) => {
    if (!confirm('Delete this draft?')) return;
    const result = await deleteDraft(draftId);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (currentDraftId === draftId) {
      setCurrentDraftId(null);
    }
    toast.success('Draft deleted');
    loadDrafts();
  };

  const handleNewEmail = () => {
    setSelectedRecipients([]);
    setSelectedCcRecipients([]);
    setCategory('follow_up');
    setHolidayType('');
    setTone('professional');
    setCustomInstructions('');
    setSubject('');
    setBodyHtml('');
    setBodyText('');
    setCurrentDraftId(null);
    setShowHtmlPreview(false);
    setShowFullPreview(false);
  };

  const getCategoryLabel = (val) => CATEGORIES.find((c) => c.value === val)?.label || val;

  const hasContent = subject || bodyHtml;

  // Compute column widths based on which panels are open
  const getMainColClass = () => {
    if (showContacts && showDrafts) return 'col-lg-6';
    if (showContacts) return 'col-lg-9';
    if (showDrafts) return 'col-lg-8';
    return 'col-12';
  };

  return (
    <div className="row">
      {/* Contacts Panel */}
      {showContacts && (
        <div className="col-lg-3">
          <div className="card" style={{ position: 'sticky', top: 90 }}>
            <div className="card-header d-flex align-items-center justify-content-between">
              <h6 className="text-white fw-semibold mb-0">
                <Icon icon="mdi:contacts-outline" className="me-2" />
                Contacts
              </h6>
              <button
                className="btn btn-sm btn-outline-neutral-600"
                onClick={() => setShowContacts(false)}
              >
                <Icon icon="mdi:close" />
              </button>
            </div>
            <div className="card-body p-12 pb-0">
              <input
                type="text"
                className="form-control form-control-sm mb-8"
                placeholder="Search contacts..."
                value={contactsSearch}
                onChange={(e) => setContactsSearch(e.target.value)}
              />
              <div className="btn-group btn-group-sm w-100 mb-8">
                {[
                  { value: 'all', label: 'All' },
                  { value: 'lead', label: 'Leads' },
                  { value: 'client', label: 'Clients' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    className={`btn ${
                      contactsTypeFilter === opt.value
                        ? 'btn-primary-600'
                        : 'btn-outline-neutral-600 text-secondary-light'
                    }`}
                    onClick={() => setContactsTypeFilter(opt.value)}
                    style={{ fontSize: '11px' }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-0" style={{ maxHeight: 420, overflowY: 'auto' }}>
              {contactsLoading ? (
                <div className="text-center py-20">
                  <span className="spinner-border spinner-border-sm text-primary-600" />
                </div>
              ) : contactsList.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-secondary-light mb-0 text-sm">No contacts found</p>
                </div>
              ) : (
                contactsList.map((c) => (
                  <button
                    key={`${c.type}-${c.id}`}
                    className="d-flex flex-column w-100 px-12 py-8 border-0 bg-transparent text-start border-bottom border-neutral-600"
                    style={{ cursor: 'pointer' }}
                    onClick={() => addRecipient(c)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <span
                        className={`badge text-xs ${
                          c.type === 'client' ? 'bg-success-600' : c.type === 'teammate' ? 'bg-warning-600' : 'bg-info-600'
                        }`}
                      >
                        {c.type === 'client' ? 'C' : c.type === 'teammate' ? 'T' : 'L'}
                      </span>
                      <span className="fw-medium text-white text-sm text-truncate">
                        {c.name}
                      </span>
                    </div>
                    <span
                      className="text-xs text-truncate mt-2"
                      style={{ color: 'rgba(255,255,255,0.55)' }}
                    >
                      {c.email}
                      {c.company ? ` — ${c.company}` : ''}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={getMainColClass()}>
        <div className="d-flex align-items-center justify-content-between mb-24">
          <h5 className="text-white fw-semibold mb-0">Email Generator</h5>
          <div className="d-flex gap-2">
            <button
              className={`btn btn-sm d-flex align-items-center gap-1 ${
                showContacts ? 'btn-primary-600' : 'btn-outline-primary-600'
              }`}
              onClick={() => setShowContacts(!showContacts)}
            >
              <Icon icon="mdi:contacts-outline" className="text-lg" />
              Contacts
            </button>
            <button
              className={`btn btn-sm d-flex align-items-center gap-1 ${
                showDrafts ? 'btn-primary-600' : 'btn-outline-primary-600'
              }`}
              onClick={() => setShowDrafts(!showDrafts)}
            >
              <Icon icon="mdi:file-document-multiple-outline" className="text-lg" />
              Drafts {drafts.length > 0 && `(${drafts.length})`}
            </button>
            <button
              className="btn btn-outline-primary-600 btn-sm d-flex align-items-center gap-1"
              onClick={handleNewEmail}
            >
              <Icon icon="mdi:plus" className="text-lg" />
              New
            </button>
          </div>
        </div>

        {/* Recipient Section */}
        <div className="card mb-16">
          <div className="card-header">
            <h6 className="text-white fw-semibold mb-0">
              <Icon icon="mdi:account-outline" className="me-2" />
              Recipients
            </h6>
          </div>
          <div className="card-body">
            {/* To Field */}
            <div className="mb-12">
              <label className="form-label text-secondary-light text-sm mb-4">To</label>
              <RecipientInput
                selected={selectedRecipients}
                onAdd={addRecipient}
                onRemove={removeRecipient}
                placeholder="Search contacts by name/email, or type an email and press Enter..."
                excludeEmails={allSelectedEmails}
              />
            </div>

            {/* CC Field */}
            <div>
              <label className="form-label text-secondary-light text-sm mb-4">CC (optional)</label>
              <RecipientInput
                selected={selectedCcRecipients}
                onAdd={addCcRecipient}
                onRemove={removeCcRecipient}
                placeholder="Add CC recipients..."
                excludeEmails={allSelectedEmails}
              />
            </div>
          </div>
        </div>

        {/* Template & Tone Section */}
        <div className="card mb-16">
          <div className="card-header">
            <h6 className="text-white fw-semibold mb-0">
              <Icon icon="mdi:palette-outline" className="me-2" />
              Template & Tone
            </h6>
          </div>
          <div className="card-body">
            {/* Category selector */}
            <label className="form-label text-secondary-light text-sm mb-8">Category</label>
            <div className="d-flex flex-wrap gap-2 mb-16">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  className={`btn btn-sm d-flex align-items-center gap-1 ${
                    category === cat.value
                      ? 'btn-primary-600'
                      : 'btn-outline-neutral-600 text-secondary-light'
                  }`}
                  onClick={() => setCategory(cat.value)}
                >
                  <Icon icon={cat.icon} className="text-lg" />
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Holiday type */}
            {category === 'holiday' && (
              <div className="mb-16">
                <label className="form-label text-secondary-light text-sm mb-4">Holiday</label>
                <select
                  className="form-select"
                  value={holidayType}
                  onChange={(e) => setHolidayType(e.target.value)}
                >
                  <option value="">Select a holiday...</option>
                  {HOLIDAY_TYPES.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Tone selector */}
            <label className="form-label text-secondary-light text-sm mb-8">Tone</label>
            <div className="d-flex gap-2 mb-16">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  className={`btn btn-sm ${
                    tone === t.value
                      ? 'btn-primary-600'
                      : 'btn-outline-neutral-600 text-secondary-light'
                  }`}
                  onClick={() => setTone(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Custom instructions */}
            <label className="form-label text-secondary-light text-sm mb-4">
              Custom Instructions (optional)
            </label>
            <textarea
              className="form-control"
              rows={3}
              placeholder='e.g. "Mention their new website project", "Keep it casual", "Reference the last meeting"...'
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
            />

            {/* Generate button */}
            <div className="mt-16">
              <button
                className="btn btn-primary-600 d-flex align-items-center gap-2"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <span className="spinner-border spinner-border-sm" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Icon icon="mdi:auto-fix" className="text-xl" />
                    {hasContent ? 'Regenerate' : 'Generate Email'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Editor Section */}
        {hasContent ? (
          <div className="card mb-16">
            <div className="card-header d-flex align-items-center justify-content-between">
              <h6 className="text-white fw-semibold mb-0">
                <Icon icon="mdi:email-edit-outline" className="me-2" />
                Email Editor
              </h6>
              <button
                className={`btn btn-sm ${showHtmlPreview ? 'btn-primary-600' : 'btn-outline-neutral-600 text-secondary-light'}`}
                onClick={() => setShowHtmlPreview(!showHtmlPreview)}
              >
                <Icon icon="mdi:code-tags" className="me-1" />
                {showHtmlPreview ? 'Rich Editor' : 'HTML View'}
              </button>
            </div>
            <div className="card-body">
              {/* Subject line */}
              <div className="mb-16">
                <label className="form-label text-secondary-light text-sm mb-4">Subject</label>
                <input
                  type="text"
                  className="form-control"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject..."
                />
              </div>

              {/* Body editor / HTML view */}
              <div className="mb-16">
                <label className="form-label text-secondary-light text-sm mb-4">Body</label>
                {showHtmlPreview ? (
                  <textarea
                    className="form-control font-monospace text-sm"
                    rows={16}
                    value={bodyHtml}
                    onChange={(e) => setBodyHtml(e.target.value)}
                    style={{ fontSize: '12px', lineHeight: '1.5' }}
                  />
                ) : (
                  <ReactQuill
                    theme="snow"
                    value={bodyHtml}
                    onChange={setBodyHtml}
                    style={{ minHeight: '300px' }}
                  />
                )}
              </div>

              {/* Full Email Preview */}
              <div className="mb-16">
                <button
                  className={`btn btn-sm ${showFullPreview ? 'btn-primary-600' : 'btn-outline-neutral-600 text-secondary-light'} mb-8`}
                  type="button"
                  onClick={() => setShowFullPreview(!showFullPreview)}
                >
                  <Icon icon="mdi:eye-outline" className="me-1" />
                  {showFullPreview ? 'Hide Full Preview' : 'Preview Full Email'}
                </button>
                {showFullPreview && (
                  <div className="border border-neutral-600 rounded-8" style={{ overflow: 'hidden', maxWidth: '100%' }}>
                    <iframe
                      srcDoc={getFullBrandedHtml()}
                      title="Email Preview"
                      style={{ width: 640, maxWidth: '100%', border: 'none', minHeight: 400, display: 'block' }}
                      onLoad={(e) => {
                        const doc = e.target.contentDocument;
                        if (doc) {
                          e.target.style.height = doc.documentElement.scrollHeight + 'px';
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="card mb-16">
            <div className="card-body text-center py-40">
              <Icon icon="solar:letter-outline" className="text-secondary-light mb-12" style={{ fontSize: 48 }} />
              <h6 className="text-white mb-8">No Email Generated Yet</h6>
              <p className="text-secondary-light mb-0">
                Select a recipient, choose a template category, and click Generate to create an AI-powered email.
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {hasContent && (
          <div className="card mb-16">
            <div className="card-body">
              <div className="d-flex flex-wrap gap-2">
                <button
                  className="btn btn-outline-info d-flex align-items-center gap-2"
                  onClick={handleCopyHtml}
                >
                  <Icon icon="mdi:content-copy" className="text-lg" />
                  Copy HTML
                </button>
                <button
                  className="btn btn-outline-info d-flex align-items-center gap-2"
                  onClick={handleCopyText}
                >
                  <Icon icon="mdi:text" className="text-lg" />
                  Copy Plain Text
                </button>
                <button
                  className="btn btn-outline-warning d-flex align-items-center gap-2"
                  onClick={handleSaveDraft}
                  disabled={savingDraft}
                >
                  {savingDraft ? (
                    <>
                      <span className="spinner-border spinner-border-sm" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Icon icon="mdi:content-save-outline" className="text-lg" />
                      Save as Draft
                    </>
                  )}
                </button>
                <button
                  className="btn btn-success-600 d-flex align-items-center gap-2 ms-auto"
                  onClick={handleSend}
                  disabled={sending}
                >
                  {sending ? (
                    <>
                      <span className="spinner-border spinner-border-sm" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Icon icon="mdi:send" className="text-lg" />
                      Send from CRM
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Drafts Sidebar */}
      {showDrafts && (
        <div className={showContacts ? 'col-lg-3' : 'col-lg-4'}>
          <div className="card" style={{ position: 'sticky', top: 90 }}>
            <div className="card-header d-flex align-items-center justify-content-between">
              <h6 className="text-white fw-semibold mb-0">
                <Icon icon="mdi:file-document-multiple-outline" className="me-2" />
                Saved Drafts
              </h6>
              <button
                className="btn btn-sm btn-outline-neutral-600"
                onClick={() => setShowDrafts(false)}
              >
                <Icon icon="mdi:close" />
              </button>
            </div>
            <div className="card-body p-0" style={{ maxHeight: 500, overflowY: 'auto' }}>
              {loadingDrafts ? (
                <div className="text-center py-20">
                  <span className="spinner-border spinner-border-sm text-primary-600" />
                </div>
              ) : drafts.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-secondary-light mb-0 text-sm">No drafts saved yet</p>
                </div>
              ) : (
                drafts.map((d) => (
                  <div
                    key={d.id}
                    className={`px-16 py-12 border-bottom border-neutral-600 ${currentDraftId === d.id ? 'bg-neutral-700' : ''}`}
                  >
                    <div className="d-flex align-items-start justify-content-between mb-4">
                      <button
                        className="btn btn-sm p-0 text-white fw-medium text-start border-0 bg-transparent text-truncate"
                        onClick={() => handleLoadDraft(d.id)}
                        style={{ maxWidth: '80%' }}
                      >
                        {d.subject || 'Untitled Draft'}
                      </button>
                      <button
                        className="btn btn-sm p-0 text-danger border-0 bg-transparent"
                        onClick={() => handleDeleteDraft(d.id)}
                        title="Delete draft"
                      >
                        <Icon icon="mdi:trash-can-outline" className="text-lg" />
                      </button>
                    </div>
                    <div className="text-secondary-light text-xs">
                      {d.recipientName || d.recipientEmail}
                      {d.category && (
                        <span className="ms-2 badge bg-neutral-600 text-xs">
                          {getCategoryLabel(d.category)}
                        </span>
                      )}
                    </div>
                    <div className="text-secondary-light text-xs mt-4">
                      {new Date(d.updatedAt).toLocaleDateString()} {new Date(d.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
