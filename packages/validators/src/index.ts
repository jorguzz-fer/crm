import { z } from "zod";

export { z };

// PII redaction helpers (LGPD)
export * from "./pii";

export const emailSchema = z.string().email().max(200);

export const slugSchema = z
  .string()
  .min(2)
  .max(50)
  .regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífens");

export const passwordSchema = z.string().min(10).max(200);

export const cuidSchema = z.string().cuid();

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// ─── CRM core ─────────────────────────────────────────────────────────────────

export const leadStatusValues = ["NOVO", "EM_CONTATO", "QUALIFICADO", "DESQUALIFICADO", "CONVERTIDO"] as const;
export const leadSourceValues = ["WEBSITE", "WHATSAPP", "INSTAGRAM", "FACEBOOK", "INDICACAO", "EVENTO", "COLD_OUTREACH", "OUTRO"] as const;
export const opportunityStatusValues = ["ABERTA", "GANHA", "PERDIDA"] as const;
export const activityTypeValues = ["LIGACAO", "EMAIL", "REUNIAO", "WHATSAPP", "VISITA", "OUTRO"] as const;
export const priorityValues = ["BAIXA", "MEDIA", "ALTA", "URGENTE"] as const;

export const createLeadSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email().max(200).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  company: z.string().max(200).optional().or(z.literal("")),
  source: z.enum(leadSourceValues).default("OUTRO"),
  status: z.enum(leadStatusValues).default("NOVO"),
  assignedTo: z.string().cuid().optional().or(z.literal("")),
  companyId: z.string().cuid().optional().or(z.literal("")),
});

export const updateLeadSchema = createLeadSchema.partial();

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

export const createCompanySchema = z.object({
  name: z.string().min(2).max(200),
  cnpj: z.string().max(20).optional().or(z.literal("")),
  website: z.string().url().max(300).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  email: z.string().email().max(200).optional().or(z.literal("")),
  industry: z.string().max(100).optional().or(z.literal("")),
});

export const updateCompanySchema = createCompanySchema.partial();

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

export const createContactSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email().max(200).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  role: z.string().max(100).optional().or(z.literal("")),
  companyId: z.string().cuid().optional().or(z.literal("")),
});

export const updateContactSchema = createContactSchema.partial();

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

export const createOpportunitySchema = z.object({
  title: z.string().min(2).max(300),
  pipelineId: z.string().cuid(),
  stageId: z.string().cuid(),
  value: z.coerce.number().min(0).max(999_999_999).optional(),
  probability: z.coerce.number().int().min(0).max(100).default(0),
  expectedCloseAt: z.string().datetime().optional().or(z.literal("")),
  leadId: z.string().cuid().optional().or(z.literal("")),
  companyId: z.string().cuid().optional().or(z.literal("")),
  contactId: z.string().cuid().optional().or(z.literal("")),
  assignedTo: z.string().cuid().optional().or(z.literal("")),
});

export const updateOpportunitySchema = createOpportunitySchema.partial();
export const moveOpportunitySchema = z.object({
  stageId: z.string().cuid(),
});

export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;
export type UpdateOpportunityInput = z.infer<typeof updateOpportunitySchema>;

export const createActivitySchema = z.object({
  type: z.enum(activityTypeValues),
  subject: z.string().min(2).max(300),
  description: z.string().max(2000).optional().or(z.literal("")),
  duration: z.coerce.number().int().min(1).max(1440).optional(),
  occurredAt: z.string().datetime().optional(),
  leadId: z.string().cuid().optional().or(z.literal("")),
  companyId: z.string().cuid().optional().or(z.literal("")),
  contactId: z.string().cuid().optional().or(z.literal("")),
  opportunityId: z.string().cuid().optional().or(z.literal("")),
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;

export const createTaskSchema = z.object({
  title: z.string().min(2).max(300),
  description: z.string().max(1000).optional().or(z.literal("")),
  dueAt: z.string().datetime().optional().or(z.literal("")),
  priority: z.enum(priorityValues).default("MEDIA"),
  assignedTo: z.string().cuid(),
  leadId: z.string().cuid().optional().or(z.literal("")),
  opportunityId: z.string().cuid().optional().or(z.literal("")),
});

export const updateTaskSchema = createTaskSchema.partial();

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const createNoteSchema = z.object({
  content: z.string().min(1).max(5000),
  leadId: z.string().cuid().optional().or(z.literal("")),
  companyId: z.string().cuid().optional().or(z.literal("")),
  contactId: z.string().cuid().optional().or(z.literal("")),
  opportunityId: z.string().cuid().optional().or(z.literal("")),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
