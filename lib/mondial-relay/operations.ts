// =============================================================================
// DEPRECATED — l'intégration MR directe a été remplacée par Sendcloud
// =============================================================================
// Ce fichier est conservé uniquement pour le type RelayPoint, importé par
// MarketplaceRelayPointPicker. À supprimer dans un nettoyage futur quand
// le composant migrera vers @/lib/sendcloud/operations:ServicePoint.
// =============================================================================

export type RelayPoint = {
    id: string;
    name: string;
    address: string;
    postalCode: string;
    city: string;
    country: string;
};