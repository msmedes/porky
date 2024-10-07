import { z } from "zod";

export const env = z
	.object({
		ANTHROPIC_API_KEY: z.string(),
		GITHUB_TOKEN: z.string(),
	})
	.parse(process.env);
