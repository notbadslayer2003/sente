"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { detectCircumvention } from "@/lib/marketplace/circumvention";

// =============================================================================
// Server Actions : threads (création + envoi de messages)
// =============================================================================

type ActionResult<T = void> =
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string } };

const startThreadMessageSchema = z.object({
    listingId: z.string().uuid(),
    body: z.string().min(1).max(2000),
});

const sendMessageSchema = z.object({
    threadId: z.string().uuid(),
    body: z.string().min(1).max(2000),
});

async function requireUser() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("UNAUTHENTICATED");
    return { supabase, user };
}

async function findOrCreateThread(
    supabase: Awaited<ReturnType<typeof createClient>>,
    listingId: string,
    buyerId: string
): Promise<
    | { ok: true; threadId: string; created: boolean }
    | { ok: false; code: string; message: string }
> {
    const { data: listing } = await supabase
        .from("marketplace_listings")
        .select("id, seller_user_id, status, deleted_at")
        .eq("id", listingId)
        .maybeSingle();

    if (!listing || listing.deleted_at !== null) {
        return { ok: false, code: "LISTING_NOT_FOUND", message: "Annonce introuvable" };
    }
    if (listing.status !== "active" && listing.status !== "reserved") {
        return {
            ok: false,
            code: "LISTING_UNAVAILABLE",
            message: "Cette annonce n'est plus disponible",
        };
    }
    if (listing.seller_user_id === buyerId) {
        return {
            ok: false,
            code: "SELF_THREAD",
            message: "Tu ne peux pas contacter ta propre annonce",
        };
    }

    const { data: existing } = await supabase
        .from("marketplace_threads")
        .select("id")
        .eq("listing_id", listingId)
        .eq("buyer_user_id", buyerId)
        .maybeSingle();

    if (existing) {
        return { ok: true, threadId: existing.id, created: false };
    }

    const { data: created, error } = await supabase
        .from("marketplace_threads")
        .insert({
            listing_id: listingId,
            buyer_user_id: buyerId,
            seller_user_id: listing.seller_user_id,
        })
        .select("id")
        .single();

    if (error || !created) {
        return {
            ok: false,
            code: "DB_INSERT_FAILED",
            message: error?.message ?? "Création thread impossible",
        };
    }
    return { ok: true, threadId: created.id, created: true };
}

async function insertMessage(
    supabase: Awaited<ReturnType<typeof createClient>>,
    threadId: string,
    senderId: string,
    body: string
): Promise<ActionResult<{ flagged: boolean }>> {
    const detection = detectCircumvention(body);

    // La table a une colonne unique 'filtered_flags' JSONB. Si rien à flagger
    // → null. Sinon on stocke {emails, phones} (et on peut enrichir plus tard).
    // Toujours un objet (la colonne DB est NOT NULL avec default {})
    const filteredFlags = detection.matches;

    const { error } = await supabase
        .from("marketplace_messages")
        .insert({
            thread_id: threadId,
            sender_user_id: senderId,
            body,
            raw_body: body,
            filtered_flags: filteredFlags as never,
        });

    if (error) {
        return { ok: false, error: { code: "DB_INSERT_FAILED", message: error.message } };
    }
    return { ok: true, data: { flagged: detection.flagged } };
}

// =============================================================================
// Action : startThreadWithMessage
// =============================================================================

export async function startThreadWithMessage(input: {
    listingId: string;
    body: string;
}): Promise<ActionResult<{ thread_id: string; flagged: boolean }>> {
    const parsed = startThreadMessageSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, error: { code: "INVALID_INPUT", message: parsed.error.message } };
    }

    let user;
    try {
        ({ user } = await requireUser());
    } catch {
        return { ok: false, error: { code: "UNAUTHENTICATED", message: "Non connecté" } };
    }

    const supabase = await createClient();
    const threadResult = await findOrCreateThread(
        supabase,
        parsed.data.listingId,
        user.id
    );
    if (!threadResult.ok) {
        return { ok: false, error: { code: threadResult.code, message: threadResult.message } };
    }

    const msgResult = await insertMessage(
        supabase,
        threadResult.threadId,
        user.id,
        parsed.data.body
    );
    if (!msgResult.ok) return msgResult;

    revalidatePath("/profil/marketplace/messages");
    revalidatePath(`/profil/marketplace/messages/${threadResult.threadId}`);

    return {
        ok: true,
        data: {
            thread_id: threadResult.threadId,
            flagged: msgResult.data.flagged,
        },
    };
}

// =============================================================================
// Action : sendMessage
// =============================================================================

export async function sendMessage(input: {
    threadId: string;
    body: string;
}): Promise<ActionResult<{ flagged: boolean }>> {
    const parsed = sendMessageSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, error: { code: "INVALID_INPUT", message: parsed.error.message } };
    }

    let user;
    try {
        ({ user } = await requireUser());
    } catch {
        return { ok: false, error: { code: "UNAUTHENTICATED", message: "Non connecté" } };
    }

    const supabase = await createClient();

    const { data: thread } = await supabase
        .from("marketplace_threads")
        .select("id, buyer_user_id, seller_user_id")
        .eq("id", parsed.data.threadId)
        .maybeSingle();

    if (!thread) {
        return { ok: false, error: { code: "THREAD_NOT_FOUND", message: "Conversation introuvable" } };
    }
    if (thread.buyer_user_id !== user.id && thread.seller_user_id !== user.id) {
        return { ok: false, error: { code: "FORBIDDEN", message: "Pas votre conversation" } };
    }

    const result = await insertMessage(supabase, thread.id, user.id, parsed.data.body);
    if (!result.ok) return result;

    revalidatePath(`/profil/marketplace/messages/${thread.id}`);
    return result;
}