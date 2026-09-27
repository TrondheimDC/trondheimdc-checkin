import { NextRequest, NextResponse } from "next/server"
import { isSession, requireAdminApiSession } from "@/lib/auth-api"
import {
  smoothPrintApkResponseSchema,
  smoothPrintApkUploadSchema,
  smoothPrintApksResponseSchema,
} from "@/lib/db/schema"
import { apkUploadErrorMessage, resolveApkUpload } from "@/lib/smooth-print-apk-upload"
import { smoothPrintApkRepository } from "@/lib/smooth-print-apks"

export const runtime = "nodejs"

export async function GET() {
  const session = await requireAdminApiSession()
  if (!isSession(session)) return session

  const apks = await smoothPrintApkRepository.list()
  return NextResponse.json(smoothPrintApksResponseSchema.parse({ apks }))
}

export async function POST(request: NextRequest) {
  const session = await requireAdminApiSession()
  if (!isSession(session)) return session

  const form = await request.formData().catch(() => null)
  if (!form) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 })
  }

  const parsed = smoothPrintApkUploadSchema.safeParse({
    versionLabel: form.get("versionLabel") ?? "",
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const resolved = resolveApkUpload(file.name, Buffer.from(await file.arrayBuffer()))
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error, message: apkUploadErrorMessage(resolved.error) },
      { status: 400 },
    )
  }

  const apk = await smoothPrintApkRepository.create({
    originalName: resolved.originalName,
    versionLabel: parsed.data.versionLabel,
    byteSize: resolved.bytes.byteLength,
    bytes: resolved.bytes,
  })

  return NextResponse.json(smoothPrintApkResponseSchema.parse({ apk }), { status: 201 })
}
