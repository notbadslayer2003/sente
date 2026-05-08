"use server";

import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {revalidatePath} from "next/cache";
import {getAttributesSchemaForCategory} from "@/lib/marketplace/listing-attributes";
import {
    uploadListingPhoto as uploadListingPhotoR2,
    deleteListingPhoto as deleteListingPhotoR2,
} from "@/lib/storage/marketplace-r2";

// =============================================================================
// Types
// =============================================================================

type ActionResult<T = void> =
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string } };

// =============================================================================
// Schémas Zod
// =============================================================================

const listingConditionEnum = z.enum([
    "new_with_tag",
    "new",
    "very_good",
    "good",
    "acceptable",
]);

const listingCountryEnum = z.enum(["BE", "FR"]);

const createListingDraftSchema = z.object({
    title: z.string().min(3).max(100),
    description: z.string().min(10).max(4000),
    price_cents: z.number().int().min(100).max(1000000),
    category_id: z.string().uuid(),
    brand_id: z.string().uuid().nullable(),
    condition: listingConditionEnum,
    weight_grams: z.number().int().positive().max(30000),
    length_cm: z.number().int().positive().max(200).nullable(),
    width_cm: z.number().int().positive().max(200).nullable(),
    depth_cm: z.number().int().positive().max(200).nullable(),
    city: z.string().min(2).max(100),
    postal_code: z.string().min(4).max(10),
    country: listingCountryEnum,
    attributes: z.record(z.string(), z.unknown()).default({}),
});

// Champs immutables une fois en 'active' (cf. décision : pas de changement
// de catégorie/marque/géoloc en place, faut repasser en draft).
const updateListingActiveSchema = z.object({
    title: z.string().min(3).max(100).optional(),
    description: z.string().min(10).max(4000).optional(),
    price_cents: z.number().int().min(100).max(1000000).optional(),
    condition: listingConditionEnum.optional(),
    weight_grams: z.number().int().positive().max(30000).optional(),
    length_cm: z.number().int().positive().max(200).nullable().optional(),
    width_cm: z.number().int().positive().max(200).nullable().optional(),
    depth_cm: z.number().int().positive().max(200).nullable().optional(),
    attributes: z.record(z.string(), z.unknown()).optional(),
});

// En draft, tout est éditable
const updateListingDraftSchema = createListingDraftSchema.partial();

// =============================================================================
// Helpers communs
// =============================================================================

async function requireUser() {
    const supabase = await createClient();
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) throw new Error("UNAUTHENTICATED");
    return {supabase, user};
}

async function fetchCategorySlugs(categoryId: string) {
    const supabase = await createClient();
    const {data: cat} = await supabase
        .from("marketplace_categories")
        .select("slug, parent_id")
        .eq("id", categoryId)
        .maybeSingle();

    if (!cat) return null;

    let parentSlug: string | null = null;
    if (cat.parent_id) {
        const {data: parent} = await supabase
            .from("marketplace_categories")
            .select("slug")
            .eq("id", cat.parent_id)
            .maybeSingle();
        parentSlug = parent?.slug ?? null;
    }

    return {slug: cat.slug, parentSlug};
}

// APRÈS
async function validateAttributes(
    categoryId: string,
    attributes: unknown
): Promise<
    | { ok: false; message: string }
    | { ok: true; data: Record<string, unknown> }
> {
    const slugs = await fetchCategorySlugs(categoryId);
    if (!slugs) return {ok: false, message: "Catégorie introuvable"};

    const schema = getAttributesSchemaForCategory({
        categorySlug: slugs.slug,
        parentSlug: slugs.parentSlug,
    });

    const parsed = schema.safeParse(attributes);
    if (!parsed.success) {
        return {
            ok: false,
            message: `Attributs invalides : ${parsed.error.message}`,
        };
    }

    return {ok: true, data: parsed.data as Record<string, unknown>};
}

// =============================================================================
// Action : createListingDraft
// =============================================================================
// Crée un listing en status='draft'. Pas besoin de KYC pour draft (l'utilisateur
// peut préparer son annonce pendant que son KYC est en cours).
// =============================================================================

