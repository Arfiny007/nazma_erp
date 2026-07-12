import { UserLifecycleStatus, UserRole } from "@prisma/client";
import { z } from "zod";

const emailSchema = z
  .string()
  .min(1, { message: "userManagement.validation.emailRequired" })
  .email({ message: "userManagement.validation.emailInvalid" })
  .transform((value) => value.trim().toLowerCase());

const nameSchema = z
  .string()
  .min(2, { message: "userManagement.validation.nameMin" })
  .max(120, { message: "userManagement.validation.nameMax" });

export const createUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  role: z.nativeEnum(UserRole, {
    message: "userManagement.validation.roleInvalid",
  }),
  managerId: z.string().uuid().optional().nullable(),
  territoryIds: z.array(z.string().min(1)).optional().default([]),
  phone: z.string().max(30).optional().nullable(),
  employeeCode: z.string().max(40).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  /** When true, user is created in INVITED state (manager SR draft). */
  draftOnly: z.boolean().optional().default(false),
});

export const updateUserSchema = z.object({
  userId: z.string().uuid({ message: "userManagement.validation.userIdInvalid" }),
  name: nameSchema.optional(),
  role: z.nativeEnum(UserRole).optional(),
  managerId: z.string().uuid().nullable().optional(),
  territoryIds: z.array(z.string().min(1)).optional(),
  phone: z.string().max(30).nullable().optional(),
  employeeCode: z.string().max(40).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  lifecycleStatus: z.nativeEnum(UserLifecycleStatus).optional(),
});

export const userIdentifierSchema = z.object({
  userId: z.string().uuid({ message: "userManagement.validation.userIdInvalid" }),
});

export const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  role: z.nativeEnum(UserRole).optional(),
  lifecycleStatus: z.nativeEnum(UserLifecycleStatus).optional(),
  territoryId: z.string().min(1).optional(),
  sortBy: z.enum(["name", "email", "role", "lifecycleStatus", "createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const searchUsersSchema = z.object({
  query: z.string().trim().min(1).max(120),
  role: z.nativeEnum(UserRole).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
export type SearchUsersInput = z.infer<typeof searchUsersSchema>;
