import { NextRequest, NextResponse } from "next/server"
import {
  smoothPrintApkResponseSchema,
  smoothPrintApkUploadSchema,
  smoothPrintApksResponseSchema,
} from "@/lib/db/schema"
import { smoothPrintApkRepository } from "@/lib/smooth-print-apks"

export const runtime = "nodejs"

export async function GET() {
  const apks = await smoothPrintApkRepository.list()
  return NextResponse.json(smoothPrintApksResponseSchema.parse({ apks }))
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null)
  if (!form) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 })
  }

  const name = file.name.toLowerCase()
  if (!name.endsWith(".apk")) {
    return NextResponse.json({ error: "not_apk" }, { status: 400 })
  }

  const parsed = smoothPrintApkUploadSchema.safeParse({
    versionLabel: form.get("versionLabel") ?? "",
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  if (bytes.byteLength === 0) {
    return NextResponse.json({ error: "empty_file" }, { status: 400 })
  }

  const apk = await smoothPrintApkRepository.create({
    originalName: file.name,
    versionLabel: parsed.data.versionLabel,
    byteSize: bytes.byteLength,
    bytes,
  })

  return NextResponse.json(smoothPrintApkResponseSchema.parse({ apk }), { status: 201 })
}
