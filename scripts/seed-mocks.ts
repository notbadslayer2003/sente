/**
 * Insère les 12 étangs + 7 magasins mockés en DB.
 * Tous attribués au premier app_admin trouvé (toi).
 *
 * Usage : pnpm tsx scripts/seed-mocks.ts
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { MOCK_LIEUX } from "../lib/mock/lieux";
import { MOCK_MAGASINS } from "../lib/mock/magasins";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceKey) {
    console.error("Variables d'env manquantes (.env.local)");
    process.exit(1);
}

const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
    // Récupère le premier app_admin
    const { data: admins } = await supabase.from("app_admins").select("user_id").limit(1);
    if (!admins || admins.length === 0) {
        console.error("Aucun app_admin trouvé. Crée-toi un compte et promote-toi en admin d'abord.");
        process.exit(1);
    }
    const ownerId = admins[0].user_id;
    console.log(`Owner attribué : ${ownerId}`);

    // ─── Étangs ────────────────────────────────────────────────
    for (const lieu of MOCK_LIEUX) {
        const { data: existing } = await supabase
            .from("organizations")
            .select("id")
            .eq("slug", lieu.slug)
            .single();
        if (existing) {
            console.log(`✓ étang déjà en DB : ${lieu.slug}`);
            continue;
        }

        const { data: org, error } = await supabase
            .from("organizations")
            .insert({
                org_type: "etang",
                slug: lieu.slug,
                name: lieu.nom,
                description: lieu.description,
                country: "BE",
                region: lieu.province,
                city: lieu.commune,
                lat: lieu.coordonnees.lat,
                lng: lieu.coordonnees.lng,
                contact_email: lieu.contact.email ?? null,
                contact_phone: lieu.contact.telephone ?? null,
                website: lieu.contact.siteWeb ?? null,
                photos: lieu.photos,
                cover_image_url: lieu.photos[0],
                status: "active",
                owner_user_id: ownerId,
            })
            .select("id")
            .single();

        if (error || !org) {
            console.error(`✗ erreur ${lieu.slug}:`, error);
            continue;
        }

        await supabase.from("etang_details").insert({
            organization_id: org.id,
            superficie_ha: lieu.superficieHa,
            profondeur_max_m: lieu.profondeurMaxM ?? null,
            especes: lieu.especes,
            reglement: lieu.reglement,
            tarif_journee_cents: lieu.tarif.jour ? Math.round(lieu.tarif.jour * 100) : null,
            postes_count: lieu.postesCount,
            record_kg: lieu.recordKg ?? null,
            postes_attribues_actifs: lieu.postesCount > 0,
            reservation_active: lieu.reservable,
        });

        await supabase.from("memberships").insert({
            organization_id: org.id,
            user_id: ownerId,
            role: "owner",
            accepted_at: new Date().toISOString(),
        });

        console.log(`+ étang inséré : ${lieu.slug}`);
    }

    // ─── Magasins ──────────────────────────────────────────────
    for (const m of MOCK_MAGASINS) {
        const { data: existing } = await supabase
            .from("organizations")
            .select("id")
            .eq("slug", m.slug)
            .single();
        if (existing) {
            console.log(`✓ magasin déjà en DB : ${m.slug}`);
            continue;
        }

        const { data: org, error } = await supabase
            .from("organizations")
            .insert({
                org_type: "magasin",
                slug: m.slug,
                name: m.nom,
                description: m.description,
                country: "BE",
                region: m.province,
                city: m.ville,
                address: m.adresse,
                lat: m.coordonnees.lat,
                lng: m.coordonnees.lng,
                contact_email: m.contact.email ?? null,
                contact_phone: m.contact.telephone ?? null,
                website: m.contact.siteWeb ?? null,
                social_instagram: m.contact.instagram ?? null,
                photos: m.photos,
                cover_image_url: m.photos[0],
                status: "active",
                owner_user_id: ownerId,
            })
            .select("id")
            .single();

        if (error || !org) {
            console.error(`✗ erreur ${m.slug}:`, error);
            continue;
        }

        await supabase.from("magasin_details").insert({
            organization_id: org.id,
            specialites: m.specialites,
            marques: m.marques,
            horaires: { texte: m.horaires },
            plan: m.partenaire ? "pro" : "starter",
            commission_rate_bps: m.partenaire ? 250 : 500,
            partner_since: m.partenaire ? new Date().toISOString() : null,
        });

        await supabase.from("memberships").insert({
            organization_id: org.id,
            user_id: ownerId,
            role: "owner",
            accepted_at: new Date().toISOString(),
        });

        console.log(`+ magasin inséré : ${m.slug}`);
    }

    console.log("\nSeed terminé.");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});