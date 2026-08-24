import { ImageResponse } from "next/og";

export const alt =
  "Recomenda — a recomendação agrícola no tempo certo, do plantio à colheita. Uma solução 250k.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background:
            "linear-gradient(135deg, #123320 0%, #22663a 58%, #1a4f2d 100%)",
          color: "#f7f4ec",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 16,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                background: "#ba5f35",
              }}
            />
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, marginLeft: 18 }}>
            Recomenda
          </div>
          <div
            style={{
              marginLeft: "auto",
              fontSize: 22,
              color: "#b8dcc6",
              display: "flex",
            }}
          >
            uma solução 250k
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 68,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              maxWidth: 940,
            }}
          >
            A recomendação agrícola no tempo certo, do plantio à colheita.
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#dcefe3",
              maxWidth: 860,
              marginTop: 24,
            }}
          >
            Recomendação, lista de compras, estoque e resultado — em uma só
            plataforma.
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, fontSize: 23 }}>
          {["Agrônomo", "Produtor Rural", "Recomendador"].map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                padding: "10px 24px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.22)",
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