export async function createListingDraft(
    input: z.infer<typeof createListingDraftSchema>
): Promise<ActionResult<{ id: string }>> {
    const parsed = createListingDraftSchema.safeParse(input);
    if (!parsed.success) {
        return {ok: false, error: {code: "INVALID_INPUT", message: parsed.error.message}};
    }

    let user;
    try {
        ({user} = await requireUser());
    } catch {
        return {ok: false, error: {code: "UNAUTHENTICATED", message: "Non connecté"}};
    }

    // Validation des attributs selon catégorie
    const attrCheck = await validateAttributes(parsed.data.category_id, parsed.data.attributes);
    if (!attrCheck.ok) {
        return {ok: false, error: {code: "INVALID_ATTRIBUTES", message: attrCheck.message}};
    }

    const supabase = await createClient();
    const {data, error} = await supabase
        .from("marketplace_listings")
        .insert({
            seller_user_id: user.id,
            category_id: parsed.data.category_id,
            brand_id: parsed.data.brand_id,
            title: parsed.data.title,
            description: parsed.data.description,
            price_cents: parsed.data.price_cents,
            condition: parsed.data.condition,
            attributes: attrCheck.data as never,
            weight_grams: parsed.data.weight_grams,
            length_cm: parsed.data.length_cm,
            width_cm: parsed.data.width_cm,
            depth_cm: parsed.data.depth_cm,
            city: parsed.data.city,
            postal_code: parsed.data.postal_code,
            country: parsed.data.country,
            status: "draft",
        })
        .select("id")
        .single();

    if (error) {
        return {ok: false, error: {code: "DB_INSERT_FAILED", message: error.message}};
    }

    revalidatePath("/profil/marketplace/annonces");
    return {ok: true, data: {id: data.id}};
}

// =============================================================================
// Action : updateListing
// =============================================================================
// Update différencié selon le statut courant :
// - draft → tous champs autorisés
// - active → champs verrouillés (catégorie, marque, géoloc)
// =============================================================================

export async function updateListing(
    listingId: string,
    input: Record<string, unknown>
): Promise<ActionResult> {
    let user;
    try {
        ({user} = await requireUser());
    } catch {
        return {ok: false, error: {code: "UNAUTHENTICATED", message: "Non connecté"}};
    }

    const supabase = await createClient();

    // Charge le listing pour connaître son statut + ownership (RLS gère mais on revérifie)
    const {data: listing, error: fetchError} = await supabase
        .from("marketplace_listings")
        .select("id, status, seller_user_id, category_id")
        .eq("id", listingId)
        .is("deleted_at", null)
        .maybeSingle();

    if (fetchError || !listing) {
        return {ok: false, error: {code: "NOT_FOUND", message: "Annonce introuvable"}};
    }

    if (listing.seller_user_id !== user.id) {
        return {ok: false, error: {code: "FORBIDDEN", message: "Pas votre annonce"}};
    }

    // Choix du schéma selon statut
    const schema =
        listing.status === "draft" ? updateListingDraftSchema : updateListingActiveSchema;

    const parsed = schema.safeParse(input);
    if (!parsed.success) {
        return {
            ok: false,
            error: {
                code: "INVALID_INPUT",
                message:
                    listing.status === "active"
                        ? `Champ verrouillé en active (catégorie/marque/géoloc) : ${parsed.error.message}`
                        : parsed.error.message,
            },
        };
    }

    // Si attributes fournies, valider selon la catégorie cible
    const targetCategoryId =
        "category_id" in parsed.data && typeof parsed.data.category_id === "string"
            ? parsed.data.category_id
            : listing.category_id;

    if ("attributes" in parsed.data && parsed.data.attributes !== undefined) {
        const attrCheck = await validateAttributes(targetCategoryId, parsed.data.attributes);
        if (!attrCheck.ok) {
            return {ok: false, error: {code: "INVALID_ATTRIBUTES", message: attrCheck.message}};
        }
        parsed.data.attributes = attrCheck.data;
    }

    const { error: updateError } = await supabase
        .from("marketplace_listings")
        .update(parsed.data as never)
        .eq("id", listingId);

    if (updateError) {
        return {ok: false, error: {code: "DB_UPDATE_FAILED", message: updateError.message}};
    }

    revalidatePath("/profil/marketplace/annonces");
    revalidatePath(`/profil/marketplace/annonces/${listingId}`);
    return {ok: true, data: undefined};
}

