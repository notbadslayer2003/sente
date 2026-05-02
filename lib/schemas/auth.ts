import { z } from "zod";

export const SignupRoleSchema = z.enum(["pecheur", "etang", "magasin"]);
export type SignupRole = z.infer<typeof SignupRoleSchema>;

export const PaysSignupSchema = z.enum(["BE", "FR"]);
export type PaysSignup = z.infer<typeof PaysSignupSchema>;

export const SignupSchema = z
    .object({
        role: SignupRoleSchema,
        email: z.string().email("Email invalide"),
        password: z
            .string()
            .min(8, "Mot de passe trop court (8 caractères minimum)")
            .max(72, "Mot de passe trop long"),
        firstName: z.string().min(1, "Prénom requis").max(50, "Prénom trop long"),
        lastName: z.string().min(1, "Nom requis").max(50, "Nom trop long"),
        // Org-only
        orgName: z.string().max(200).optional(),
        orgCountry: PaysSignupSchema.optional(),
        consentTos: z.literal(true, { message: "Vous devez accepter les CGU" }),
    })
    .refine(
        (data) =>
            data.role === "pecheur" ||
            (data.orgName && data.orgName.trim().length >= 2),
        {
            message: "Nom de l'étang ou du magasin requis",
            path: ["orgName"],
        }
    )
    .refine((data) => data.role === "pecheur" || !!data.orgCountry, {
        message: "Pays requis",
        path: ["orgCountry"],
    });

export type SignupInput = z.infer<typeof SignupSchema>;

// Schemas existants (login, forgot, reset) inchangés — garde-les
export const LoginSchema = z.object({
    email: z.string().email("Email invalide"),
    password: z.string().min(1, "Mot de passe requis"),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const ForgotPasswordSchema = z.object({
    email: z.string().email("Email invalide"),
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z
    .object({
        password: z
            .string()
            .min(8, "Mot de passe trop court (8 caractères minimum)")
            .max(72, "Mot de passe trop long"),
        passwordConfirm: z.string(),
    })
    .refine((data) => data.password === data.passwordConfirm, {
        message: "Les mots de passe ne correspondent pas",
        path: ["passwordConfirm"],
    });
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;