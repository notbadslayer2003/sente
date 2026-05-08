import type Stripe from "stripe";
import {Database} from "@/lib/database.types";

type SellerAccountUpdate = Database["public"]["Tables"]["marketplace_seller_accounts"]["Update"];

/**
 * Mapping état Stripe Account → état KYC Sente + extraction DAC7.
 * Helper pur, réutilisé par la Server Action refreshKycStatus
 * et le webhook stripe handler account.updated.
 */
export function mapStripeAccountToKycState(account: Stripe.Account): {
    kyc_status: "pending" | "verified" | "restricted";
    dac7Updates: SellerAccountUpdate;
} {
    const disabledReason = account.requirements?.disabled_reason;
    if (disabledReason && disabledReason !== "requirements.past_due") {
        return {
            kyc_status: "restricted",
            dac7Updates: { restricted_reason: `Stripe : ${disabledReason}` },
        };
    }

    const allEnabled =
        account.charges_enabled === true &&
        account.payouts_enabled === true &&
        account.details_submitted === true;

    if (!allEnabled) {
        return { kyc_status: "pending", dac7Updates: {} };
    }

    const ind = account.individual;
    const dac7Updates: SellerAccountUpdate = {};

    if (ind?.first_name) dac7Updates.dac7_legal_first_name = ind.first_name;
    if (ind?.last_name) dac7Updates.dac7_legal_last_name = ind.last_name;
    if (ind?.dob?.year && ind.dob.month && ind.dob.day) {
        dac7Updates.dac7_birth_date = `${ind.dob.year}-${String(ind.dob.month).padStart(2, "0")}-${String(ind.dob.day).padStart(2, "0")}`;
    }
    if (ind?.address?.country) {
        const country = ind.address.country.toUpperCase();
        if (country === "BE" || country === "FR") {
            dac7Updates.dac7_country_residence = country;
        }
        // Note : si Stripe renvoie un autre pays, on ne set pas → kyc reste 'pending'
        // (le check dac7Complete ci-dessous échouera) → admin manuel à prévoir

        const addrParts = [
            ind.address.line1,
            ind.address.line2,
            ind.address.postal_code,
            ind.address.city,
            ind.address.country,
        ].filter(Boolean);
        dac7Updates.dac7_address_full = addrParts.join(", ");
    }

    const dac7Complete =
        dac7Updates.dac7_legal_first_name &&
        dac7Updates.dac7_legal_last_name &&
        dac7Updates.dac7_birth_date &&
        dac7Updates.dac7_country_residence &&
        dac7Updates.dac7_address_full;

    return {
        kyc_status: dac7Complete ? "verified" : "pending",
        dac7Updates,
    };
}