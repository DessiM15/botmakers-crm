/**
 * Demo data seed for TikTok screen recording.
 * Run: node src/lib/db/seed-demo.mjs (from file/ directory)
 *
 * Creates realistic mock leads, clients, projects, proposals, invoices,
 * services, and activity log entries. Does NOT create auth users for
 * mock clients — this is purely for CRM-side display.
 *
 * Prerequisites: team users must already exist (run seed.mjs first).
 * To reset: node src/lib/db/seed-demo.mjs --reset
 */

import postgres from 'postgres';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';
config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('Missing DATABASE_URL. Ensure .env.local exists.');
  process.exit(1);
}

const sql = postgres(databaseUrl, { prepare: false });
const isReset = process.argv.includes('--reset');

// ── Helpers ─────────────────────────────────────────────────────────────────

function uuid() { return randomUUID(); }
function daysAgo(n) { return new Date(Date.now() - n * 86400000); }
function dateStr(d) { return d.toISOString().split('T')[0]; }

// ── Cleanup ─────────────────────────────────────────────────────────────────

async function resetDemoData() {
  console.log('Resetting demo data...');
  // Delete in FK order using is_demo flag (indexed, fast)
  await sql`DELETE FROM cost_entries WHERE is_demo = true`;
  await sql`DELETE FROM activity_log WHERE is_demo = true`;
  await sql`DELETE FROM meetings WHERE is_demo = true`;
  await sql`DELETE FROM payments WHERE is_demo = true`;
  await sql`DELETE FROM invoice_line_items WHERE invoice_id IN (SELECT id FROM invoices WHERE is_demo = true)`;
  await sql`DELETE FROM invoices WHERE is_demo = true`;
  await sql`DELETE FROM proposal_line_items WHERE proposal_id IN (SELECT id FROM proposals WHERE is_demo = true)`;
  await sql`DELETE FROM proposals WHERE is_demo = true`;
  await sql`DELETE FROM project_milestones WHERE project_id IN (SELECT id FROM projects WHERE is_demo = true)`;
  await sql`DELETE FROM project_phases WHERE project_id IN (SELECT id FROM projects WHERE is_demo = true)`;
  await sql`DELETE FROM project_repos WHERE project_id IN (SELECT id FROM projects WHERE is_demo = true)`;
  await sql`DELETE FROM project_demos WHERE project_id IN (SELECT id FROM projects WHERE is_demo = true)`;
  await sql`DELETE FROM project_questions WHERE project_id IN (SELECT id FROM projects WHERE is_demo = true)`;
  await sql`DELETE FROM client_services WHERE is_demo = true`;
  await sql`DELETE FROM contacts WHERE is_demo = true`;
  await sql`DELETE FROM projects WHERE is_demo = true`;
  await sql`DELETE FROM leads WHERE is_demo = true`;
  await sql`DELETE FROM clients WHERE is_demo = true`;
  console.log('Demo data cleared.\n');
}

// ── Main Seed ───────────────────────────────────────────────────────────────

