export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      status: "ok",
      service: "recoup",
      version: process.env.APP_VERSION ?? "development",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
