import { z } from "zod"

/**
 * Zod schemas for settings forms. Mirrors the pattern in
 * `apps/app/components/auth/schemas.ts` — all forms in this app validate on submit
 * via `validators: { onSubmit: <schema> }` from TanStack Form.
 *
 * Names follow `better-auth` field constraints where applicable:
 * - `name`: better-auth accepts up to ~255 chars (schema is permissive on purpose)
 * - `newEmail`: validated by zod's email format
 * - `currentPassword` / `newPassword`: better-auth requires `currentPassword` for
 *   `changePassword` and a min length on the new one
 */
export const profileSchema = z.object({
	name: z
		.string()
		.min(2, "Name must be at least 2 characters")
		.max(255, "Name is too long")
		.trim(),
})

export const changeEmailSchema = z.object({
	newEmail: z.email("Enter a valid email address"),
})

export const changePasswordSchema = z
	.object({
		currentPassword: z
			.string()
			.min(1, "Enter your current password"),
		newPassword: z
			.string()
			.min(8, "New password must be at least 8 characters"),
		confirmPassword: z.string(),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	})
	.refine((data) => data.newPassword !== data.currentPassword, {
		message: "New password must differ from the current one",
		path: ["newPassword"],
	})

export const deleteAccountSchema = z.object({
	confirm: z.string().refine((value) => value === "DELETE", {
		message: 'Type "DELETE" exactly to confirm',
	}),
	password: z.string().min(1, "Enter your password"),
})
