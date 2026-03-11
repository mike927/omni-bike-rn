import { readFileSync } from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as github from '@actions/github';
import * as core from '@actions/core';

async function run() {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const githubToken = process.env.GITHUB_TOKEN;

    if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not set');
    if (!githubToken) throw new Error('GITHUB_TOKEN is not set');

    // Get PR details
    const context = github.context;
    if (!context.payload.pull_request) {
      console.log('Not a pull request event. Exiting.');
      return;
    }

    const prNumber = context.payload.pull_request.number;
    const owner = context.repo.owner;
    const repo = context.repo.repo;

    const octokit = github.getOctokit(githubToken);

    // Fetch the raw diff of the PR
    console.log(`Fetching diff for PR #${prNumber}...`);
    const { data: diffStr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
      mediaType: {
        format: 'diff'
      }
    });

    if (!diffStr || diffStr.length === 0) {
      console.log('No diff found. Exiting.');
      return;
    }

    console.log(`Successfully fetched PR diff (${diffStr.length} chars). Analyzing with Gemini 3.1 Pro...`);

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-pro-preview',
      systemInstruction: `You are the Omni Bike App Senior Code Review Agent. You audit code for architectural integrity and the CI Definition of Done. 
      
Core Directives:
1. Verify strict TypeScript typing (No any or ts-ignore).
2. Ensure the Metronome Engine remains strictly synchronous (1Hz) utilizing the New Architecture (JSI) constraints.
3. Validate UI components properly handle both Portrait and Landscape orientations where applicable.
4. Keep the review constructive, concise, and focused on actual issues or architectural violations.
5. If the code looks perfect, respond with "Review Approved: Code meets Omni Bike CI constraints." Otherwise, list actionable items.`,
    });

    const prompt = `Review the following GitHub Pull Request diff and provide concise, constructive feedback based on the project directives:\n\n\`\`\`diff\n${diffStr}\n\`\`\``;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    console.log('Successfully generated review via Gemini. Posting comment...');

    // Post the review as a comment on the PR
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: `### 🤖 Gemini 3.1 Pro Code Review\n\n${responseText}`
    });

    console.log('Review comment posted successfully.');

  } catch (error) {
    core.setFailed(`AI Code Review Failed: ${error.message}`);
  }
}

run();
