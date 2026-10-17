import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Sanwo: get paid before your client pays. Receivables financing on Stellar.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Link preview built from the hero scene and real type, matching the
 * landing page. The shade behind the type is baked into og-scene.jpg.
 */
export default async function OpenGraphImage() {
  const [font, scene] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/AlbertSans-Regular.ttf")),
    readFile(join(process.cwd(), "assets/og-scene.jpg")),
  ]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", fontFamily: "Albert Sans", color: "#ffffff" }}>
        <img
          src={`data:image/jpeg;base64,${scene.toString("base64")}`}
          width={1200}
          height={630}
          alt=""
          style={{ position: "absolute", inset: 0, objectFit: "cover" }}
        />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", width: "100%", paddingTop: 54 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="44" height="44" viewBox="0 0 64 64">
              <defs>
                <clipPath id="t">
                  <polygon points="0,0 64,0 64,23.6 32,23.6 32,64 0,64" />
                </clipPath>
                <clipPath id="b">
                  <polygon points="64,64 0,64 0,40.4 32,40.4 32,0 64,0" />
                </clipPath>
              </defs>
              <g fill="none" stroke="#ffffff" strokeWidth="3.8">
                <path d="M42.4 22.6A10.4 10.4 0 0 0 21.6 22.6C21.6 30.8 42.4 33.2 42.4 41.4A10.4 10.4 0 0 1 21.6 41.4" />
                <path d="M50 22.6A18 18 0 0 0 14 22.6C14 37.574 34.8 39.974 34.8 41.4" clipPath="url(#t)" />
                <path d="M14 41.4A18 18 0 0 0 50 41.4C50 26.426 29.2 24.026 29.2 22.6" clipPath="url(#b)" />
              </g>
            </svg>
            <span style={{ fontSize: 21, letterSpacing: 6 }}>SANWO</span>
          </div>
          <div style={{ display: "flex", marginTop: 56, fontSize: 64, letterSpacing: -1.3 }}>Get paid before your client pays.</div>
          <div style={{ display: "flex", marginTop: 18, fontSize: 25, color: "rgba(255,255,255,0.86)" }}>
            Receivables financing on Stellar, for businesses invoicing in US dollars.
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Albert Sans", data: font, style: "normal", weight: 400 }],
    },
  );
}
