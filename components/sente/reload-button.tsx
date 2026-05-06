"use client";

export function ReloadButton({ className }: { className?: string }) {
    return (
        <button
            type="button"
            onClick={() => window.location.reload()}
            className={
                className ??
                "px-5 py-2.5 text-xs uppercase tracking-wide border border-border hover:bg-accent/10 hover:border-accent transition-colors"
            }
        >
            Recharger
        </button>
    );
}