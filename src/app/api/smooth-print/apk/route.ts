import { createReadStream, existsSync } from "fs"
import { NextResponse } from "next/server"
import { Readable } from "stream"
import { isSession, requireDoorApiSession } from "@/lib/auth-api"
import { apkFilePath, smoothPrintApkRepository } from "@/lib/smooth-print-apks"

export const runtime = "nodejs"

export async function GET() {
  const session = await requireDoorApiSession()
  if (!isSession(session)) return session

  const active = await smoothPrintApkRepository.getActive()
  if (!active) {
    return NextResponse.json({ error: "no_active_apk" }, { status: 404 })
  }

  const path = apkFilePath(active.storedName)
  if (!existsSync(path)) {
    return NextResponse.json({ error: "file_missing" }, { status: 404 })
  }

  const stream = Readable.toWeb(createReadStream(path)) as ReadableStream
  const filename = active.originalName.toLowerCase().endsWith(".apk")
    ? active.originalName
    : `${active.originalName}.apk`

  return new NextResponse(stream, {
    headers: {
      "content-type": "application/vnd.android.package-archive",
      "content-disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      "content-length": String(active.byteSize),
      "cache-control": "private, no-store",
    },
  })
}
