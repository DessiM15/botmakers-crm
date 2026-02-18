import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const leadFormSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  projectType: z.string().optional(),
  projectTimeline: z.string().optional(),
  existingSystems: z.string().optional(),
  referralSource: z.string().optional(),
  preferredContact: z.enum(['email', 'phone', 'sms']).default('email'),
  projectDetails: z.string().optional(),
  smsConsent: z.boolean().default(false),
});

export const projectCreateSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  clientId: z.string().uuid('Valid client is required'),
  proposalId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  projectType: z.string().optional(),
  description: z.string().optional(),
  pricingType: z.enum(['fixed', 'phased', 'hourly']).default('fixed'),
  totalValue: z.coerce.number().min(0).default(0),
  startDate: z.string().optional(),
  targetEndDate: z.string().optional(),
});

export const proposalCreateSchema = z.object({
  leadId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  title: z.string().min(1, 'Title is required'),
  scopeOfWork: z.string().min(1, 'Scope of work is required'),
  deliverables: z.string().min(1, 'Deliverables are required'),
  termsAndConditions: z.string().min(1, 'Terms are required'),
  pricingType: z.enum(['fixed', 'phased', 'hourly']).default('fixed'),
  totalAmount: z.coerce.number().min(0).default(0),
  expiresAt: z.string().optional(),
  lineItems: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.coerce.number().min(0).default(1),
        unitPrice: z.coerce.number().min(0).default(0),
        total: z.coerce.number().min(0).default(0),
        sortOrder: z.coerce.number().default(0),
        phaseLabel: z.string().optional(),
      })
    )
    .optional(),
});

export const invoiceCreateSchema = z.object({
  clientId: z.string().uuid('Valid client is required'),
  projectId: z.string().uuid().optional(),
  milestoneId: z.string().uuid().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  amount: z.coerce.number().min(0).default(0),
  dueDate: z.string().optional(),
  lineItems: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.coerce.number().min(0).default(1),
        unitPrice: z.coerce.number().min(0).default(0),
        total: z.coerce.number().min(0).default(0),
        sortOrder: z.coerce.number().default(0),
      })
    )
    .optional(),
});

export const milestoneUpdateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'overdue']).optional(),
  dueDate: z.string().optional(),
  triggersInvoice: z.boolean().optional(),
  invoiceAmount: z.coerce.number().min(0).optional(),
});

export const questionSubmitSchema = z.object({
  projectId: z.string().uuid('Valid project is required'),
  questionText: z.string().min(1, 'Question text is required'),
});

export const repoLinkSchema = z.object({
  projectId: z.string().uuid('Valid project is required'),
  githubOwner: z.string().min(1, 'GitHub owner is required'),
  githubRepo: z.string().min(1, 'Repository name is required'),
  githubUrl: z.string().url('Valid URL is required'),
  defaultBranch: z.string().default('main'),
});

export const clientCreateSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  company: z.string().optional(),
  phone: z.string().optional(),
});

export const clientUpdateSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').optional(),
  email: z.string().email('Valid email is required').optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export const generateEmailSchema = z.object({
  recipientName: z.string().min(1, 'Recipient name is required'),
  recipientEmail: z.string().email('Valid email is required'),
  recipientCompany: z.string().optional(),
  category: z.enum([
    'follow_up',
    'introduction',
    'proposal_follow_up',
    'check_in',
    'thank_you',
    'project_update',
    'holiday',
    'win_back',
    'referral_request',
  ]),
  holidayType: z.string().optional(),
  tone: z.enum(['professional', 'friendly', 'casual']).default('professional'),
  customInstructions: z.string().optional(),
  senderName: z.string().min(1, 'Sender name is required'),
  recipientHistory: z.string().optional(),
});

export const saveDraftSchema = z.object({
  id: z.string().uuid().optional(),
  recipientEmail: z.string().email('Valid email is required'),
  recipientName: z.string().optional(),
  recipientLeadId: z.string().uuid().optional().nullable(),
  recipientClientId: z.string().uuid().optional().nullable(),
  subject: z.string().optional(),
  bodyHtml: z.string().optional(),
  bodyText: z.string().optional(),
  category: z.string().optional(),
  tone: z.string().optional(),
  customInstructions: z.string().optional(),
});

export const contactLogSchema = z.object({
  leadId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  type: z.enum(['email', 'phone', 'sms', 'meeting', 'note']),
  subject: z.string().optional(),
  body: z.string().optional(),
  direction: z.enum(['inbound', 'outbound']).default('outbound'),
});
