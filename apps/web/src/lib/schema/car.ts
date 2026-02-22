import { z } from "zod";

export const CarSchema = z.object({
  id: z.string().min(1),
  stockNo: z.string().min(1).max(64),
  maker: z.string().min(1).max(64),
  model: z.string().min(1).max(64),
  year: z.coerce.number().int().min(1950).max(2100),
  price: z.coerce.number().int().min(0).max(1_000_000_000),
  status: z.enum(["available", "reserved", "sold"]),
  updatedAt: z.string().datetime(),
});

export type Car = z.infer<typeof CarSchema>;

export const CarUpsertSchema = z.object({
  stockNo: z.string().min(1).max(64),
  maker: z.string().min(1).max(64),
  model: z.string().min(1).max(64),
  year: z.coerce.number().int().min(1950).max(2100),
  price: z.coerce.number().int().min(0).max(1_000_000_000),
  status: z.enum(["available", "reserved", "sold"]),
});

export type CarUpsertInput = z.infer<typeof CarUpsertSchema>;

export const CarListQuerySchema = z.object({
  q: z.string().optional(),
  status: z.enum(["all", "available", "reserved", "sold"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(200).default(50),
});

export type CarListQuery = z.infer<typeof CarListQuerySchema>;
