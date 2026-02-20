'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import {
  updateLeadStage,
  updateLeadNotes,
  updateLeadAssignment,
  createContact,
} from '@/lib/actions/leads';
import { convertLeadToClient } from '@/lib/actions/clients';
import { approveAndSendFollowUp, dismissFollowUp } from '@/lib/actions/follow-ups';
import {
  PIPELINE_STAGES,
  LEAD_SOURCES,
  LEAD_SCORES,
} from '@/lib/utils/constants';
import {
  formatRelativeTime,
  formatDate,
  formatPhoneNumber,
} from '@/lib/utils/formatters';

const CONTACT_TYPES = [
  { value: 'email', label: 'Email', icon: 'mdi:email-outline' },
  { value: 'phone', label: 'Phone', icon: 'mdi:phone-outline' },
  { value: 'sms', label: 'SMS', icon: 'mdi:message-text-outline' },
  { value: 'meeting', label: 'Meeting', icon: 'mdi:calendar-outline' },
  { value: 'note', label: 'Note', icon: 'mdi:note-text-outline' },
];

const LeadDetail = ({ lead: initialLead, contacts: initialContacts, teamMembers, followUps: initialFollowUps = [] }) => {
  const router = useRouter();
  const [lead, setLead] = useState(initialLead);
  const [contactList, setContactList] = useState(initialContacts);
  const [notes, setNotes] = useState(lead.notes || '');
  const [showContactModal, setShowContactModal] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [, startTransition] = useTransition();
  const notesRef = useRef(null);
  const [convertLoading, setConvertLoading] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [leadFollowUps, setLeadFollowUps] = useState(initialFollowUps);
  const [followUpLoading, setFollowUpLoading] = useState(null);

  // ── Stage Change ────────────────────────────────────────────────────────
  const handleStageChange = (newStage) => {
    if (newStage === lead.pipelineStage) return;
    setLead((prev) => ({ ...prev, pipelineStage: newStage }));
    startTransition(async () => {
      const res = await updateLeadStage(lead.id, newStage);
      if (res?.error) {
        toast.error(res.error);
        setLead((prev) => ({ ...prev, pipelineStage: initialLead.pipelineStage }));
      } else {
        const label = PIPELINE_STAGES.find((s) => s.value === newStage)?.label;
        toast.success(`Moved to ${label}`);
      }
    });
  };

  // ── Notes Auto-save ─────────────────────────────────────────────────────
  const handleNotesBlur = () => {
    if (notes === (lead.notes || '')) return;
    startTransition(async () => {
      const res = await updateLeadNotes(lead.id, notes);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success('Notes saved');
        setLead((prev) => ({ ...prev, notes }));
      }
    });
  };

  // ── Assignment ──────────────────────────────────────────────────────────
  const handleAssignmentChange = (teamUserId) => {
    startTransition(async () => {
      const res = await updateLeadAssignment(lead.id, teamUserId);
      if (res?.error) {
        toast.error(res.error);
      } else {
        const name =
          teamUserId === 'unassigned'
            ? null
            : teamMembers.find((m) => m.id === teamUserId)?.fullName;
        setLead((prev) => ({
          ...prev,
          assignedTo: teamUserId === 'unassigned' ? null : teamUserId,
          assignedName: name,
        }));
        toast.success('Assignment updated');
      }
    });
  };

  // ── AI Analysis ─────────────────────────────────────────────────────────
  const handleRunAnalysis = async () => {
    setAiLoading(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      const res = await fetch('/api/ai/analyze-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
      } else {
        setLead((prev) => ({
          ...prev,
          aiInternalAnalysis: json.analysis,
          aiProspectSummary: json.analysis.prospect_summary,
          score: json.analysis.score,
        }));
        toast.success('AI analysis complete');
      }
    } catch (err) {
      if (err?.name === 'AbortError') {
        toast.error('Analysis timed out. Please try again.');
      } else {
        toast.error('CB-INT-002: AI analysis failed');
      }
    } finally {
      setAiLoading(false);
    }
  };

  // ── Convert to Client ──────────────────────────────────────────────────
  const handleConvert = async () => {
    setConvertLoading(true);
    const res = await convertLeadToClient(lead.id);
    setConvertLoading(false);
    setShowConvertConfirm(false);

    if (res?.error) {
      if (res.existingClientId) {
        toast.info('This lead has already been converted');
        router.push(`/clients/${res.existingClientId}`);
      } else {
        toast.error(res.error);
      }
    } else {
      toast.success('Lead converted to client! Welcome email sent.');
      router.push(`/clients/${res.clientId}`);
    }
  };

  // ── Contact Log ─────────────────────────────────────────────────────────
  const [contactForm, setContactForm] = useState({
    type: 'email',
    subject: '',
    body: '',
    direction: 'outbound',
  });
  const [contactSaving, setContactSaving] = useState(false);

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setContactSaving(true);
    const res = await createContact({
      leadId: lead.id,
      ...contactForm,
    });
    setContactSaving(false);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Contact logged');
      // Add to local list
      setContactList((prev) => [
        {
          id: res.contact?.id || Date.now(),
          ...contactForm,
          createdAt: new Date().toISOString(),
          createdByName: 'You',
        },
        ...prev,
      ]);
      setContactForm({ type: 'email', subject: '', body: '', direction: 'outbound' });
      setShowContactModal(false);
    }
  };

  const sourceConfig = LEAD_SOURCES.find((s) => s.value === lead.source);
  const scoreConfig = LEAD_SCORES.find((s) => s.value === lead.score);
  const stageConfig = PIPELINE_STAGES.find(
    (s) => s.value === (lead.pipelineStage || 'new_lead')
  );
  const analysis = lead.aiInternalAnalysis;

  return (
    <>
      {/* Header */}
      <div className="d-flex align-items-center gap-2 mb-4">
        <button
          className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
          onClick={() => router.push('/leads')}
        >
          <Icon icon="mdi:arrow-left" style={{ fontSize: '16px' }} />
          Leads
        </button>
      </div>

      <div className="d-flex flex-wrap align-items-center gap-3 mb-4">
        <h4 className="text-white fw-semibold mb-0">{lead.fullName}</h4>
        {lead.companyName && (
          <span className="text-secondary-light text-md">
            {lead.companyName}
          </span>
        )}
        {stageConfig && (
          <span
            className="badge fw-medium"
            style={{
              background: `${stageConfig.color}22`,
              color: stageConfig.color,
            }}
          >
            {stageConfig.label}
          </span>
        )}
        {scoreConfig && (
          <span
            className="badge fw-medium"
            style={{
              background: `${scoreConfig.color}22`,
              color: scoreConfig.color,
            }}
          >
            {scoreConfig.label}
          </span>
        )}
        {sourceConfig && (
          <span
            className="badge fw-medium"
            style={{ background: 'rgba(13,202,240,0.15)', color: '#0dcaf0' }}
          >
            {sourceConfig.label}
          </span>
        )}
      </div>

      <div className="row g-4">
        {/* Left Column */}
        <div className="col-xxl-8 col-xl-7">
          {/* Contact Info Card */}
          <div className="card mb-4">
            <div className="card-header d-flex align-items-center gap-2">
              <Icon
                icon="mdi:account-details-outline"
                style={{ fontSize: '20px' }}
                className="text-primary-light"
              />
              <h6 className="text-white fw-semibold mb-0">Contact Information</h6>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-sm-6">
                  <label className="text-secondary-light text-xs d-block mb-1">
                    Email
                  </label>
                  <span className="text-white text-sm">{lead.email}</span>
                </div>
                <div className="col-sm-6">
                  <label className="text-secondary-light text-xs d-block mb-1">
                    Phone
                  </label>
                  <span className="text-white text-sm">
                    {formatPhoneNumber(lead.phone)}
                  </span>
                </div>
                <div className="col-sm-6">
                  <label className="text-secondary-light text-xs d-block mb-1">
                    Preferred Contact
                  </label>
                  <span className="text-white text-sm text-capitalize">
                    {lead.preferredContact || 'Email'}
                  </span>
                </div>
                <div className="col-sm-6">
                  <label className="text-secondary-light text-xs d-block mb-1">
                    Company
                  </label>
                  <span className="text-white text-sm">
                    {lead.companyName || '—'}
                  </span>
                </div>
                <div className="col-sm-6">
                  <label className="text-secondary-light text-xs d-block mb-1">
                    Project Type
                  </label>
                  <span className="text-white text-sm">
                    {lead.projectType || '—'}
                  </span>
                </div>
                <div className="col-sm-6">
                  <label className="text-secondary-light text-xs d-block mb-1">
                    Timeline
                  </label>
                  <span className="text-white text-sm">
                    {lead.projectTimeline || '—'}
                  </span>
                </div>
                {lead.projectDetails && (
                  <div className="col-12">
                    <label className="text-secondary-light text-xs d-block mb-1">
                      Project Details
                    </label>
                    <p className="text-white text-sm mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                      {lead.projectDetails}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pipeline Stage Visual Selector */}
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="text-white fw-semibold mb-0">Pipeline Stage</h6>
            </div>
            <div className="card-body">
              <div className="d-flex flex-wrap gap-1">
                {PIPELINE_STAGES.map((stage, idx) => {
                  const isActive =
                    stage.value === (lead.pipelineStage || 'new_lead');
                  return (
                    <button
                      key={stage.value}
                      className="btn btn-sm position-relative d-flex align-items-center gap-1"
                      style={{
                        background: isActive
                          ? stage.color
                          : 'rgba(255,255,255,0.06)',
                        color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                        border: 'none',
                        fontSize: '11px',
                        padding: '6px 10px',
                        fontWeight: isActive ? '600' : '400',
                        transition: 'all 0.2s',
                      }}
                      onClick={() => handleStageChange(stage.value)}
                      title={stage.label}
                    >
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: isActive
                            ? '#fff'
                            : stage.color,
                          flexShrink: 0,
                        }}
                      />
                      {stage.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* AI Analysis Panel */}
          <div className="card mb-4">
            <div
              className="card-header d-flex align-items-center justify-content-between cursor-pointer"
              onClick={() => setAiExpanded(!aiExpanded)}
            >
              <div className="d-flex align-items-center gap-2">
                <Icon
                  icon="mdi:robot-outline"
                  style={{ fontSize: '20px' }}
                  className="text-primary-light"
                />
                <h6 className="text-white fw-semibold mb-0">AI Analysis</h6>
              </div>
              <Icon
                icon={aiExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'}
                style={{ fontSize: '20px' }}
                className="text-secondary-light"
              />
            </div>
            {aiExpanded && (
              <div className="card-body">
                {analysis ? (
                  <div className="row g-3">
                    {analysis.prospect_summary && (
                      <div className="col-12">
                        <label className="text-secondary-light text-xs d-block mb-1">
                          Prospect Summary
                        </label>
                        <p className="text-white text-sm mb-0">
                          {analysis.prospect_summary}
                        </p>
                      </div>
                    )}
                    {analysis.project_summary && (
                      <div className="col-12">
                        <label className="text-secondary-light text-xs d-block mb-1">
                          Project Summary
                        </label>
                        <p className="text-white text-sm mb-0">
                          {analysis.project_summary}
                        </p>
                      </div>
                    )}
                    <div className="col-sm-4">
                      <label className="text-secondary-light text-xs d-block mb-1">
                        Complexity
                      </label>
                      <span className="text-white text-sm text-capitalize">
                        {analysis.complexity || '—'}
                      </span>
                    </div>
                    <div className="col-sm-4">
                      <label className="text-secondary-light text-xs d-block mb-1">
                        Estimated Effort
                      </label>
                      <span className="text-white text-sm">
                        {analysis.estimated_effort || '—'}
                      </span>
                    </div>
                    <div className="col-sm-4">
                      <label className="text-secondary-light text-xs d-block mb-1">
                        Score
                      </label>
                      <span className="text-white text-sm text-capitalize">
                        {analysis.score || '—'}
                      </span>
                    </div>
                    {analysis.key_questions?.length > 0 && (
                      <div className="col-12">
                        <label className="text-secondary-light text-xs d-block mb-1">
                          Key Questions
                        </label>
                        <ul className="list-unstyled mb-0">
                          {analysis.key_questions.map((q, i) => (
                            <li
                              key={i}
                              className="text-white text-sm mb-1 d-flex gap-2"
                            >
                              <Icon
                                icon="mdi:help-circle-outline"
                                className="text-warning flex-shrink-0 mt-1"
                                style={{ fontSize: '14px' }}
                              />
                              {q}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {analysis.red_flags?.length > 0 && (
                      <div className="col-12">
                        <label className="text-secondary-light text-xs d-block mb-1">
                          Red Flags
                        </label>
                        <ul className="list-unstyled mb-0">
                          {analysis.red_flags.map((f, i) => (
                            <li
                              key={i}
                              className="text-white text-sm mb-1 d-flex gap-2"
                            >
                              <Icon
                                icon="mdi:alert-outline"
                                className="text-danger flex-shrink-0 mt-1"
                                style={{ fontSize: '14px' }}
                              />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {analysis.recommended_next_step && (
                      <div className="col-12">
                        <label className="text-secondary-light text-xs d-block mb-1">
                          Recommended Next Step
                        </label>
                        <p className="text-white text-sm mb-0">
                          {analysis.recommended_next_step}
                        </p>
                      </div>
                    )}
                    <div className="col-12 mt-2">
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={handleRunAnalysis}
                        disabled={aiLoading}
                      >
                        {aiLoading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-1" />
                            Re-analyzing...
                          </>
                        ) : (
                          <>
                            <Icon icon="mdi:refresh" className="me-1" />
                            Re-analyze
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Icon
                      icon="mdi:robot-outline"
                      className="text-secondary-light mb-2"
                      style={{ fontSize: '36px' }}
                    />
                    <p className="text-secondary-light text-sm mb-3">
                      No AI analysis yet. Run analysis to get score,
                      complexity, and recommendations.
                    </p>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleRunAnalysis}
                      disabled={aiLoading}
                    >
                      {aiLoading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-1" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Icon icon="mdi:robot-outline" className="me-1" />
                          Run AI Analysis
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="text-white fw-semibold mb-0">Notes</h6>
            </div>
            <div className="card-body">
              <textarea
                ref={notesRef}
                className="form-control bg-base text-white"
                rows={4}
                placeholder="Add notes about this lead..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
              />
              <p className="text-secondary-light text-xs mt-1 mb-0">
                Auto-saves when you click away
              </p>
            </div>
          </div>

          {/* Contact Log */}
          <div className="card mb-4">
            <div className="card-header d-flex align-items-center justify-content-between">
              <h6 className="text-white fw-semibold mb-0">Contact Log</h6>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowContactModal(true)}
              >
                <Icon icon="mdi:plus" className="me-1" />
                Log Contact
              </button>
            </div>
            <div className="card-body">
              {contactList.length === 0 ? (
                <div className="text-center py-4">
                  <Icon
                    icon="mdi:timeline-outline"
                    className="text-secondary-light mb-2"
                    style={{ fontSize: '36px' }}
                  />
                  <p className="text-secondary-light text-sm mb-0">
                    No contacts logged yet
                  </p>
                </div>
              ) : (
                <div className="position-relative ps-4">
                  {/* Timeline line */}
                  <div
                    className="position-absolute"
                    style={{
                      left: '8px',
                      top: '6px',
                      bottom: '6px',
                      width: '2px',
                      background: 'rgba(255,255,255,0.08)',
                    }}
                  />
                  {contactList.map((contact) => {
                    const typeConfig = CONTACT_TYPES.find(
                      (t) => t.value === contact.type
                    );
                    return (
                      <div key={contact.id} className="position-relative mb-4">
                        {/* Dot */}
                        <div
                          className="position-absolute rounded-circle"
                          style={{
                            left: '-20px',
                            top: '4px',
                            width: '10px',
                            height: '10px',
                            background: '#0dcaf0',
                            border: '2px solid var(--bs-gray-800)',
                          }}
                        />
                        <div className="d-flex align-items-start justify-content-between mb-1">
                          <div className="d-flex align-items-center gap-2">
                            <Icon
                              icon={typeConfig?.icon || 'mdi:note-outline'}
                              className="text-primary-light"
                              style={{ fontSize: '16px' }}
                            />
                            <span className="badge bg-base text-xs">
                              {typeConfig?.label || contact.type}
                            </span>
                            <span className="badge bg-base text-xs text-capitalize">
                              {contact.direction}
                            </span>
                          </div>
                          <span className="text-secondary-light text-xs">
                            {formatRelativeTime(contact.createdAt)}
                          </span>
                        </div>
                        {contact.subject && (
                          <p className="text-white text-sm fw-medium mb-1">
                            {contact.subject}
                          </p>
                        )}
                        {contact.body && (
                          <p
                            className="text-secondary-light text-sm mb-1"
                            style={{ whiteSpace: 'pre-wrap' }}
                          >
                            {contact.body}
                          </p>
                        )}
                        {contact.createdByName && (
                          <span className="text-secondary-light text-xs">
                            by {contact.createdByName}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (Sidebar) */}
        <div className="col-xxl-4 col-xl-5">
          {/* Assigned To */}
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="text-white fw-semibold mb-0">Assigned To</h6>
            </div>
            <div className="card-body">
              <select
                className="form-select bg-base text-white"
                value={lead.assignedTo || 'unassigned'}
                onChange={(e) => handleAssignmentChange(e.target.value)}
              >
                <option value="unassigned">Unassigned</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="text-white fw-semibold mb-0">Actions</h6>
            </div>
            <div className="card-body d-flex flex-column gap-2">
              {!lead.convertedToClientId && (
                <button
                  className="btn btn-success w-100 d-flex align-items-center justify-content-center gap-2"
                  onClick={() => setShowConvertConfirm(true)}
                  disabled={convertLoading}
                >
                  {convertLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <Icon icon="mdi:account-convert" style={{ fontSize: '18px' }} />
                      Convert to Client
                    </>
                  )}
                </button>
              )}
              {lead.convertedToClientId && (
                <button
                  className="btn btn-outline-success w-100 d-flex align-items-center justify-content-center gap-2"
                  onClick={() => router.push(`/clients/${lead.convertedToClientId}`)}
                >
                  <Icon icon="mdi:check-circle" style={{ fontSize: '16px' }} />
                  View Client
                </button>
              )}
              <button
                className="btn btn-outline-primary w-100 d-flex align-items-center justify-content-center gap-2"
                onClick={() =>
                  router.push(`/proposals/new?lead_id=${lead.id}`)
                }
              >
                <Icon
                  icon="mdi:file-document-outline"
                  style={{ fontSize: '18px' }}
                />
                Create Proposal
              </button>
            </div>
          </div>

          {/* Follow-Up Reminders */}
          {leadFollowUps.length > 0 && (
            <div className="card mb-4">
              <div className="card-header d-flex align-items-center gap-2">
                <Icon icon="mdi:bell-ring-outline" className="text-warning" style={{ fontSize: '18px' }} />
                <h6 className="text-white fw-semibold mb-0">Follow-Ups</h6>
              </div>
              <div className="card-body d-flex flex-column gap-3">
                {leadFollowUps.map((fu) => {
                  const isPending = fu.status === 'pending';
                  const isSent = fu.status === 'sent';
                  const statusColor = isPending ? '#ffc107' : isSent ? '#198754' : '#6c757d';
                  return (
                    <div key={fu.id} className="border rounded p-2" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <span className="badge text-xs" style={{ background: `${statusColor}22`, color: statusColor }}>
                          {fu.status}
                        </span>
                        <span className="text-secondary-light text-xs">
                          {formatRelativeTime(fu.remindAt)}
                        </span>
                      </div>
                      <p className="text-secondary-light text-xs mb-2">{fu.triggerReason}</p>
                      {fu.aiDraftSubject && (
                        <p className="text-white text-xs mb-2">
                          <Icon icon="mdi:email-outline" className="me-1" style={{ fontSize: '12px' }} />
                          {fu.aiDraftSubject}
                        </p>
                      )}
                      {isPending && (
                        <div className="d-flex gap-1">
                          <button
                            className="btn btn-sm btn-success flex-fill"
                            disabled={!fu.aiDraftSubject || followUpLoading === fu.id}
                            onClick={async () => {
                              setFollowUpLoading(fu.id);
                              const res = await approveAndSendFollowUp(fu.id);
                              setFollowUpLoading(null);
                              if (res?.error) { toast.error(res.error); }
                              else {
                                toast.success('Follow-up sent!');
                                setLeadFollowUps((prev) => prev.map((f) => f.id === fu.id ? { ...f, status: 'sent', sentAt: new Date().toISOString() } : f));
                              }
                            }}
                          >
                            {followUpLoading === fu.id ? <span className="spinner-border spinner-border-sm" /> : 'Send'}
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary flex-fill"
                            disabled={followUpLoading === fu.id}
                            onClick={async () => {
                              setFollowUpLoading(fu.id);
                              const res = await dismissFollowUp(fu.id);
                              setFollowUpLoading(null);
                              if (res?.error) { toast.error(res.error); }
                              else {
                                toast.success('Dismissed');
                                setLeadFollowUps((prev) => prev.map((f) => f.id === fu.id ? { ...f, status: 'dismissed' } : f));
                              }
                            }}
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Info */}
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="text-white fw-semibold mb-0">Details</h6>
            </div>
            <div className="card-body">
              <div className="d-flex flex-column gap-3">
                <div>
                  <label className="text-secondary-light text-xs d-block mb-1">
                    Created
                  </label>
                  <span className="text-white text-sm">
                    {formatDate(lead.createdAt)}
                  </span>
                </div>
                <div>
                  <label className="text-secondary-light text-xs d-block mb-1">
                    Last Contacted
                  </label>
                  <span className="text-white text-sm">
                    {lead.lastContactedAt
                      ? formatRelativeTime(lead.lastContactedAt)
                      : 'Never'}
                  </span>
                </div>
                <div>
                  <label className="text-secondary-light text-xs d-block mb-1">
                    Stage Changed
                  </label>
                  <span className="text-white text-sm">
                    {formatRelativeTime(lead.pipelineStageChangedAt)}
                  </span>
                </div>
                {lead.existingSystems && (
                  <div>
                    <label className="text-secondary-light text-xs d-block mb-1">
                      Existing Systems
                    </label>
                    <span className="text-white text-sm">
                      {lead.existingSystems}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Convert to Client Confirmation */}
      {showConvertConfirm && (
        <div
          className="modal show d-block"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowConvertConfirm(false);
          }}
        >
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content bg-base">
              <div className="modal-header border-secondary-subtle">
                <h5 className="modal-title text-white fw-semibold">
                  Convert to Client
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowConvertConfirm(false)}
                />
              </div>
              <div className="modal-body">
                <p className="text-secondary-light text-sm mb-2">
                  This will:
                </p>
                <ul className="text-secondary-light text-sm mb-0 ps-3">
                  <li>Create a client record for <strong className="text-white">{lead.fullName}</strong></li>
                  <li>Set up portal access (magic link login)</li>
                  <li>Move lead to &quot;Contract Signed&quot; stage</li>
                  <li>Send a welcome email to {lead.email}</li>
                </ul>
              </div>
              <div className="modal-footer border-secondary-subtle">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setShowConvertConfirm(false)}
                  disabled={convertLoading}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-success btn-sm"
                  onClick={handleConvert}
                  disabled={convertLoading}
                >
                  {convertLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" />
                      Converting...
                    </>
                  ) : (
                    'Confirm Conversion'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Contact Modal */}
      {showContactModal && (
        <div
          className="modal show d-block"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowContactModal(false);
          }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content bg-base">
              <div className="modal-header border-secondary-subtle">
                <h5 className="modal-title text-white fw-semibold">
                  Log Contact
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowContactModal(false)}
                />
              </div>
              <form onSubmit={handleContactSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label text-secondary-light text-sm">
                      Type
                    </label>
                    <select
                      className="form-select bg-base text-white"
                      value={contactForm.type}
                      onChange={(e) =>
                        setContactForm((prev) => ({
                          ...prev,
                          type: e.target.value,
                        }))
                      }
                    >
                      {CONTACT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label text-secondary-light text-sm">
                      Direction
                    </label>
                    <select
                      className="form-select bg-base text-white"
                      value={contactForm.direction}
                      onChange={(e) =>
                        setContactForm((prev) => ({
                          ...prev,
                          direction: e.target.value,
                        }))
                      }
                    >
                      <option value="outbound">Outbound</option>
                      <option value="inbound">Inbound</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label text-secondary-light text-sm">
                      Subject
                    </label>
                    <input
                      type="text"
                      className="form-control bg-base text-white"
                      placeholder="Brief subject..."
                      value={contactForm.subject}
                      onChange={(e) =>
                        setContactForm((prev) => ({
                          ...prev,
                          subject: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label text-secondary-light text-sm">
                      Notes / Body
                    </label>
                    <textarea
                      className="form-control bg-base text-white"
                      rows={3}
                      placeholder="Details about this interaction..."
                      value={contactForm.body}
                      onChange={(e) =>
                        setContactForm((prev) => ({
                          ...prev,
                          body: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="modal-footer border-secondary-subtle">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowContactModal(false)}
                    disabled={contactSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={contactSaving}
                  >
                    {contactSaving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" />
                        Saving...
                      </>
                    ) : (
                      'Save Contact'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LeadDetail;
