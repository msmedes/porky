import * as github from "@actions/github";
import { Anthropic } from "@anthropic-ai/sdk";
import { env } from "./env";

/*
Porky is a tool that helps you with your pull requests.
Its goal is to autogenerate the why (or por que (or porky)) of a pull request.
It accomplishes this by examining the commits in the pull request and the
diff of the changes.
*/
const anthropic = new Anthropic({
	apiKey: env.ANTHROPIC_API_KEY,
});
const octokit = github.getOctokit(env.GITHUB_TOKEN);

type PullRequestDetails = {
	commits: any[];
	diff: string;
};

async function run() {
	const prDetails = await getPullRequestDetails("facebook", "react", 31132);
	const response = await getAnthropicResponse(prDetails);

	console.log(response);
}

run();

async function getAnthropicResponse({ commits, diff }: PullRequestDetails) {
	const systemPrompt =
		"You are an expert software developer. You are given a list of commits and a diff of the changes in a pull request. You need to write the why (or por que (or porky)) of the pull request.";

	const userPrompt = `Here is the list of commits:
		${commits.map((commit: any) => commit.commit.message.split("\n")[0]).join("\n")}
		Here is the diff of the changes: ${diff}
		`;

	const response = await anthropic.messages.create({
		model: "claude-3-5-sonnet-20240620",
		system: systemPrompt,
		messages: [{ role: "user", content: userPrompt }],
		max_tokens: 1024,
	});
	return response;
}

async function getPullRequestDetails(
	owner: string,
	repo: string,
	pullNumber: number,
): Promise<PullRequestDetails> {
	// Fetch PR commits
	const { data: commits } = await octokit.rest.pulls.listCommits({
		owner,
		repo,
		pull_number: pullNumber,
	});

	// Fetch PR diff
	const { data: diffData } = await octokit.rest.pulls.get({
		owner,
		repo,
		pull_number: pullNumber,
		mediaType: {
			format: "diff",
		},
	});
	console.log(diffData);

	return {
		commits,
		diff: diffData,
	};
}
