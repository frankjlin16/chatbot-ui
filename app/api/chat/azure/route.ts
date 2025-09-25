import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatAPIPayload } from "@/types"
import { streamText } from "ai"
import { createAzure } from "@ai-sdk/azure"

export const runtime = "edge"

export async function POST(request: Request) {
  const json = await request.json()
  const { chatSettings, messages } = json as {
    chatSettings: any
    messages: any[]
  }

  try {
    const profile = await getServerProfile()

    checkApiKey(profile.azure_openai_api_key, "Azure OpenAI")

    const ENDPOINT = profile.azure_openai_endpoint
    const KEY = profile.azure_openai_api_key

    let DEPLOYMENT_ID = ""
    switch (chatSettings.model) {
      case "gpt-3.5-turbo":
        DEPLOYMENT_ID = profile.azure_openai_35_turbo_id || ""
        break
      case "gpt-4-turbo-preview":
        DEPLOYMENT_ID = profile.azure_openai_45_turbo_id || ""
        break
      case "gpt-4-vision-preview":
        DEPLOYMENT_ID = profile.azure_openai_45_vision_id || ""
        break
      default:
        return new Response(JSON.stringify({ message: "Model not found" }), {
          status: 400
        })
    }

    if (!ENDPOINT || !KEY || !DEPLOYMENT_ID) {
      return new Response(
        JSON.stringify({ message: "Azure resources not found" }),
        {
          status: 400
        }
      )
    }

    // Prefer explicit instance to support custom base URL/resource if provided
    // Derive resourceName from endpoint URL: https://<resourceName>.openai.azure.com
    let resourceName: string | undefined
    try {
      const url = new URL(ENDPOINT)
      resourceName = url.hostname.split(".")[0]
    } catch {
      resourceName = undefined
    }

    const azureProvider = createAzure({
      apiKey: profile.azure_openai_api_key ?? undefined,
      resourceName
    })

    const result = await streamText({
      model: azureProvider(DEPLOYMENT_ID), // Azure uses deployment name for model
      messages,
      temperature: chatSettings.temperature
    })


    return result.toTextStreamResponse()
  } catch (error: any) {
    const errorMessage = error.error?.message || "An unexpected error occurred"
    const errorCode = error.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
