import { CHAT_SETTING_LIMITS } from "@/lib/chat-setting-limits"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"

export const runtime = "edge"

export async function POST(request: Request) {
  const json = await request.json()
  const { input } = json as {
    input: string
  }

  try {
    const profile = await getServerProfile()

    checkApiKey(profile.openai_api_key, "OpenAI")

    const openai = createOpenAI({
      apiKey: profile.openai_api_key || undefined,
      organization: profile.openai_organization_id || undefined
    })

    const { text: content } = await generateText({
      model: openai("gpt-4o"),
      messages: [
        { role: "system", content: "Respond to the user." },
        { role: "user", content: input }
      ],
      temperature: 0,
      maxOutputTokens:
        CHAT_SETTING_LIMITS["gpt-4-turbo-preview"].MAX_TOKEN_OUTPUT_LENGTH
    })

    return new Response(JSON.stringify({ content }), {
      status: 200
    })
  } catch (error: any) {
    const errorMessage = error.error?.message || "An unexpected error occurred"
    const errorCode = error.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
