export type AddressCountry = "BE" | "FR";

export type AddressFieldName = {
    line1: string;
    postal_code: string;
    city: string;
};

const POSTAL_CODE_REGEX: Record<AddressCountry, RegExp> = {
    BE: /^\d{4}$/,
    FR: /^\d{5}$/,
};

const POSTAL_PLACEHOLDER: Record<AddressCountry, string> = {
    BE: "1000",
    FR: "75001",
};

export function isValidPostalCode(value: string, country: AddressCountry): boolean {
    return POSTAL_CODE_REGEX[country].test(value.trim());
}

export function getPostalPlaceholder(country: AddressCountry): string {
    return POSTAL_PLACEHOLDER[country];
}

export function getPostalMaxLength(country: AddressCountry): number {
    return country === "BE" ? 4 : 5;
}

/** Construit une query Nominatim depuis les composants d'adresse. */
export function buildGeocodeQuery(
    address: { line1: string; postal_code: string; city: string },
    country: AddressCountry
): string {
    const countryName = country === "BE" ? "Belgium" : "France";
    return [address.line1, address.postal_code, address.city, countryName]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(", ");
}