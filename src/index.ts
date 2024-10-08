import * as github from "@actions/github";
import { Anthropic } from "@anthropic-ai/sdk";
import { env } from "./env";

/*
Porky is a tool that helps you with your pull requests.
Its goal is to autogenerate the why (or por que (or porky)) of a pull request.
It accomplishes this by examining the commits in the pull request and the
diff of the changes.
*/

type PRDetails = {
	commits: any[];
	diff: string;
	prTemplate: string;
};

class GithubClient {
	private octokit: Octokit;
	private owner: string;
	private repo: string;
	private pullNumber: number;
	private prDetails: PRDetails | null;
	private commits: any[] | null;
	private diff: string | null;
	private prTemplate: string | null;

	constructor(token: string, owner: string, repo: string, pullNumber: number) {
		this.octokit = github.getOctokit(token);
		this.owner = owner;
		this.repo = repo;
		this.pullNumber = pullNumber;
		this.prDetails = null;
		this.commits = null;
		this.diff = null;
		this.prTemplate = null;
	}

	async getCommits(): Promise<any[]> {
		const { data: commits } = await this.octokit.rest.pulls.listCommits({
			owner: this.owner,
			repo: this.repo,
			pull_number: this.pullNumber,
		});
		this.commits = commits;
	}

	async getPullRequestDiff(): Promise<string> {
		const { data: diffData } = await this.octokit.rest.pulls.get({
			owner: this.owner,
			repo: this.repo,
			pull_number: this.pullNumber,
			mediaType: {
				format: "diff",
			},
		});
		this.diff = diffData;
	}

	async getPullRequestTemplate() {
		const { data: templateData } = await this.octokit.rest.repos.getContent({
			owner: this.owner,
			repo: this.repo,
			path: ".github/PULL_REQUEST_TEMPLATE.md",
		});
		this.prTemplate = Buffer.from(templateData.content, "base64").toString(
			"utf-8",
		);
		console.log(this.prTemplate);
	}

	async getPullRequestDetails() {
		await this.getCommits();
		await this.getPullRequestDiff();
		await this.getPullRequestTemplate();
		this.prDetails = {
			commits: this.commits,
			diff: this.diff,
			prTemplate: this.prTemplate,
		};
		return this.prDetails;
	}
}

class Porky {
	private anthropic: Anthropic;
	private prDetails: PRDetails;

	constructor(token: string, prDetails: PRDetails) {
		this.anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
		this.prDetails = prDetails;
	}

	async summarize() {
		const systemPrompt =
			"You are an expert software developer. You are given a list of commits and a diff of the changes in a pull request. You need to write the why of the pull request.";

		const userPrompt = `Here is the list of commits:
		${this.prDetails.commits.map((commit: any) => commit.commit.message.split("\n")[0]).join("\n")}

		Here is the diff of the changes: ${this.prDetails.diff}
		

    ${
			this.prDetails.prTemplate
				? `Here is the pull request template, use this to format your response.  If there are instructions in the template *for how to use the template*, ignore them.
        <PR_TEMPLATE>
    ${this.prDetails.prTemplate}
    </PR_TEMPLATE>`
				: "No template provided"
		}

    Based on this information, please provide a concise explanation of why this pull request was created and what it aims to achieve.`;

		console.log("userPrompt", userPrompt);
		return await this.anthropic.messages.create({
			model: "claude-3-5-sonnet-20240620",
			system: systemPrompt,
			messages: [{ role: "user", content: userPrompt }],
			max_tokens: 1024,
		});
	}
}

async function run() {
	const githubClient = new GithubClient(
		env.GITHUB_TOKEN,
		"facebook",
		"react",
		31132,
	);
	const prDetails = await githubClient.getPullRequestDetails();
	const porky = new Porky(env.ANTHROPIC_API_KEY, prDetails);
	const response = await porky.summarize();

	console.log(response);
}

run();
