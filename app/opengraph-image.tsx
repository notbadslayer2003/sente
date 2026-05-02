import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Sente — la communauté pêche en Wallonie et France";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    background: "#1a1a1a",
                    color: "#f5f4f0",
                    padding: 80,
                    fontFamily: "Georgia, serif",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        fontSize: 24,
                        letterSpacing: "0.25em",
                        textTransform: "uppercase",
                        opacity: 0.6,
                    }}
                >
                    Sente
                </div>
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            fontSize: 96,
                            lineHeight: 1.05,
                            letterSpacing: "-0.02em",
                            maxWidth: 900,
                        }}
                    >
                        La communauté pêche en Wallonie et France.
                    </div>
                    <div
                        style={{
                            display: "flex",
                            marginTop: 32,
                            fontSize: 28,
                            opacity: 0.7,
                            fontFamily: "system-ui",
                        }}
                    >
                        Étangs · Magasins · Communauté
                    </div>
                </div>
            </div>
        ),
        size
    );
}