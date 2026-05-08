"use client";

// =============================================================================
// MarketplaceListingAttributesFields
// =============================================================================
// Champs spécifiques selon la famille de catégorie (N1 slug). Miroir UI des
// schémas Zod définis dans lib/marketplace/listing-attributes.ts.
// Si la famille n'est pas reconnue, ne rend rien.
// =============================================================================

type Attributes = Record<string, unknown>;

const INPUT_CLS =
    "mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent";
const SELECT_CLS = `${INPUT_CLS} cursor-pointer`;

function getNum(a: Attributes, key: string): number | "" {
    const v = a[key];
    return typeof v === "number" ? v : "";
}
function getStr(a: Attributes, key: string): string {
    const v = a[key];
    return typeof v === "string" ? v : "";
}
function getBool(a: Attributes, key: string): boolean {
    return a[key] === true;
}

function setKey(
    attrs: Attributes,
    onChange: (a: Attributes) => void,
    key: string,
    value: unknown
) {
    const next = { ...attrs };
    if (value === "" || value === undefined || value === null) {
        delete next[key];
    } else {
        next[key] = value;
    }
    onChange(next);
}

export function MarketplaceListingAttributesFields({
                                                       categorySlug,
                                                       parentSlug,
                                                       value,
                                                       onChange,
                                                   }: {
    categorySlug: string | null;
    parentSlug: string | null;
    value: Attributes;
    onChange: (attrs: Attributes) => void;
}) {
    if (!categorySlug) return null;
    const family = parentSlug ?? categorySlug;

    const setN = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setKey(value, onChange, key, e.target.value === "" ? "" : parseFloat(e.target.value));
    const setS = (key: string) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
            setKey(value, onChange, key, e.target.value);
    const setB = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setKey(value, onChange, key, e.target.checked || "");

    switch (family) {
        case "cannes":
            return (
                <Grid>
                    <Field label="Longueur (m)">
                        <input type="number" min={0.3} max={15} step={0.1} value={getNum(value, "longueur_m")} onChange={setN("longueur_m")} className={INPUT_CLS} />
                    </Field>
                    <Field label="Puissance (lbs)">
                        <input type="number" min={0} max={20} step={0.25} value={getNum(value, "puissance_lbs")} onChange={setN("puissance_lbs")} className={INPUT_CLS} />
                    </Field>
                    <Field label="Puissance (grammes)">
                        <input type="text" placeholder="Ex : 20-80g" value={getStr(value, "puissance_g")} onChange={setS("puissance_g")} className={INPUT_CLS} maxLength={20} />
                    </Field>
                    <Field label="Action">
                        <select value={getStr(value, "action")} onChange={setS("action")} className={SELECT_CLS}>
                            <option value="">— Non précisé —</option>
                            <option value="regular">Regular</option>
                            <option value="medium">Medium</option>
                            <option value="fast">Fast</option>
                            <option value="extra-fast">Extra fast</option>
                        </select>
                    </Field>
                    <Field label="Nombre de brins">
                        <input type="number" min={1} max={10} step={1} value={getNum(value, "nb_brins")} onChange={setN("nb_brins")} className={INPUT_CLS} />
                    </Field>
                </Grid>
            );

        case "moulinets":
            return (
                <Grid>
                    <Field label="Taille (ex : 4000)">
                        <input type="number" min={500} max={20000} step={500} value={getNum(value, "taille")} onChange={setN("taille")} className={INPUT_CLS} />
                    </Field>
                    <Field label="Latéralité">
                        <select value={getStr(value, "lateralite")} onChange={setS("lateralite")} className={SELECT_CLS}>
                            <option value="">— Non précisé —</option>
                            <option value="gaucher">Gaucher</option>
                            <option value="droitier">Droitier</option>
                            <option value="ambidextre">Ambidextre</option>
                        </select>
                    </Field>
                    <Field label="Ratio (ex : 5.2:1)">
                        <input type="text" value={getStr(value, "ratio")} onChange={setS("ratio")} className={INPUT_CLS} maxLength={10} />
                    </Field>
                    <Field label="Type de frein">
                        <select value={getStr(value, "type_frein")} onChange={setS("type_frein")} className={SELECT_CLS}>
                            <option value="">— Non précisé —</option>
                            <option value="avant">Avant</option>
                            <option value="arriere">Arrière</option>
                            <option value="combat">Combat</option>
                            <option value="free-spool">Free-spool</option>
                        </select>
                    </Field>
                </Grid>
            );

        case "lignes-bas-de-ligne":
            return (
                <Grid>
                    <Field label="Type">
                        <select value={getStr(value, "type")} onChange={setS("type")} className={SELECT_CLS}>
                            <option value="">— Non précisé —</option>
                            <option value="nylon">Nylon</option>
                            <option value="tresse">Tresse</option>
                            <option value="fluorocarbone">Fluorocarbone</option>
                            <option value="monofilament">Monofilament</option>
                        </select>
                    </Field>
                    <Field label="Diamètre (mm)">
                        <input type="number" min={0.05} max={2} step={0.01} value={getNum(value, "diametre_mm")} onChange={setN("diametre_mm")} className={INPUT_CLS} />
                    </Field>
                    <Field label="Résistance (kg)">
                        <input type="number" min={0.1} max={200} step={0.1} value={getNum(value, "resistance_kg")} onChange={setN("resistance_kg")} className={INPUT_CLS} />
                    </Field>
                    <Field label="Longueur (m)">
                        <input type="number" min={50} max={5000} step={1} value={getNum(value, "longueur_m")} onChange={setN("longueur_m")} className={INPUT_CLS} />
                    </Field>
                    <Field label="Couleur">
                        <input type="text" value={getStr(value, "couleur")} onChange={setS("couleur")} className={INPUT_CLS} maxLength={30} />
                    </Field>
                </Grid>
            );

        case "hamecons-terminal-tackle":
            return (
                <Grid>
                    <Field label="Taille (ex : n°10, 1/0)">
                        <input type="text" value={getStr(value, "taille")} onChange={setS("taille")} className={INPUT_CLS} maxLength={10} />
                    </Field>
                    <Field label="Type">
                        <select value={getStr(value, "type")} onChange={setS("type")} className={SELECT_CLS}>
                            <option value="">— Non précisé —</option>
                            <option value="simple">Simple</option>
                            <option value="triple">Triple</option>
                            <option value="double">Double</option>
                            <option value="cercle">Cercle</option>
                        </select>
                    </Field>
                    <BooleanCheckbox label="Avec ardillon" checked={getBool(value, "avec_ardillon")} onChange={setB("avec_ardillon")} />
                </Grid>
            );

        case "leurres":
            return (
                <Grid>
                    <Field label="Type">
                        <select value={getStr(value, "type")} onChange={setS("type")} className={SELECT_CLS}>
                            <option value="">— Non précisé —</option>
                            <option value="souple">Leurre souple</option>
                            <option value="dur-flottant">Dur flottant</option>
                            <option value="dur-coulant">Dur coulant</option>
                            <option value="dur-suspending">Dur suspending</option>
                            <option value="cuiller">Cuiller</option>
                            <option value="spinnerbait">Spinnerbait</option>
                            <option value="buzzbait">Buzzbait</option>
                            <option value="mouche">Mouche</option>
                            <option value="streamer">Streamer</option>
                        </select>
                    </Field>
                    <Field label="Poids (g)">
                        <input type="number" min={0.1} max={500} step={0.1} value={getNum(value, "poids_g")} onChange={setN("poids_g")} className={INPUT_CLS} />
                    </Field>
                    <Field label="Longueur (cm)">
                        <input type="number" min={0.5} max={50} step={0.1} value={getNum(value, "longueur_cm")} onChange={setN("longueur_cm")} className={INPUT_CLS} />
                    </Field>
                    <Field label="Couleur dominante">
                        <input type="text" value={getStr(value, "couleur_dominante")} onChange={setS("couleur_dominante")} className={INPUT_CLS} maxLength={50} />
                    </Field>
                </Grid>
            );

        case "detection":
            return (
                <Grid>
                    <Field label="Nombre de détecteurs">
                        <input type="number" min={1} max={8} step={1} value={getNum(value, "nb_detecteurs")} onChange={setN("nb_detecteurs")} className={INPUT_CLS} />
                    </Field>
                    <BooleanCheckbox label="Sans fil" checked={getBool(value, "sans_fil")} onChange={setB("sans_fil")} />
                    <Field label="Type de sondeur">
                        <select value={getStr(value, "type_sondeur")} onChange={setS("type_sondeur")} className={SELECT_CLS}>
                            <option value="">— Non précisé —</option>
                            <option value="couleur">Couleur</option>
                            <option value="noir-blanc">Noir &amp; blanc</option>
                            <option value="imagerie">Imagerie</option>
                            <option value="down-imaging">Down imaging</option>
                            <option value="side-imaging">Side imaging</option>
                        </select>
                    </Field>
                    <Field label="Portée (m)">
                        <input type="number" min={0} max={2000} step={1} value={getNum(value, "portee_m")} onChange={setN("portee_m")} className={INPUT_CLS} />
                    </Field>
                </Grid>
            );

        case "bivouac-confort":
            return (
                <Grid>
                    <Field label="Nombre de places">
                        <input type="number" min={1} max={4} step={1} value={getNum(value, "nb_places")} onChange={setN("nb_places")} className={INPUT_CLS} />
                    </Field>
                    <BooleanCheckbox label="Hivernale" checked={getBool(value, "hivernale")} onChange={setB("hivernale")} />
                    <Field label="Poids (kg)">
                        <input type="number" min={0.1} max={50} step={0.1} value={getNum(value, "poids_kg")} onChange={setN("poids_kg")} className={INPUT_CLS} />
                    </Field>
                </Grid>
            );

        case "amorces-graines":
            return (
                <Grid>
                    <Field label="Type">
                        <select value={getStr(value, "type")} onChange={setS("type")} className={SELECT_CLS}>
                            <option value="">— Non précisé —</option>
                            <option value="amorce-seche">Amorce sèche</option>
                            <option value="graines">Graines</option>
                            <option value="bouillettes">Bouillettes</option>
                            <option value="pellets">Pellets</option>
                            <option value="billes-flottantes">Billes flottantes</option>
                        </select>
                    </Field>
                    <Field label="Poids (kg)">
                        <input type="number" min={0.1} max={100} step={0.1} value={getNum(value, "poids_kg")} onChange={setN("poids_kg")} className={INPUT_CLS} />
                    </Field>
                </Grid>
            );

        default:
            return null;
    }
}

// =============================================================================
// Helpers visuels
// =============================================================================

function Grid({ children }: { children: React.ReactNode }) {
    return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {label}
            </span>
            {children}
        </label>
    );
}

function BooleanCheckbox({
                             label,
                             checked,
                             onChange,
                         }: {
    label: string;
    checked: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
    return (
        <label className="flex items-center gap-3 self-end pb-2 text-sm cursor-pointer">
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                className="h-4 w-4 accent-accent"
            />
            <span>{label}</span>
        </label>
    );
}