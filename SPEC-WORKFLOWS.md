# SPEC-WORKFLOWS.md — Botmakers CRM v2

---

## WF-1: Lead Arrives (from website)

Lead form on botmakers.ai already POSTs to Supabase. The CRM reads it.

1. Lead fills form on botmakers.ai → inserted into leads table (source: 'web_form', pipeline_stage: 'new_lead')
2. CRM dashboard shows new lead in "Leads This Week" count
3. Pipeline board shows lead in "New Lead" column
4. Notification email to team: "New Lead: {name}"

**Note:** The website handles step 1. CRM just reads the data. If the website doesn't set pipeline_stage, the CRM defaults to 'new_lead' for any lead with NULL pipeline_stage.

---

## WF-2: Referral Arrives (from website)

1. Referral form on botmakers.ai → upserts referrer, inserts leads (source: 'referral')
2. CRM shows in Referrals page grouped by referrer
3. Each referred contact appears in Pipeline as 'new_lead'

---

## WF-3: Pipeline Stage Change

1. Team drags lead card on Kanban OR uses dropdown on lead detail
2. Update lead: pipeline_stage, pipeline_stage_changed_at
3. If stage = 'contacted': update last_contacted_at
4. Notification to team: "Lead {name} moved to {stage}"
5. Log to activity_log

---

## WF-4: Lead → Client Conversion

1. Team clicks "Convert to Client" on lead detail
2. Confirm dialog
3. Check if client exists with same email → link if yes
4. If new: insert client record, create Supabase Auth account (magic link ready)
5. Update lead: converted_to_client_id, pipeline_stage = 'contract_signed'
6. Send welcome email to client with portal info
7. Log to activity_log
8. Redirect to /clients/[id]

---

## WF-5: AI Proposal Generation

1. Team selects lead/client, pastes discovery notes, picks pricing type
2. Clicks "Generate with AI"
3. Claude API generates scope, deliverables, terms, suggested line items
4. Response populates form fields (all editable)
5. Team reviews/edits, adjusts line items
6. "Save Draft" or "Send to Client"
7. If sent: email to client with link to /portal/proposals/[id]
8. Log to activity_log

---

## WF-6: Proposal Acceptance (Client)

1. Client receives email, clicks link → /portal/proposals/[id]
2. Proposal viewed_at set on first load
3. Client reviews scope, deliverables, terms, pricing
4. Checks "I agree" + types full name as signature
5. Clicks "Accept & Sign"
6. Update: status = 'accepted', accepted_at, client_signature
7. Notification to team: "Proposal accepted!"
8. Log to activity_log

---

## WF-7: Milestone Completion → Auto Invoice

1. Team marks milestone as 'completed'
2. Confirm: "Mark complete? Client will be notified."
3. Update milestone: status, completed_at
4. If triggers_invoice = true:
   a. Create invoice in CRM
   b. Create Square invoice via API
   c. Store square_invoice_id + square_payment_url
5. Email client: "Milestone complete!"
6. Recalculate project progress %
7. Log to activity_log

---

## WF-8: Client Question → AI-Polished Reply

**Client submits:**
1. Types question (min 10 chars) in portal
2. Insert into project_questions (status: 'pending')
3. Email to team: "Client question about {project}"

**Team replies:**
4. Types reply_draft in CRM
5. Clicks "Polish with AI" → Claude refines
6. Team reviews polished version, edits if needed
7. Clicks "Send Reply"
8. Update question: reply_text, status = 'replied'
9. Email to client with reply

---

## WF-9: Square Payment (Webhook)

1. POST /api/webhooks/square receives payment.completed
2. Verify HMAC signature
3. Find invoice by square_invoice_id
4. Update invoice: status = 'paid', paid_at
5. Insert payment record
6. Notify team: "Payment received: ${amount}"
7. Send receipt to client
8. Log to activity_log

**Edge cases:** Invoice not found → log warning. Duplicate webhook → skip if already paid.

---

## WF-10: GitHub Repo Sync

1. Team enters owner/repo on project Repos tab
2. Validate via GitHub API
3. Insert into project_repos
4. Fetch last 10 commits, display in CRM
5. Optional: webhook for push events

---

## WF-11: Vercel Preview Auto-Pull

1. POST /api/webhooks/vercel receives deployment event
2. Verify signature
3. Extract preview URL + match to project_repos
4. Insert demo (is_auto_pulled=true, is_approved=false)
5. Team approves in CRM for client visibility

---

## WF-12: Stale Lead Detection (Cron)

1. Daily at 8am CT: GET /api/cron/stale-leads
2. Verify CRON_SECRET
3. Query leads not contacted in X days (configurable)
4. Notify assigned team member (or all if unassigned)

---

## WF-13: Overdue Milestone Detection (Cron)

1. Daily at 8am CT: GET /api/cron/overdue-milestones
2. Verify CRON_SECRET
3. Query milestones past due_date
4. Update status to 'overdue', notify team

---

## WF-14: Square Historical Backfill

1. Admin triggers from /settings > Integrations > Square > "Backfill History"
2. Call Square API: list invoices, list payments
3. For each invoice: match to client by email, insert if not exists
4. For each payment: link to invoice, insert payment record
5. Show progress bar during backfill
6. Log results: "Imported X invoices, Y payments"

---

## WF-15: AI Email Generation

1. Team user navigates to /email-generator
2. Selects recipient from leads/clients search or enters manually
3. Selects template category (follow_up, introduction, proposal_follow_up, check_in, thank_you, project_update, holiday, win_back, referral_request)
4. Selects tone (professional/friendly/casual)
5. Optionally adds custom instructions
6. Clicks "Generate" → POST /api/ai/generate-email
7. API fetches recipient CRM history (lead score, pipeline stage, last 5 contacts, client info)
8. Claude generates { subject, body_html, body_text } with Botmakers branding
9. Email appears in editor — user can edit subject, body (ReactQuill), toggle HTML view
10. Actions:
    - "Copy HTML" → clipboard (for pasting into Gmail/Outlook)
    - "Copy Plain Text" → clipboard
    - "Save as Draft" → email_drafts table
    - "Send from CRM" → Resend (from info@botmakers.ai) + log to contacts + activity_log
11. "Regenerate" re-sends to Claude with same context for a fresh draft
12. Drafts panel shows saved drafts — click to load, delete to remove
