import { GenerationConfig, HarmBlockThreshold, HarmCategory, VertexAI } from "@google-cloud/vertexai";

export const getVertexAI = () => {
  const generationConfig: GenerationConfig = {
    top_k: 10,
    top_p: 0.85,
    temperature: 0.5,
    candidate_count: 1,
    max_output_tokens: 524,
  };

  const vertexAi = new VertexAI({
    project: process.env.NEXT_PUBLIC_GCP_PROJECT_ID as string,
    location: process.env.NEXT_PUBLIC_GCP_LOCATION as string,
    googleAuthOptions: {
      credentials: {
        client_email: process.env.NEXT_PUBLIC_GCP_CLIENT_EMAIL as string,
        private_key: process.env.NEXT_PUBLIC_GCP_PRIVATE_KEY as string,
      },
    },
  });

  // Instantiate models
  const generativeModel = vertexAi.getGenerativeModel({
    model: "gemini-1.0-pro",
    generation_config: generationConfig,
    safety_settings: [
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ],
  });
  return { generativeModel };
};
