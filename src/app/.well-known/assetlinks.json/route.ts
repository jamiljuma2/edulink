import { NextResponse } from "next/server";

function parseFingerprints(value: string | undefined) {
  if (!value) return [] as string[];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export async function GET() {
  const packageName = process.env.TWA_PACKAGE_NAME;
  const fingerprints = parseFingerprints(process.env.TWA_SHA256_CERT_FINGERPRINTS);

  if (!packageName || fingerprints.length === 0) {
    return NextResponse.json([], {
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: packageName,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    {
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    }
  );
}