// =============================================================================
// Action : addListingPhoto
// =============================================================================
// Upload une photo R2 + INSERT dans marketplace_listing_photos.
// Position auto = max(position existantes) + 1, ou 0 si aucune.
// Max 6 photos par listing (CHECK position 0..5 + UNIQUE).
// Form-based : reçoit un FormData avec 'listingId' et 'file'.
// =============================================================================

export async function addListingPhoto(formData: FormData): Promise<ActionResult<{
    id: string;
    storage_path: string;
    position: number
}>> {
    let user;
    try {
        ({user} = await requireUser());
    } catch {
        return {ok: false, error: {code: "UNAUTHENTICATED", message: "Non connecté"}};
    }

    const listingId = formData.get("listingId");
    const file = formData.get("file");

    if (typeof listingId !== "string") {
        return {ok: false, error: {code: "INVALID_INPUT", message: "listingId manquant"}};
    }
    if (!(file instanceof File)) {
        return {ok: false, error: {code: "INVALID_INPUT", message: "file manquant"}};
    }

    const supabase = await createClient();

    // Vérifier ownership + listing existe
    const {data: listing} = await supabase
        .from("marketplace_listings")
        .select("id, seller_user_id")
        .eq("id", listingId)
        .is("deleted_at", null)
        .maybeSingle();

    if (!listing || listing.seller_user_id !== user.id) {
        return {ok: false, error: {code: "FORBIDDEN", message: "Pas votre annonce"}};
    }

    // Calculer la prochaine position libre
    const {data: existingPhotos} = await supabase
        .from("marketplace_listing_photos")
        .select("position")
        .eq("listing_id", listingId)
        .order("position", {ascending: false})
        .limit(1);

    const nextPosition = existingPhotos && existingPhotos.length > 0 ? existingPhotos[0].position + 1 : 0;

    if (nextPosition > 5) {
        return {ok: false, error: {code: "MAX_PHOTOS", message: "Maximum 6 photos par annonce"}};
    }

    // Upload R2
    const buffer = Buffer.from(await file.arrayBuffer());
    let uploadResult;
    try {
        uploadResult = await uploadListingPhotoR2(listingId, nextPosition, buffer, file.type);
    } catch (err) {
        return {
            ok: false,
            error: {code: "UPLOAD_FAILED", message: err instanceof Error ? err.message : "Upload échoué"},
        };
    }

    // INSERT en DB
    const {data: photo, error: insertError} = await supabase
        .from("marketplace_listing_photos")
        .insert({
            listing_id: listingId,
            storage_path: uploadResult.storage_path,
            position: nextPosition,
        })
        .select("id")
        .single();

    if (insertError) {
        // Rollback R2 : supprimer la photo qu'on vient d'uploader
        await deleteListingPhotoR2(uploadResult.key);
        return {ok: false, error: {code: "DB_INSERT_FAILED", message: insertError.message}};
    }

    revalidatePath(`/profil/marketplace/annonces/${listingId}`);
    return {
        ok: true,
        data: {id: photo.id, storage_path: uploadResult.storage_path, position: nextPosition},
    };
}

// =============================================================================
// Action : removeListingPhoto
// =============================================================================

export async function removeListingPhoto(photoId: string): Promise<ActionResult> {
    let user;
    try {
        ({user} = await requireUser());
    } catch {
        return {ok: false, error: {code: "UNAUTHENTICATED", message: "Non connecté"}};
    }

    const supabase = await createClient();

    // Charge la photo + listing pour ownership
    const {data: photo} = await supabase
        .from("marketplace_listing_photos")
        .select("id, listing_id, storage_path, listing:marketplace_listings!listing_id(seller_user_id)")
        .eq("id", photoId)
        .maybeSingle();

    if (!photo) {
        return {ok: false, error: {code: "NOT_FOUND", message: "Photo introuvable"}};
    }

    const seller = Array.isArray(photo.listing) ? photo.listing[0] : photo.listing;
    if (!seller || seller.seller_user_id !== user.id) {
        return {ok: false, error: {code: "FORBIDDEN", message: "Pas votre annonce"}};
    }

    // DELETE R2 d'abord (si ça plante on garde la ligne DB → orphan, géré par cron)
    try {
        await deleteListingPhotoR2(photo.storage_path);
    } catch (err) {
        console.error(`R2 delete failed for ${photo.storage_path}:`, err);
        // On continue : la ligne DB sera supprimée même si R2 garde le blob (cron purge)
    }

    const {error: deleteError} = await supabase
        .from("marketplace_listing_photos")
        .delete()
        .eq("id", photoId);

    if (deleteError) {
        return {ok: false, error: {code: "DB_DELETE_FAILED", message: deleteError.message}};
    }

    revalidatePath(`/profil/marketplace/annonces/${photo.listing_id}`);
    return {ok: true, data: undefined};
}