async function seedDemo() {
  if (isReset) {
    await resetDemoData();
    if (process.argv.includes('--reset-only')) {
      await sql.end();
      process.exit(0);
    }
  }

  // Get first team user as creator
  const [teamUser] = await sql`SELECT id, full_name FROM team_users WHERE is_active = true ORDER BY created_at LIMIT 1`;
  if (!teamUser) {
    console.error('No team users found. Run seed.mjs first.');
    process.exit(1);
  }
  const allTeam = await sql`SELECT id, full_name FROM team_users WHERE is_active = true ORDER BY created_at`;
  const creatorId = teamUser.id;

  console.log(`Seeding demo data (creator: ${teamUser.full_name})...\n`);

  // ── Leads ───────────────────────────────────────────────────────────────

  const leadIds = { marcus: uuid(), sarah: uuid(), david: uuid(), emily: uuid(), james: uuid(), alex: uuid(), rachel: uuid() };

  const leads = [
    { id: leadIds.marcus, fullName: 'Marcus Rivera', email: 'marcus@luxeinteriors.com', phone: '(305) 555-0142', companyName: 'Luxe Interiors Miami', projectType: 'AI Chatbot', projectTimeline: '2-3 months', source: 'web_form', score: 'high', pipelineStage: 'discovery_completed', projectDetails: 'Need an AI assistant for our interior design website that can help clients visualize room layouts and get instant pricing estimates.', assignedTo: allTeam[0]?.id, notes: '[DEMO] High-value lead, discovery call went great' },
    { id: leadIds.sarah, fullName: 'Sarah Chen', email: 'sarah@brightpathacademy.com', phone: '(415) 555-0198', companyName: 'BrightPath Academy', projectType: 'Custom CRM', projectTimeline: '3-4 months', source: 'referral', score: 'high', pipelineStage: 'proposal_sent', projectDetails: 'Online learning platform needs a custom student management system with automated enrollment, progress tracking, and parent communication portal.', assignedTo: allTeam[0]?.id, notes: '[DEMO] Proposal sent, waiting for response' },
    { id: leadIds.david, fullName: 'David Park', email: 'david@greenlighteats.com', phone: '(212) 555-0167', companyName: 'GreenLight Eats', projectType: 'Automation', projectTimeline: '1-2 months', source: 'tiktok', score: 'medium', pipelineStage: 'contacted', projectDetails: 'Restaurant chain wants to automate order processing and inventory management across 12 locations.', notes: '[DEMO] Responded to TikTok ad, scheduled intro call' },
    { id: leadIds.emily, fullName: 'Emily Watson', email: 'emily@purebloomwellness.com', phone: '(503) 555-0134', companyName: 'PureBloom Wellness', projectType: 'Website + AI', projectTimeline: '2-3 months', source: 'social_media', score: 'medium', pipelineStage: 'discovery_scheduled', projectDetails: 'Wellness brand wants a complete website rebuild with AI-powered product recommendations and appointment booking.', assignedTo: allTeam[1]?.id || allTeam[0]?.id, notes: '[DEMO] Discovery call on Friday' },
    { id: leadIds.james, fullName: 'James Thompson', email: 'james@vaultfinancial.co', phone: '(312) 555-0189', companyName: 'Vault Financial Group', projectType: 'AI Agent', projectTimeline: '4-6 months', source: 'word_of_mouth', score: 'high', pipelineStage: 'negotiation', projectDetails: 'Financial advisory firm needs an AI agent that can handle client onboarding, document collection, and preliminary portfolio analysis.', assignedTo: allTeam[0]?.id, notes: '[DEMO] Negotiating scope, wants phased approach' },
    { id: leadIds.alex, fullName: 'Alex Morales', email: 'alex@ridgelineoutdoors.com', phone: '(720) 555-0156', companyName: 'Ridgeline Outdoors', projectType: 'E-commerce Bot', projectTimeline: '1-2 months', source: 'web_form', score: 'low', pipelineStage: 'new_lead', projectDetails: 'Outdoor gear company looking for a chatbot to handle customer service inquiries and product recommendations.', notes: '[DEMO] New lead, needs qualification' },
    { id: leadIds.rachel, fullName: 'Rachel Kim', email: 'rachel@novahealthtech.io', phone: '(858) 555-0171', companyName: 'Nova HealthTech', projectType: 'Full Platform', projectTimeline: '6+ months', source: 'cold_outreach', score: 'high', pipelineStage: 'contract_signed', projectDetails: 'Healthcare startup needs a complete patient engagement platform with AI triage, scheduling, telehealth integration, and HIPAA-compliant messaging.', assignedTo: allTeam[0]?.id, notes: '[DEMO] Contract signed, converting to client' },
  ];

  for (const lead of leads) {
    await sql`
      INSERT INTO leads (id, full_name, email, phone, company_name, project_type, project_timeline, source, score, pipeline_stage, project_details, assigned_to, notes, pipeline_stage_changed_at, is_demo, created_at, updated_at)
      VALUES (${lead.id}, ${lead.fullName}, ${lead.email}, ${lead.phone}, ${lead.companyName}, ${lead.projectType}, ${lead.projectTimeline}, ${lead.source}, ${lead.score}, ${lead.pipelineStage}, ${lead.projectDetails}, ${lead.assignedTo || null}, ${lead.notes}, ${daysAgo(2)}, true, ${daysAgo(14)}, ${daysAgo(1)})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  console.log(`  ✓ ${leads.length} leads created`);

  // ── Contacts (lead interactions) ────────────────────────────────────────

  const contactEntries = [
    { leadId: leadIds.marcus, type: 'call', subject: '[DEMO] Discovery call — 45 min', body: 'Great conversation. Marcus has a clear vision for the AI chatbot. Budget is $15-20k. Wants to start in 2 weeks.', direction: 'outbound' },
    { leadId: leadIds.marcus, type: 'email', subject: '[DEMO] Follow-up after discovery', body: 'Sent recap email with timeline and next steps.', direction: 'outbound' },
    { leadId: leadIds.sarah, type: 'call', subject: '[DEMO] Intro call — 30 min', body: 'Sarah needs a student management system. Currently using spreadsheets for 200+ students. Pain point is parent communication.', direction: 'outbound' },
    { leadId: leadIds.sarah, type: 'email', subject: '[DEMO] Proposal sent', body: 'Sent $18,500 proposal for custom CRM build.', direction: 'outbound' },
    { leadId: leadIds.james, type: 'call', subject: '[DEMO] Scope discussion', body: 'James wants to break the project into 3 phases. Phase 1: client onboarding AI. Phase 2: document processing. Phase 3: portfolio analysis.', direction: 'outbound' },
    { leadId: leadIds.david, type: 'email', subject: '[DEMO] Initial outreach response', body: 'David replied to our TikTok DM. Interested in automation for his restaurant chain. Scheduled intro call for next week.', direction: 'inbound' },
  ];

  for (const c of contactEntries) {
    await sql`
      INSERT INTO contacts (id, lead_id, type, subject, body, direction, is_demo, created_by, created_at)
      VALUES (${uuid()}, ${c.leadId}, ${c.type}, ${c.subject}, ${c.body}, ${c.direction}, true, ${creatorId}, ${daysAgo(Math.floor(Math.random() * 10) + 1)})
    `;
  }
  console.log(`  ✓ ${contactEntries.length} contact log entries created`);

  // ── Clients ─────────────────────────────────────────────────────────────

  const clientIds = { nova: uuid(), maple: uuid(), summit: uuid() };

  const clients = [
    { id: clientIds.nova, email: 'rachel@novahealthtech.io', fullName: 'Rachel Kim', company: 'Nova HealthTech', phone: '(858) 555-0171', notes: '[DEMO] Healthcare startup — full platform build' },
    { id: clientIds.maple, email: 'lisa@maplestreetagency.com', fullName: 'Lisa Nakamura', company: 'Maple Street Agency', phone: '(206) 555-0143', notes: '[DEMO] Marketing agency — AI content tools' },
    { id: clientIds.summit, email: 'omar@summitlogistics.co', fullName: 'Omar Hassan', company: 'Summit Logistics', phone: '(404) 555-0128', notes: '[DEMO] Logistics company — route optimization AI' },
  ];

  for (const client of clients) {
    await sql`
      INSERT INTO clients (id, email, full_name, company, phone, notes, created_by, portal_invite_count, portal_onboarding_complete, portal_access_revoked, is_demo, created_at, updated_at)
      VALUES (${client.id}, ${client.email}, ${client.fullName}, ${client.company}, ${client.phone}, ${client.notes}, ${creatorId}, 0, false, false, true, ${daysAgo(45)}, ${daysAgo(1)})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  console.log(`  ✓ ${clients.length} clients created`);

  // ── Projects ────────────────────────────────────────────────────────────

  const projectIds = { novaP: uuid(), mapleP: uuid(), summitP: uuid() };

  const projectData = [
    {
      id: projectIds.novaP, name: 'Nova Patient Portal', clientId: clientIds.nova,
      description: '[DEMO] HIPAA-compliant patient engagement platform with AI triage, scheduling, and messaging',
      status: 'in_progress', totalValue: '42000', projectType: 'Full Platform',
      startDate: dateStr(daysAgo(60)), targetEndDate: dateStr(daysAgo(-30)),
      phases: [
        { name: 'Discovery & Planning', sort: 1, milestones: [
          { title: 'Requirements gathering', status: 'completed', sort: 1 },
          { title: 'Architecture design', status: 'completed', sort: 2 },
          { title: 'HIPAA compliance audit', status: 'completed', sort: 3 },
        ]},
        { name: 'Core Platform Build', sort: 2, milestones: [
          { title: 'Patient auth & profiles', status: 'completed', sort: 1 },
          { title: 'AI triage chatbot', status: 'completed', sort: 2 },
          { title: 'Appointment scheduling', status: 'in_progress', sort: 3 },
          { title: 'Secure messaging', status: 'pending', sort: 4 },
        ]},
        { name: 'Integration & Testing', sort: 3, milestones: [
          { title: 'EHR integration', status: 'pending', sort: 1, dueDate: dateStr(daysAgo(-10)) },
          { title: 'Telehealth module', status: 'pending', sort: 2, dueDate: dateStr(daysAgo(-20)) },
          { title: 'Security penetration test', status: 'pending', sort: 3, dueDate: dateStr(daysAgo(-25)) },
        ]},
        { name: 'Launch', sort: 4, milestones: [
          { title: 'Staff training', status: 'pending', sort: 1, triggersInvoice: true, invoiceAmount: '10500' },
          { title: 'Go-live & monitoring', status: 'pending', sort: 2 },
        ]},
      ],
    },
    {
      id: projectIds.mapleP, name: 'Maple AI Content Suite', clientId: clientIds.maple,
      description: '[DEMO] AI-powered content generation and social media management tools for marketing agency',
      status: 'in_progress', totalValue: '18500', projectType: 'AI Tools',
      startDate: dateStr(daysAgo(35)), targetEndDate: dateStr(daysAgo(-15)),
      phases: [
        { name: 'Discovery', sort: 1, milestones: [
          { title: 'Content workflow audit', status: 'completed', sort: 1 },
          { title: 'Tool requirements spec', status: 'completed', sort: 2 },
        ]},
        { name: 'AI Engine Build', sort: 2, milestones: [
          { title: 'Blog post generator', status: 'completed', sort: 1 },
          { title: 'Social caption AI', status: 'completed', sort: 2 },
          { title: 'Image prompt generator', status: 'completed', sort: 3 },
          { title: 'Brand voice training', status: 'in_progress', sort: 4 },
        ]},
        { name: 'Dashboard & Launch', sort: 3, milestones: [
          { title: 'Analytics dashboard', status: 'pending', sort: 1 },
          { title: 'Client handoff', status: 'pending', sort: 2, triggersInvoice: true, invoiceAmount: '4625' },
        ]},
      ],
    },
    {
      id: projectIds.summitP, name: 'Summit Route Optimizer', clientId: clientIds.summit,
      description: '[DEMO] AI-powered delivery route optimization reducing fuel costs and delivery times',
      status: 'completed', totalValue: '24000', projectType: 'AI Agent',
      startDate: dateStr(daysAgo(90)), targetEndDate: dateStr(daysAgo(10)), actualEndDate: dateStr(daysAgo(8)),
      phases: [
        { name: 'Discovery', sort: 1, milestones: [
          { title: 'Route data analysis', status: 'completed', sort: 1 },
          { title: 'API integration spec', status: 'completed', sort: 2 },
        ]},
        { name: 'Development', sort: 2, milestones: [
          { title: 'Route optimization engine', status: 'completed', sort: 1 },
          { title: 'Driver mobile app', status: 'completed', sort: 2 },
          { title: 'Real-time tracking', status: 'completed', sort: 3 },
        ]},
        { name: 'Launch', sort: 3, milestones: [
          { title: 'Pilot with 5 drivers', status: 'completed', sort: 1 },
          { title: 'Full fleet rollout', status: 'completed', sort: 2 },
          { title: 'Performance report', status: 'completed', sort: 3 },
        ]},
      ],
    },
  ];

  for (const proj of projectData) {
    await sql`
      INSERT INTO projects (id, name, client_id, description, status, total_value, project_type, pricing_type, start_date, target_end_date, actual_end_date, is_demo, created_by, created_at, updated_at)
      VALUES (${proj.id}, ${proj.name}, ${proj.clientId}, ${proj.description}, ${proj.status}, ${proj.totalValue}, ${proj.projectType}, 'phased', ${proj.startDate}, ${proj.targetEndDate}, ${proj.actualEndDate || null}, true, ${creatorId}, ${daysAgo(60)}, ${daysAgo(1)})
      ON CONFLICT (id) DO NOTHING
    `;

    for (const phase of proj.phases) {
      const phaseId = uuid();
      const allCompleted = phase.milestones.every(m => m.status === 'completed');
      await sql`
        INSERT INTO project_phases (id, project_id, name, sort_order, completed_at, created_at)
        VALUES (${phaseId}, ${proj.id}, ${phase.name}, ${phase.sort}, ${allCompleted ? daysAgo(5) : null}, ${daysAgo(55)})
      `;

      for (const ms of phase.milestones) {
        await sql`
          INSERT INTO project_milestones (id, project_id, phase_id, title, status, sort_order, due_date, completed_at, triggers_invoice, invoice_amount, created_at, updated_at)
          VALUES (${uuid()}, ${proj.id}, ${phaseId}, ${ms.title}, ${ms.status}, ${ms.sort}, ${ms.dueDate || null}, ${ms.status === 'completed' ? daysAgo(Math.floor(Math.random() * 20) + 3) : null}, ${ms.triggersInvoice || false}, ${ms.invoiceAmount || null}, ${daysAgo(50)}, ${daysAgo(1)})
        `;
      }
    }
  }
  console.log(`  ✓ ${projectData.length} projects with phases & milestones created`);

  // ── Proposals ───────────────────────────────────────────────────────────

  const proposalIds = { novaProposal: uuid(), mapleProposal: uuid(), sarahProposal: uuid() };

  const proposalData = [
    {
      id: proposalIds.novaProposal, clientId: clientIds.nova, title: 'Nova HealthTech — Patient Portal Platform',
      status: 'accepted', totalAmount: '42000', sentAt: daysAgo(65), viewedAt: daysAgo(64), acceptedAt: daysAgo(62),
      scopeOfWork: '<p>[DEMO] Full-stack patient engagement platform including AI-powered triage, appointment scheduling, secure messaging, telehealth integration, and HIPAA compliance throughout.</p>',
      deliverables: '<p>Patient portal web app, AI triage chatbot, appointment system, secure messaging, EHR integration, telehealth module, admin dashboard, staff training.</p>',
      terms: '<p>Payment: 25% upfront, 25% at Phase 2 completion, 25% at Phase 3 completion, 25% at launch. 90-day warranty on all deliverables.</p>',
      lineItems: [
        { desc: 'Discovery & HIPAA Compliance Audit', qty: 1, price: 6000 },
        { desc: 'Core Platform Development (Auth, AI Triage, Scheduling)', qty: 1, price: 16000 },
        { desc: 'Integration & Testing (EHR, Telehealth, Security)', qty: 1, price: 12000 },
        { desc: 'Launch, Training & Post-Launch Support', qty: 1, price: 8000 },
      ],
    },
    {
      id: proposalIds.mapleProposal, clientId: clientIds.maple, title: 'Maple Street — AI Content Generation Suite',
      status: 'accepted', totalAmount: '18500', sentAt: daysAgo(40), viewedAt: daysAgo(39), acceptedAt: daysAgo(37),
      scopeOfWork: '<p>[DEMO] AI-powered content generation suite tailored for marketing agencies. Includes blog post generator, social media caption AI, image prompt builder, and brand voice customization.</p>',
      deliverables: '<p>AI content dashboard, blog generator, social caption tool, image prompt tool, brand voice training module, analytics dashboard.</p>',
      terms: '<p>Payment: 50% upfront, 50% at delivery. 60-day warranty. Content generation API costs billed separately at usage rates.</p>',
      lineItems: [
        { desc: 'Discovery & Content Workflow Audit', qty: 1, price: 3000 },
        { desc: 'AI Engine Development (Blog, Social, Image)', qty: 1, price: 10000 },
        { desc: 'Dashboard, Brand Training & Launch', qty: 1, price: 5500 },
      ],
    },
    {
      id: proposalIds.sarahProposal, leadId: leadIds.sarah, title: 'BrightPath Academy — Student Management CRM',
      status: 'sent', totalAmount: '18500', sentAt: daysAgo(3), viewedAt: daysAgo(2),
      scopeOfWork: '<p>[DEMO] Custom student management system for BrightPath Academy with automated enrollment, progress tracking, grade management, and a parent communication portal.</p>',
      deliverables: '<p>Student CRM dashboard, enrollment automation, progress tracker, grade book, parent portal, notification system, mobile-responsive design.</p>',
      terms: '<p>Payment: 30% upfront, 40% at beta, 30% at launch. 90-day warranty on all features.</p>',
      lineItems: [
        { desc: 'Discovery & Requirements Analysis', qty: 1, price: 2500 },
        { desc: 'Core CRM Build (Enrollment, Progress, Grades)', qty: 1, price: 9000 },
        { desc: 'Parent Portal & Communication System', qty: 1, price: 4500 },
        { desc: 'Testing, Launch & Training', qty: 1, price: 2500 },
      ],
    },
  ];

  for (const prop of proposalData) {
    await sql`
      INSERT INTO proposals (id, lead_id, client_id, title, scope_of_work, deliverables, terms_and_conditions, pricing_type, total_amount, status, sent_at, viewed_at, accepted_at, ai_generated, is_demo, created_by, created_at, updated_at)
      VALUES (${prop.id}, ${prop.leadId || null}, ${prop.clientId || null}, ${prop.title}, ${prop.scopeOfWork}, ${prop.deliverables}, ${prop.terms}, 'phased', ${prop.totalAmount}, ${prop.status}, ${prop.sentAt || null}, ${prop.viewedAt || null}, ${prop.acceptedAt || null}, true, true, ${creatorId}, ${daysAgo(70)}, ${daysAgo(1)})
      ON CONFLICT (id) DO NOTHING
    `;

    for (let i = 0; i < prop.lineItems.length; i++) {
      const li = prop.lineItems[i];
      await sql`
        INSERT INTO proposal_line_items (id, proposal_id, description, quantity, unit_price, total, sort_order, created_at)
        VALUES (${uuid()}, ${prop.id}, ${li.desc}, ${li.qty}, ${li.price}, ${li.qty * li.price}, ${i + 1}, ${daysAgo(70)})
      `;
    }
  }
  console.log(`  ✓ ${proposalData.length} proposals with line items created`);

  // ── Invoices ────────────────────────────────────────────────────────────

  const invoiceData = [
    {
      clientId: clientIds.nova, projectId: projectIds.novaP, title: 'Nova HealthTech — Phase 1 Deposit',
      description: '[DEMO] 25% upfront deposit for patient portal project', amount: '10500',
      status: 'paid', sentAt: daysAgo(58), paidAt: daysAgo(55), dueDate: dateStr(daysAgo(48)),
      lineItems: [{ desc: 'Project deposit — 25% of $42,000', qty: 1, price: 10500 }],
    },
    {
      clientId: clientIds.nova, projectId: projectIds.novaP, title: 'Nova HealthTech — Phase 2 Milestone',
      description: '[DEMO] Core platform build completion payment', amount: '10500',
      status: 'sent', sentAt: daysAgo(5), dueDate: dateStr(daysAgo(-10)),
      lineItems: [{ desc: 'Phase 2 completion — Core Platform Build', qty: 1, price: 10500 }],
    },
    {
      clientId: clientIds.maple, projectId: projectIds.mapleP, title: 'Maple Street — 50% Upfront',
      description: '[DEMO] Initial payment for AI content suite', amount: '9250',
      status: 'paid', sentAt: daysAgo(35), paidAt: daysAgo(33), dueDate: dateStr(daysAgo(25)),
      lineItems: [{ desc: 'Upfront payment — 50% of $18,500', qty: 1, price: 9250 }],
    },
    {
      clientId: clientIds.summit, projectId: projectIds.summitP, title: 'Summit Logistics — Final Payment',
      description: '[DEMO] Final delivery payment for route optimizer', amount: '12000',
      status: 'paid', sentAt: daysAgo(12), paidAt: daysAgo(10), dueDate: dateStr(daysAgo(2)),
      lineItems: [
        { desc: 'Phase 2 completion — Development', qty: 1, price: 8000 },
        { desc: 'Phase 3 completion — Launch & Rollout', qty: 1, price: 4000 },
      ],
    },
    {
      clientId: clientIds.summit, projectId: projectIds.summitP, title: 'Summit Logistics — Initial Payment',
      description: '[DEMO] Upfront deposit for route optimization project', amount: '12000',
      status: 'paid', sentAt: daysAgo(88), paidAt: daysAgo(85), dueDate: dateStr(daysAgo(78)),
      lineItems: [{ desc: 'Project deposit — 50% of $24,000', qty: 1, price: 12000 }],
    },
  ];

  for (const inv of invoiceData) {
    const invId = uuid();
    const totalAmount = inv.lineItems.reduce((sum, li) => sum + li.qty * li.price, 0);
    await sql`
      INSERT INTO invoices (id, client_id, project_id, title, description, amount, status, sent_at, paid_at, due_date, is_demo, created_by, created_at, updated_at)
      VALUES (${invId}, ${inv.clientId}, ${inv.projectId}, ${inv.title}, ${inv.description}, ${String(totalAmount)}, ${inv.status}, ${inv.sentAt || null}, ${inv.paidAt || null}, ${inv.dueDate || null}, true, ${creatorId}, ${daysAgo(90)}, ${daysAgo(1)})
    `;

    for (let i = 0; i < inv.lineItems.length; i++) {
      const li = inv.lineItems[i];
      await sql`
        INSERT INTO invoice_line_items (id, invoice_id, description, quantity, unit_price, total, sort_order, created_at)
        VALUES (${uuid()}, ${invId}, ${li.desc}, ${li.qty}, ${li.price}, ${li.qty * li.price}, ${i + 1}, ${daysAgo(90)})
      `;
    }

    // Create payment for paid invoices
    if (inv.status === 'paid' && inv.paidAt) {
      await sql`
        INSERT INTO payments (id, invoice_id, client_id, amount, method, is_demo, paid_at, created_at)
        VALUES (${uuid()}, ${invId}, ${inv.clientId}, ${String(totalAmount)}, 'square_invoice', true, ${inv.paidAt}, ${inv.paidAt})
      `;
    }
  }
  console.log(`  ✓ ${invoiceData.length} invoices with line items & payments created`);

  // ── Services ────────────────────────────────────────────────────────────

  const serviceData = [
    { clientId: clientIds.nova, projectId: projectIds.novaP, serviceName: 'Supabase Pro', provider: 'Supabase', category: 'hosting', monthlyCost: '25', notes: '[DEMO] Database & auth for patient portal' },
    { clientId: clientIds.nova, projectId: projectIds.novaP, serviceName: 'Vercel Pro', provider: 'Vercel', category: 'hosting', monthlyCost: '20', notes: '[DEMO] Hosting for patient portal' },
    { clientId: clientIds.nova, projectId: projectIds.novaP, serviceName: 'Anthropic Usage', provider: 'Anthropic', category: 'api', monthlyCost: '50', notes: '[DEMO] AI triage chatbot API' },
    { clientId: clientIds.nova, projectId: projectIds.novaP, serviceName: 'Resend Pro', provider: 'Resend', category: 'email', monthlyCost: '20', notes: '[DEMO] Patient notification emails' },
    { clientId: clientIds.maple, projectId: projectIds.mapleP, serviceName: 'Vercel Pro', provider: 'Vercel', category: 'hosting', monthlyCost: '20', notes: '[DEMO] Hosting for content suite' },
    { clientId: clientIds.maple, projectId: projectIds.mapleP, serviceName: 'Anthropic Usage', provider: 'Anthropic', category: 'api', monthlyCost: '75', notes: '[DEMO] Heavy AI content generation' },
    { clientId: clientIds.summit, projectId: projectIds.summitP, serviceName: 'Supabase Pro', provider: 'Supabase', category: 'hosting', monthlyCost: '25', notes: '[DEMO] Database for route data' },
    { clientId: clientIds.summit, projectId: projectIds.summitP, serviceName: 'Google APIs Usage', provider: 'Google APIs', category: 'api', monthlyCost: '35', notes: '[DEMO] Maps API for route optimization' },
  ];

  for (const svc of serviceData) {
    await sql`
      INSERT INTO client_services (id, client_id, project_id, service_name, provider, category, monthly_cost, status, notes, is_demo, created_at, updated_at)
      VALUES (${uuid()}, ${svc.clientId}, ${svc.projectId}, ${svc.serviceName}, ${svc.provider}, ${svc.category}, ${svc.monthlyCost}, 'active', ${svc.notes}, true, ${daysAgo(30)}, ${daysAgo(1)})
    `;
  }
  console.log(`  ✓ ${serviceData.length} tracked services created`);

  // ── Activity Log ────────────────────────────────────────────────────────

  const activities = [
    { action: 'lead.created', entityType: 'lead', entityId: leadIds.alex, metadata: { demo: 'true', leadName: 'Alex Morales', source: 'web_form' }, ago: 1 },
    { action: 'lead.stage_changed', entityType: 'lead', entityId: leadIds.emily, metadata: { demo: 'true', from: 'contacted', to: 'discovery_scheduled' }, ago: 2 },
    { action: 'proposal.sent', entityType: 'proposal', entityId: proposalIds.sarahProposal, metadata: { demo: 'true', title: 'BrightPath Academy — Student Management CRM' }, ago: 3 },
    { action: 'milestone.completed', entityType: 'project', entityId: projectIds.novaP, metadata: { demo: 'true', milestone: 'AI triage chatbot', project: 'Nova Patient Portal' }, ago: 4 },
    { action: 'payment.received', entityType: 'client', entityId: clientIds.summit, metadata: { demo: 'true', amount: 12000, client: 'Summit Logistics' }, ago: 5 },
    { action: 'lead.stage_changed', entityType: 'lead', entityId: leadIds.james, metadata: { demo: 'true', from: 'proposal_sent', to: 'negotiation' }, ago: 6 },
    { action: 'project.status_changed', entityType: 'project', entityId: projectIds.summitP, metadata: { demo: 'true', from: 'in_progress', to: 'completed', project: 'Summit Route Optimizer' }, ago: 8 },
    { action: 'milestone.completed', entityType: 'project', entityId: projectIds.mapleP, metadata: { demo: 'true', milestone: 'Image prompt generator', project: 'Maple AI Content Suite' }, ago: 9 },
    { action: 'lead.created', entityType: 'lead', entityId: leadIds.david, metadata: { demo: 'true', leadName: 'David Park', source: 'tiktok' }, ago: 10 },
    { action: 'proposal.accepted', entityType: 'proposal', entityId: proposalIds.mapleProposal, metadata: { demo: 'true', title: 'Maple Street — AI Content Generation Suite' }, ago: 12 },
    { action: 'service.scan', entityType: 'project', entityId: projectIds.novaP, metadata: { demo: 'true', servicesFound: 4, newServices: 4 }, ago: 14 },
  ];

  for (const act of activities) {
    await sql`
      INSERT INTO activity_log (id, actor_id, actor_type, action, entity_type, entity_id, metadata, is_demo, created_at)
      VALUES (${uuid()}, ${creatorId}, 'team', ${act.action}, ${act.entityType}, ${act.entityId}, ${JSON.stringify(act.metadata)}, true, ${daysAgo(act.ago)})
    `;
  }
  console.log(`  ✓ ${activities.length} activity log entries created`);

  // ── AI Analysis for top lead ────────────────────────────────────────────

  const aiAnalysis = {
    score: 'high',
    reasoning: 'Strong budget indication ($15-20k), clear project vision, established business with existing customer base. High likelihood of conversion.',
    opportunities: ['Upsell maintenance plan', 'Potential for Phase 2 expansion to mobile app', 'Referral opportunity in interior design industry'],
    risks: ['Competitive space — other AI chatbot vendors may be bidding', 'Timeline may be tight for full customization'],
    suggestedNextSteps: ['Send proposal within 48 hours', 'Include case study from similar retail/design project', 'Offer a quick prototype demo'],
  };

  await sql`
    UPDATE leads
    SET ai_internal_analysis = ${JSON.stringify(aiAnalysis)},
        ai_prospect_summary = ${'High-value lead with clear vision for AI chatbot. Budget $15-20k, wants to start in 2 weeks. Strong conversion potential.'}
    WHERE id = ${leadIds.marcus}
  `;
  console.log('  ✓ AI analysis added to Marcus Rivera lead');

  // ── Done ────────────────────────────────────────────────────────────────

  console.log('\n✅ Demo data seeded successfully!');
  console.log('\nSummary:');
  console.log('  7 leads (across all pipeline stages)');
  console.log('  3 clients');
  console.log('  3 projects (1 in progress at 50%, 1 in progress at 75%, 1 completed)');
  console.log('  3 proposals (2 accepted, 1 sent/pending)');
  console.log('  5 invoices (3 paid, 1 sent, 1 draft)');
  console.log('  8 tracked services');
  console.log('  11 activity log entries');
  console.log('\nTo reset: node src/lib/db/seed-demo.mjs --reset');
  console.log('To reset + reseed: node src/lib/db/seed-demo.mjs --reset');

  await sql.end();
  process.exit(0);
}

seedDemo().catch((err) => {
  console.error('Demo seed failed:', err);
  process.exit(1);
});
