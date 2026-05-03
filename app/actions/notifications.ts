"use server";

import {createClient} from "@/lib/supabase/server";
import {revalidatePath} from "next/cache";
import {z} from "zod";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

const MarkSchema = z.object({
    notification_id: z.string().uuid(),
});

export async function markNotificationReadAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = MarkSchema.safeParse({
        notification_id: formData.get("notification_id"),
    });
    if (!parsed.success) return {ok: false, error: "Paramètres invalides"};

    const supabase = await createClient();
    const {error} = await supabase.rpc("mark_notification_read", {
        p_notification_id: parsed.data.notification_id,
    });
    if (error) {
        console.error("mark_notification_read failed:", error);
        return {ok: false, error: "Erreur."};
    }
    revalidatePath("/notifications");
    return {ok: true};
}

export async function markAllNotificationsReadAction(): Promise<
    ActionResult<{ count: number }>
> {
    const supabase = await createClient();
    const {data, error} = await supabase
        .rpc("mark_all_notifications_read")
        .single();
    if (error) {
        console.error("mark_all failed:", error);
        return {ok: false, error: "Erreur."};
    }
    revalidatePath("/notifications");
    return {ok: true, data: {count: (data as unknown as number) ?? 0}};
}