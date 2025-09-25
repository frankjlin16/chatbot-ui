import { generateLocalEmbedding } from "@/lib/generate-local-embedding"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { Database } from "@/supabase/types"
import { createClient } from "@supabase/supabase-js"
import { embed } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createAzure } from "@ai-sdk/azure"

export async function POST(request: Request) {
  const json = await request.json()
  const { userInput, fileIds, embeddingsProvider, sourceCount } = json as {
    userInput: string
    fileIds: string[]
    embeddingsProvider: "openai" | "local"
    sourceCount: number
  }

  const uniqueFileIds = [...new Set(fileIds)]

  try {
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const profile = await getServerProfile()

    if (embeddingsProvider === "openai") {
      if (profile.use_azure_openai) {
        checkApiKey(profile.azure_openai_api_key, "Azure OpenAI")
      } else {
        checkApiKey(profile.openai_api_key, "OpenAI")
      }
    }

    let chunks: any[] = []

    if (embeddingsProvider === "openai") {
      let queryEmbedding: number[]
      if (profile.use_azure_openai) {
        const resourceName = profile.azure_openai_endpoint
          ? new URL(profile.azure_openai_endpoint).hostname.split(".")[0]
          : undefined
        const azureProvider = createAzure({
          apiKey: profile.azure_openai_api_key || undefined,
          resourceName
        })
        const { embedding } = await embed({
          model: azureProvider.textEmbedding(profile.azure_openai_embeddings_id!),
          value: userInput
        })
        queryEmbedding = embedding
      } else {
        const openai = createOpenAI({
          apiKey: profile.openai_api_key || undefined,
          organization: profile.openai_organization_id || undefined
        })
        const { embedding } = await embed({
          model: openai.textEmbeddingModel("text-embedding-3-small"),
          value: userInput
        })
        queryEmbedding = embedding
      }

      const { data: openaiFileItems, error: openaiError } =
        await supabaseAdmin.rpc("match_file_items_openai", {
          query_embedding: queryEmbedding as any,
          match_count: sourceCount,
          file_ids: uniqueFileIds
        })

      if (openaiError) {
        throw openaiError
      }

      chunks = openaiFileItems
    } else if (embeddingsProvider === "local") {
      const localEmbedding = await generateLocalEmbedding(userInput)

      const { data: localFileItems, error: localFileItemsError } =
        await supabaseAdmin.rpc("match_file_items_local", {
          query_embedding: localEmbedding as any,
          match_count: sourceCount,
          file_ids: uniqueFileIds
        })

      if (localFileItemsError) {
        throw localFileItemsError
      }

      chunks = localFileItems
    }

    const mostSimilarChunks = chunks?.sort(
      (a, b) => b.similarity - a.similarity
    )

    return new Response(JSON.stringify({ results: mostSimilarChunks }), {
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
