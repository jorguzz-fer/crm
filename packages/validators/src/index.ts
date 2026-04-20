import { z } from "zod";

// Schemas comuns compartilhados entre apps/web e futura Chrome extension
// Fase 2+: adicionar Lead, Account, Contact, Opportunity, etc.

export { z };

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
