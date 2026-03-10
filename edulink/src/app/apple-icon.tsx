import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
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
          borderRadius: 42,
          color: "#ffffff",
          fontSize: 84,
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
