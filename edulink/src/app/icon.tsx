import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #065f46 0%, #0f766e 100%)",
          borderRadius: 112,
          color: "#ffffff",
          fontSize: 220,
          fontWeight: 700,
          fontFamily: "Arial, sans-serif",
        }}
      >
        EL
      </div>
    ),
    {
      ...size,
    }
  );
}
