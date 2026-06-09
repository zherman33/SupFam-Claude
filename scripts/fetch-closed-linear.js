import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Simple .env.local parser to avoid external dependencies
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value;
    }
  });
}

const apiKey = process.env.LINEAR_API_KEY;
if (!apiKey) {
  console.error('Error: LINEAR_API_KEY is not defined in .env.local');
  process.exit(1);
}

// 2. Fetch completed issues from Linear GraphQL API
const query = `
  query {
    issues(filter: { state: { type: { eq: "completed" } } }) {
      nodes {
        identifier
        title
        description
        state {
          name
        }
        completedAt
        assignee {
          name
        }
      }
    }
  }
`;

async function fetchClosed() {
  console.log('Fetching completed tasks from Linear...');
  try {
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (result.errors) {
      throw new Error(JSON.stringify(result.errors));
    }

    const issues = result.data.issues.nodes;
    console.log(`Successfully fetched ${issues.length} completed issues.`);

    // Sort by completion date descending
    issues.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

    // 3. Format into a markdown file
    let mdContent = `# Completed Linear Tasks — Sup Fam\n\n`;
    mdContent += `*Last synced: ${new Date().toLocaleString()}*\n\n`;

    if (issues.length === 0) {
      mdContent += `No completed tasks found in your Linear workspace.\n`;
    } else {
      issues.forEach(issue => {
        const assignee = issue.assignee ? issue.assignee.name : 'Unassigned';
        const dateStr = issue.completedAt ? new Date(issue.completedAt).toLocaleDateString() : 'N/A';
        mdContent += `### [${issue.identifier}] ${issue.title}\n`;
        mdContent += `- **Status**: \`${issue.state.name}\`\n`;
        mdContent += `- **Completed**: ${dateStr}\n`;
        mdContent += `- **Assignee**: ${assignee}\n`;
        if (issue.description) {
          mdContent += `- **Description**:\n  \`\`\`\n  ${issue.description.trim().replace(/\n/g, '\n  ')}\n  \`\`\`\n`;
        }
        mdContent += `\n`;
      });
    }

    const outputPath = path.join(__dirname, '..', 'closed_linear_tasks.md');
    fs.writeFileSync(outputPath, mdContent, 'utf8');
    console.log(`Saved completed tasks to ${outputPath}`);
  } catch (error) {
    console.error('Failed to fetch from Linear API:', error);
    process.exit(1);
  }
}

fetchClosed();
