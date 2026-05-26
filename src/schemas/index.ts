import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  name: z.string().optional(),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
  role: z.enum(["CANDIDATE", "PROFESSIONAL"]).optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

export const professionalSchema = z.object({
  bio: z.string().optional(),
  location: z.string().optional(),
  pricePerHour: z.number().positive().optional(),
  categories: z.string().optional(),
  gender: z.enum(["M", "F"]).optional().nullable(),
  isAccessible: z.boolean().optional(),
});

export const appointmentSchema = z.object({
  professionalId: z.number().int().positive(),
  serviceType: z.string().min(1, "Tipo de serviço obrigatório"),
  scheduledAt: z.string().min(1, "Data obrigatória"),
  notes: z.string().optional(),
});

export const reviewSchema = z.object({
  appointmentId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5, "Nota deve ser entre 1 e 5"),
  comment: z.string().optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "CANCELLED", "COMPLETED"]),
});
