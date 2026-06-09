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

// 2. Fetch issues from Linear GraphQL API
const query = `
  query {
    issues(filter: { state: { type: { nin: ["completed", "canceled"] } } }) {
      nodes {
        identifier
        title
        description
        state {
          name
        }
        priorityLabel
        assignee {
          name
        }
      }
    }
  }
`;

async function syncLinear() {
  console.log('Fetching tasks from Linear...');
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
    console.log(`Successfully fetched ${issues.length} active issues.`);

    // 3. Format into a beautiful markdown file
    let mdContent = `# Active Linear Tasks — Sup Fam\n\n`;
    mdContent += `*Last synced: ${new Date().toLocaleString()}*\n\n`;

    if (issues.length === 0) {
      mdContent += `🎉 No active tasks found in your Linear workspace! All clear.\n`;
    } else {
      issues.forEach(issue => {
        const assignee = issue.assignee ? issue.assignee.name : 'Unassigned';
        const priority = issue.priorityLabel !== 'No priority' ? ` [${issue.priorityLabel}]` : '';
        mdContent += `### [${issue.identifier}] ${issue.title}\n`;
        mdContent += `- **Status**: \`${issue.state.name}\`\n`;
        mdContent += `- **Assignee**: ${assignee}${priority}\n`;
        if (issue.description) {
          mdContent += `- **Description**:\n  \`\`\`\n  ${issue.description.trim().replace(/\n/g, '\n  ')}\n  \`\`\`\n`;
        }
        mdContent += `\n`;
      });
    }

    const outputPath = path.join(__dirname, '..', 'linear_tasks.md');
    fs.writeFileSync(outputPath, mdContent, 'utf8');
    console.log(`Saved tasks to ${outputPath}`);
  } catch (error) {
    console.error('Failed to fetch from Linear API:', error);
    process.exit(1);
  }
}

syncLinear();
