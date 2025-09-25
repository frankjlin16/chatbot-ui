import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ServerRuntime } from "next"
import OpenAI from "openai"

export const runtime: ServerRuntime = "edge"

export async function GET(request: Request) {
  try {
    const profile = await getServerProfile()

    checkApiKey(profile.openai_api_key, "OpenAI")

    const openai = new OpenAI({
      apiKey: profile.openai_api_key || "",
      organization: profile.openai_organization_id
    })

    const url = new URL(request.url)
    const limitParam = url.searchParams.get("limit")
    const after = url.searchParams.get("after") || undefined
    let limit = Number(limitParam ?? 100)
    if (!Number.isFinite(limit) || limit <= 0) limit = 100
    if (limit > 100) limit = 100

    const list = await openai.beta.assistants.list({
      limit,
      after
    })

    return new Response(
      JSON.stringify({
        data: list.data,
        first_id: (list as any).first_id ?? null,
        last_id: (list as any).last_id ?? null,
        has_more: list.has_more ?? false
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    )
  } catch (error: any) {
    const errorMessage = error.error?.message || "An unexpected error occurred"
    const errorCode = error.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode,
      headers: { "Content-Type": "application/json" }
    })
  }
}
