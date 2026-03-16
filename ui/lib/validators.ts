import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const messageInputSchema = z.object({
  content: z.string().trim().min(1, "Message cannot be empty.").max(8000),
});

export const vncSettingsSchema = z.object({
  host: z.string().trim().min(1, "Host is required."),
  port: z.coerce.number().int().min(1).max(65535),
  password: z.string().optional(),
  label: z.string().trim().min(1).max(80),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type MessageInputValues = z.infer<typeof messageInputSchema>;
export type VncSettingsValues = z.infer<typeof vncSettingsSchema>;