// =============================================================================
// Action : publishListing
// =============================================================================
// draft → pending_review (1ère annonce du vendeur) ou active (suivantes).
// Validations :
// - Vendeur KYC verified
// - Au moins 1 photo
// - Le listing est en 'draft'
// =============================================================================

export async function publishListing(listingId: string): Promise<ActionResult<{
    status: "active" | "pending_review"
}>> {
    let user;
    try {
        ({user} = await requireUser());
    } catch {
        return {ok: false, error: {code: "UNAUTHENTICATED", message: "Non connecté"}};
    }

    const supabase = await createClient();

    // Charge listing + photos count + ownership
    const {data: listing} = await supabase
        .from("marketplace_listings")
        .select("id, status, seller_user_id, photos:marketplace_listing_photos(id)")
        .eq("id", listingId)
        .is("deleted_at", null)
        .maybeSingle();

    if (!listing || listing.seller_user_id !== user.id) {
        return {ok: false, error: {code: "FORBIDDEN", message: "Pas votre annonce"}};
    }

    if (listing.status !== "draft") {
        return {
            ok: false,
            error: {
                code: "INVALID_STATUS",
                message: `Annonce en status '${listing.status}', publication impossible`,
            },
        };
    }

    if (!Array.isArray(listing.photos) || listing.photos.length === 0) {
        return {
            ok: false,
            error: {code: "NO_PHOTOS", message: "Au moins une photo est requise pour publier"},
        };
    }

    // Vérifier KYC verified (le trigger DB le check aussi pour 'active' mais
    // pas pour 'pending_review' → on le check ici pour les deux cas)
    const {data: kyc} = await supabase
        .from("marketplace_seller_accounts")
        .select("kyc_status, stripe_charges_enabled, stripe_payouts_enabled")
        .eq("user_id", user.id)
        .maybeSingle();

    if (
        !kyc ||
        kyc.kyc_status !== "verified" ||
        !kyc.stripe_charges_enabled ||
        !kyc.stripe_payouts_enabled
    ) {
        return {
            ok: false,
            error: {code: "KYC_REQUIRED", message: "KYC vendeur requis avant publication"},
        };
    }

    // Compter les annonces déjà publiées du vendeur (pour modération 1ère annonce)
    const admin = createAdminClient();
    const {count: publishedCount} = await admin
        .from("marketplace_listings")
        .select("id", {count: "exact", head: true})
        .eq("seller_user_id", user.id)
        .in("status", ["active", "sold", "expired"])
        .is("deleted_at", null);

    const isFirstListing = (publishedCount ?? 0) === 0;
    const newStatus: "active" | "pending_review" = isFirstListing ? "pending_review" : "active";

    const {error: updateError} = await supabase
        .from("marketplace_listings")
        .update({status: newStatus})
        .eq("id", listingId);

    if (updateError) {
        return {ok: false, error: {code: "DB_UPDATE_FAILED", message: updateError.message}};
    }

    revalidatePath("/profil/marketplace/annonces");
    revalidatePath(`/profil/marketplace/annonces/${listingId}`);
    return {ok: true, data: {status: newStatus}};
}

// =============================================================================
// Action : unpublishListing
// =============================================================================
// active/pending_review → draft. Le vendeur peut éditer puis republier.
// =============================================================================

