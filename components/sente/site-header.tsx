import { SiteHeaderClient } from "./site-header-client";

// ============================================================
// SiteHeader
//
// Server Component minimal qui sert de point d'extension futur :
// quand on branchera Supabase pour différencier connecté/déconnecté
// dans la nav, c'est ici qu'on appellera createClient().auth.getUser().
//
// Pour l'instant : pass-through pur vers le composant client qui
// gère le scroll state + le soulignement actif via usePathname.
// ============================================================

export function SiteHeader() {
    // À brancher plus tard :
    // const supabase = await createClient();
    // const { data: { user } } = await supabase.auth.getUser();
    // return <SiteHeaderClient user={user} />;

    return <SiteHeaderClient />;
}