export async function unpublishListing(listingId: string): Promise<ActionResult> {
    let user;
    try {
        ({user} = await requireUser());
    } catch {
        return {ok: false, error: {code: "UNAUTHENTICATED", message: "Non connecté"}};
    }

    const supabase = await createClient();

    const {data: listing} = await supabase
        .from("marketplace_listings")
        .select("id, status, seller_user_id")
        .eq("id", listingId)
        .is("deleted_at", null)
        .maybeSingle();

    if (!listing || listing.seller_user_id !== user.id) {
        return {ok: false, error: {code: "FORBIDDEN", message: "Pas votre annonce"}};
    }

    if (listing.status !== "active" && listing.status !== "pending_review") {
        return {
            ok: false,
            error: {
                code: "INVALID_STATUS",
                message: `Annonce en status '${listing.status}', dépublication impossible`,
            },
        };
    }

    const {error} = await supabase
        .from("marketplace_listings")
        .update({status: "draft"})
        .eq("id", listingId);

    if (error) {
        return {ok: false, error: {code: "DB_UPDATE_FAILED", message: error.message}};
    }

    revalidatePath("/profil/marketplace/annonces");
    revalidatePath(`/profil/marketplace/annonces/${listingId}`);
    return {ok: true, data: undefined};
}

// =============================================================================
// Action : renewListing
// =============================================================================
// Reset expires_at à now() + 60 jours. Disponible pour active/expired.
// =============================================================================

export async function renewListing(listingId: string): Promise<ActionResult> {
    let user;
    try {
        ({user} = await requireUser());
    } catch {
        return {ok: false, error: {code: "UNAUTHENTICATED", message: "Non connecté"}};
    }

    const supabase = await createClient();

    const {data: listing} = await supabase
        .from("marketplace_listings")
        .select("id, status, seller_user_id")
        .eq("id", listingId)
        .is("deleted_at", null)
        .maybeSingle();

    if (!listing || listing.seller_user_id !== user.id) {
        return {ok: false, error: {code: "FORBIDDEN", message: "Pas votre annonce"}};
    }

    if (listing.status !== "active" && listing.status !== "expired") {
        return {
            ok: false,
            error: {
                code: "INVALID_STATUS",
                message: `Renouvellement impossible pour status '${listing.status}'`,
            },
        };
    }

    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 60);

    const newStatus = listing.status === "expired" ? "active" : listing.status;

    const {error} = await supabase
        .from("marketplace_listings")
        .update({
            expires_at: newExpiresAt.toISOString(),
            status: newStatus,
        })
        .eq("id", listingId);

    if (error) {
        return {ok: false, error: {code: "DB_UPDATE_FAILED", message: error.message}};
    }

    revalidatePath("/profil/marketplace/annonces");
    revalidatePath(`/profil/marketplace/annonces/${listingId}`);
    return {ok: true, data: undefined};
}

// =============================================================================
// Action : deleteListing
// =============================================================================
// Soft delete : deleted_at = now(). Le listing devient invisible mais reste
// en DB pour les éventuelles références (orders passés, audit log).
// Les photos R2 sont gardées et purgées par un cron quotidien plus tard.
// =============================================================================

export async function deleteListing(listingId: string): Promise<ActionResult> {
    let user;
    try {
        ({user} = await requireUser());
    } catch {
        return {ok: false, error: {code: "UNAUTHENTICATED", message: "Non connecté"}};
    }

    const supabase = await createClient();

    const {data: listing} = await supabase
        .from("marketplace_listings")
        .select("id, status, seller_user_id")
        .eq("id", listingId)
        .is("deleted_at", null)
        .maybeSingle();

    if (!listing || listing.seller_user_id !== user.id) {
        return {ok: false, error: {code: "FORBIDDEN", message: "Pas votre annonce"}};
    }

    // Si le listing a un order en cours (sold/disputed), on bloque la suppression
    if (listing.status === "sold") {
        return {
            ok: false,
            error: {
                code: "HAS_ORDER",
                message: "Impossible de supprimer une annonce vendue (commande liée)",
            },
        };
    }

    const {error} = await supabase
        .from("marketplace_listings")
        .update({
            deleted_at: new Date().toISOString(),
            status: "removed",
        })
        .eq("id", listingId);

    if (error) {
        return {ok: false, error: {code: "DB_UPDATE_FAILED", message: error.message}};
    }

    revalidatePath("/profil/marketplace/annonces");
    return {ok: true, data: undefined};
}