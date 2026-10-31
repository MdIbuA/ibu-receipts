/*
  The skills a job description can ask for, and what I can show for each.

    proven   a file at a pinned commit (or a public link) that shows the skill
    partial  something public but thin, or my word alone, and the note says which
    none     nothing to show, and the receipt says so

  Every file below names the text that must sit on that exact line. Two checks
  hold it to that: test/skills.test.ts reads this site's own files, and
  scripts/check-evidence.ts reads every other project at its pinned commit.
*/
import type { ClaimId } from "./claims.ts";
import type { ProjectId } from "./projects.ts";
import type { NonEmpty } from "./types.ts";

export interface FileEvidence {
  readonly kind: "file";
  readonly project: ProjectId;
  readonly path: string;
  readonly line: number;
  /** Text that must appear on that line. */
  readonly shows: string;
}

export interface LinkEvidence {
  readonly kind: "link";
  readonly label: string;
  readonly url: string;
}

export type SkillEvidence = FileEvidence | LinkEvidence;

export type Proof =
  | { readonly kind: "proven"; readonly evidence: NonEmpty<SkillEvidence> }
  | { readonly kind: "partial"; readonly note: string; readonly claim?: ClaimId; readonly evidence?: readonly LinkEvidence[] }
  | { readonly kind: "none"; readonly note: string };

export type ProofKind = Proof["kind"];

export interface Skill {
  readonly id: string;
  /** How the receipt prints it. */
  readonly label: string;
  /** Patterns that find it in a job description. */
  readonly find: NonEmpty<RegExp>;
  readonly proof: Proof;
}

// ---------- building blocks ----------

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Whole-phrase patterns. Longest phrase first, so "AWS Lambda" wins over "Lambda";
 * spaces also match hyphens, so "machine learning" finds "Machine-Learning".
 */
function phrases(flags: "i" | "", list: readonly string[]): RegExp {
  const body = [...list]
    .sort((a, b) => b.length - a.length)
    .map((phrase) => escape(phrase).replace(/ /g, "[\\s-]+"))
    .join("|");
  return new RegExp(`(?<![\\w#+.])(?:${body})(?![\\w#+])`, flags);
}

/** Any case: "python", "Python" and "PYTHON" are all Python. */
const any = (...list: [string, ...string[]]): RegExp => phrases("i", list);
/** Exact case: "React" the library, not "react" the verb; "SAM" the AWS tool, not Sam. */
const cased = (...list: [string, ...string[]]): RegExp => phrases("", list);

const file = (project: ProjectId, path: string, line: number, shows: string): FileEvidence =>
  ({ kind: "file", project, path, line, shows });
const link = (label: string, url: string): LinkEvidence => ({ kind: "link", label, url });

const proven = (...evidence: [SkillEvidence, ...SkillEvidence[]]): Proof => ({ kind: "proven", evidence });
const partial = (note: string, more: { readonly claim?: ClaimId; readonly evidence?: readonly LinkEvidence[] } = {}): Proof =>
  ({ kind: "partial", note, ...more });
const none = (note = "No public receipt."): Proof => ({ kind: "none", note });

const STUDIED = "Studied, not yet shipped.";
const NOTEBOOK = "milestone 2/bitcoin-infy.ipynb";
const SERVER_REQS = "WebApplication/server/requirements.txt";
const RECHECK = "infra/recheck/template.yaml";
const DEMO = link("Crisis Response Coordinator: demo video", "https://youtu.be/Vp-1W_Ry3mM");
const ARTICLE = "https://builder.aws.com/content/3IXxyXBIA0XvQy27nJLaev2clbM/weekend-showcase-challenge-documind-ai";

// ---------- the skills ----------

export const SKILLS = [
  // Languages
  { id: "python", label: "Python", find: [any("Python")],
    proof: proven(file("gitbard", "src/app.py", 7, "import boto3"), file("ghostprobe", "code/ghost_audit/s3_probe.py", 131, "list_object_versions")) },
  { id: "typescript", label: "TypeScript", find: [any("TypeScript")],
    proof: proven(file("supermarket", "tsconfig.json", 8, "\"strict\": true"), file("site", "tsconfig.json", 16, "\"strict\": true")) },
  { id: "javascript", label: "JavaScript", find: [any("JavaScript", "JS", "ES6", "ECMAScript")],
    proof: proven(file("celebrai", "js/budget-engine.js", 71, "export function templateFor"), file("votersaathi", "server.js", 2, "require('express')")) },
  { id: "node", label: "Node.js", find: [any("Node.js", "NodeJS", "Node JS"), cased("Node")],
    proof: proven(file("votersaathi", "server.js", 2, "require('express')"), file("supermarket", "src/index.ts", 1, "import dotenv")) },
  { id: "sql", label: "SQL", find: [cased("SQL"), any("T-SQL", "relational database", "relational databases")],
    proof: proven(file("unileave", "database/create_tables.sql", 1, "CREATE TABLE"), file("supermarket", "prisma/schema.prisma", 2, "PostgreSQL")) },
  { id: "plsql", label: "PL/SQL and Oracle APEX", find: [any("PL/SQL", "Oracle APEX", "Oracle Database", "Oracle DB")],
    proof: proven(file("unileave", "README.md", 173, "PL/SQL"), file("unileave", "README.md", 8, "Oracle APEX")) },
  { id: "html-css", label: "HTML and CSS", find: [any("HTML", "HTML5", "CSS", "CSS3", "semantic HTML")],
    proof: proven(file("site", "site/index.html", 1, "<!doctype html>"), file("celebrai", "css/styles.css", 7, ":root")) },
  { id: "shell", label: "Shell scripting", find: [any("Bash", "shell scripting", "shell scripts", "shell script")],
    proof: proven(file("site", "scripts/stamp-build.sh", 6, "set -euo pipefail")) },
  { id: "java", label: "Java", find: [/(?<![\w#+.])Java(?![\w#+])(?!\s*Script)/i], proof: none(STUDIED) },
  { id: "cpp", label: "C++", find: [any("C++")], proof: none(STUDIED) },
  { id: "csharp", label: "C# and .NET", find: [any("C#", ".NET", "ASP.NET", "dotnet")], proof: none() },
  { id: "go", label: "Go", find: [/(?<![\w#+.])(?:[Gg]olang|Go(?=\s*(?:[,/;()]|and\b|or\b|$)))/], proof: none() },
  { id: "rust", label: "Rust", find: [cased("Rust")], proof: none() },
  { id: "kotlin", label: "Kotlin", find: [any("Kotlin")], proof: none() },
  { id: "swift", label: "Swift", find: [cased("Swift", "SwiftUI")], proof: none() },
  { id: "php", label: "PHP", find: [any("PHP", "Laravel")], proof: none() },
  { id: "ruby", label: "Ruby", find: [any("Ruby", "Ruby on Rails")], proof: none() },

  // AI and ML
  { id: "llm", label: "LLM features", find: [any("LLM", "LLMs", "large language model", "large language models", "generative AI", "GenAI", "Gen AI", "foundation model", "foundation models")],
    proof: proven(file("supermarket", "package.json", 20, "@anthropic-ai/sdk"), file("documind", "backend/bedrock_client.py", 18, "bedrock-runtime")) },
  { id: "agents", label: "AI agents and tool calling", find: [any("AI agents", "AI agent", "agentic", "agents", "agent", "multi-agent", "tool calling", "tool use", "function calling")],
    proof: proven(file("supermarket", "src/tools/registry.ts", 15, "export const ALL_TOOLS"), file("supermarket", "src/agent/runtime.ts", 10, "MAX_TOOL_ROUNDS = 15")) },
  { id: "bedrock", label: "Amazon Bedrock", find: [any("Amazon Bedrock", "AWS Bedrock", "Bedrock")],
    proof: proven(file("documind", "backend/bedrock_client.py", 18, "bedrock-runtime"), file("gitbard", "src/app.py", 19, "BEDROCK_MODEL_ID")) },
  { id: "claude", label: "Claude (Anthropic API)", find: [any("Claude", "Anthropic")],
    proof: proven(file("supermarket", "package.json", 20, "@anthropic-ai/sdk")) },
  { id: "gemini", label: "Gemini API", find: [any("Gemini")],
    proof: proven(file("votersaathi", "server.js", 127, "gemini-2.0-flash")) },
  { id: "strands", label: "Strands Agents", find: [any("Strands Agents", "Strands")],
    proof: proven(file("tripwire", "requirements.txt", 1, "strands-agents"), file("ghostprobe", "code/requirements.txt", 4, "strands-agents")) },
  { id: "ai-security", label: "AI security and guardrails", find: [any("prompt injection", "AI security", "LLM security", "guardrails", "AI safety", "red teaming", "jailbreak", "jailbreaks")],
    proof: proven(file("tripwire", "README.md", 1, "prompt injection"), file("tripwire", "tripwire/provenance_guard.py", 8, "never the emails")) },
  { id: "prompting", label: "Prompt engineering", find: [any("prompt engineering", "prompt design", "prompting", "prompts")],
    proof: proven(file("supermarket", "src/agent/system-prompt.ts", 7, "getSystemPrompt"), file("tinytale", "backend/lambda_function.py", 34, "System prompt")) },
  { id: "rag", label: "RAG", find: [cased("RAG"), any("retrieval-augmented generation", "retrieval augmented generation", "retrieval-augmented")],
    proof: partial("A RAG prototype, shown in a demo video; its code isn't public. DocuMind AI has no retrieval.", { evidence: [DEMO] }) },
  { id: "langchain", label: "LangChain", find: [any("LangChain")],
    proof: partial("Used in that RAG prototype: demo video only, code not public.", { evidence: [DEMO] }) },
  { id: "vectors", label: "Vector databases and embeddings", find: [any("vector database", "vector databases", "vector store", "vector stores", "vector search", "embeddings", "pgvector", "Pinecone", "FAISS", "ChromaDB", "Weaviate", "Milvus")], proof: none() },
  { id: "ml", label: "Machine learning", find: [any("machine learning"), cased("ML")],
    proof: proven(file("cryptopulse", NOTEBOOK, 1457, "LSTM Network")) },
  { id: "deep-learning", label: "Deep learning", find: [any("deep learning", "neural network", "neural networks", "LSTM", "LSTMs", "RNN", "RNNs")],
    proof: proven(file("cryptopulse", NOTEBOOK, 1457, "LSTM Network")) },
  { id: "tensorflow", label: "TensorFlow and Keras", find: [any("TensorFlow", "Keras")],
    proof: proven(file("cryptopulse", SERVER_REQS, 8, "tensorflow"), file("cryptopulse", NOTEBOOK, 1478, "keras")) },
  { id: "pytorch", label: "PyTorch", find: [any("PyTorch")], proof: none() },
  { id: "sklearn", label: "scikit-learn", find: [any("scikit-learn", "sklearn", "scikit learn")],
    proof: proven(file("cryptopulse", SERVER_REQS, 11, "scikit-learn")) },
  { id: "pandas", label: "pandas", find: [any("pandas")], proof: proven(file("cryptopulse", SERVER_REQS, 6, "pandas")) },
  { id: "numpy", label: "NumPy", find: [any("NumPy")], proof: proven(file("cryptopulse", SERVER_REQS, 7, "numpy")) },
  { id: "jupyter", label: "Jupyter", find: [any("Jupyter", "Jupyter notebooks")],
    proof: proven(file("cryptopulse", "data_preprocessing.ipynb", 2, "\"cells\"")) },
  { id: "time-series", label: "Time-series forecasting", find: [any("time series", "time-series", "forecasting")],
    proof: proven(file("cryptopulse", NOTEBOOK, 1457, "LSTM Network")) },
  { id: "evaluation", label: "Model evaluation", find: [any("model evaluation", "evaluating models", "evaluate models", "held-out data", "held out data", "held-out", "backtesting", "validation set", "test set")],
    proof: proven(file("cryptopulse", NOTEBOOK, 1734, "Evaluating Model")) },
  { id: "nlp", label: "NLP", find: [any("NLP", "natural language processing", "named entity recognition", "entity extraction", "sentiment analysis", "text classification", "summarization", "summarisation")],
    proof: proven(file("documind", "backend/lambda_function.py", 9, "Named entity extraction"), file("documind", "frontend/src/components/SentimentPanel.jsx", 2, "SentimentPanel")) },
  { id: "vision", label: "Computer vision", find: [any("computer vision", "image classification", "CNN", "CNNs", "convolutional neural network", "convolutional neural networks", "transfer learning")],
    proof: partial("A bone-density X-ray classifier (Xception, MobileNet, Grad-CAM). Its code isn't public, so I quote no accuracy.") },
  { id: "huggingface", label: "Hugging Face", find: [any("Hugging Face", "HuggingFace")], proof: none() },
  { id: "mlops", label: "MLOps", find: [any("MLOps", "model monitoring", "experiment tracking", "MLflow", "Kubeflow", "model deployment")], proof: none() },
  { id: "sagemaker", label: "SageMaker", find: [any("SageMaker")], proof: none() },
  { id: "quantum", label: "Quantum computing", find: [any("quantum computing", "quantum", "Qiskit")],
    proof: partial("Self-reported: I ran an IBM Qiskit Fall Fest workshop.", { claim: "qiskit" }) },

  // AWS
  { id: "aws", label: "AWS", find: [cased("AWS"), any("Amazon Web Services")],
    proof: proven(file("site", RECHECK, 1, "AWSTemplateFormatVersion"), file("gitbard", "template.yaml", 1, "AWSTemplateFormatVersion")) },
  { id: "lambda", label: "AWS Lambda", find: [any("AWS Lambda", "Lambda", "Lambda functions")],
    proof: proven(file("site", RECHECK, 40, "AWS::Serverless::Function"), file("gitbard", "template.yaml", 42, "AWS::Serverless::Function"), file("documind", "backend/lambda_function.py", 34, "def lambda_handler")) },
  { id: "api-gateway", label: "Amazon API Gateway", find: [any("Amazon API Gateway", "AWS API Gateway", "API Gateway")],
    proof: proven(file("site", RECHECK, 26, "AWS::Serverless::HttpApi"), file("tinytale", "README.md", 13, "API Gateway")) },
  { id: "s3", label: "Amazon S3", find: [any("Amazon S3", "AWS S3", "S3")],
    proof: proven(file("ghostprobe", "code/ghost_audit/s3_probe.py", 131, "list_object_versions"), file("documind", "README.md", 34, "Amazon S3")) },
  { id: "cloudfront", label: "CloudFront and CDNs", find: [any("CloudFront", "CDN", "CDNs", "content delivery network")],
    proof: proven(file("documind", "cf-distribution.json", 5, "\"Origins\""), file("documind", "README.md", 34, "CloudFront")) },
  { id: "iam", label: "IAM and least privilege", find: [any("IAM", "least privilege", "least-privilege", "identity and access management")],
    proof: proven(file("ghostprobe", "docs/s3_probe_iam_policy.json", 6, "\"Effect\": \"Allow\""), file("site", RECHECK, 58, "amplify:ListJobs")) },
  { id: "eventbridge", label: "EventBridge schedules", find: [any("EventBridge", "CloudWatch Events", "cron jobs", "scheduled jobs")],
    proof: proven(file("gitbard", "template.yaml", 74, "cron(0 16 ? * FRI *)")) },
  { id: "ses", label: "Amazon SES", find: [any("Amazon SES", "SES", "Simple Email Service")],
    proof: proven(file("gitbard", "template.yaml", 67, "ses:SendEmail")) },
  { id: "iac", label: "Infrastructure as code (SAM, CloudFormation)", find: [any("infrastructure as code", "infrastructure-as-code", "IaC", "CloudFormation", "AWS SAM", "Serverless Application Model"), cased("SAM")],
    proof: proven(file("gitbard", "template.yaml", 2, "AWS::Serverless-2016-10-31"), file("site", RECHECK, 2, "AWS::Serverless-2016-10-31")) },
  { id: "cdk", label: "AWS CDK", find: [any("AWS CDK", "CDK", "Cloud Development Kit")], proof: none() },
  { id: "terraform", label: "Terraform", find: [any("Terraform", "OpenTofu", "Pulumi")], proof: none() },
  { id: "amplify", label: "AWS Amplify", find: [any("AWS Amplify", "Amplify")],
    proof: proven(file("site", "amplify.yml", 25, "baseDirectory: site"), file("tinytale", "amplify.yml", 8, "baseDirectory")) },
  { id: "cloudwatch", label: "CloudWatch and observability", find: [any("CloudWatch", "observability", "logging and monitoring")],
    proof: proven(file("site", RECHECK, 72, "AWS::Logs::LogGroup")) },
  { id: "ec2", label: "Amazon EC2", find: [any("Amazon EC2", "EC2")],
    proof: proven(file("tripwire", "deploy/deploy_ec2.py", 1, "free-tier EC2 instance")) },
  { id: "aws-sdk", label: "AWS SDK (boto3)", find: [any("boto3", "AWS SDK", "AWS SDKs")],
    proof: proven(file("ghostprobe", "code/requirements.txt", 3, "boto3"), file("gitbard", "src/app.py", 7, "import boto3")) },
  { id: "serverless", label: "Serverless", find: [any("serverless")],
    proof: proven(file("gitbard", "template.yaml", 42, "AWS::Serverless::Function"), file("site", RECHECK, 40, "AWS::Serverless::Function")) },
  { id: "dynamodb", label: "DynamoDB", find: [any("DynamoDB")], proof: none() },
  { id: "step-functions", label: "Step Functions", find: [any("AWS Step Functions", "Step Functions")], proof: none() },
  { id: "messaging", label: "SQS, SNS or Kinesis", find: [any("SQS", "SNS", "Kinesis", "message queue", "message queues", "pub/sub")], proof: none() },
  { id: "aws-containers", label: "ECS, EKS or Fargate", find: [any("ECS", "EKS", "Fargate")], proof: none() },
  { id: "rds", label: "RDS or Aurora", find: [any("RDS", "Aurora")], proof: none() },
  { id: "cognito", label: "Cognito", find: [any("Cognito")], proof: none() },

  // Cloud and DevOps
  { id: "gcp", label: "Google Cloud (Cloud Run)", find: [any("Google Cloud", "Google Cloud Platform", "GCP", "Cloud Run")],
    proof: proven(file("votersaathi", "README.md", 101, "Cloud Run"), file("votersaathi", "Dockerfile", 1, "FROM node:20-slim")) },
  { id: "azure", label: "Azure", find: [any("Azure", "Microsoft Azure")], proof: none(STUDIED) },
  { id: "docker", label: "Docker", find: [any("Docker", "Dockerfile", "Docker Compose", "containers", "containerization", "containerisation", "containerized")],
    proof: proven(file("votersaathi", "Dockerfile", 1, "FROM node:20-slim"), file("supermarket", "docker-compose.yml", 5, "postgres:16-alpine")) },
  { id: "kubernetes", label: "Kubernetes", find: [any("Kubernetes", "K8s", "Helm")], proof: none(STUDIED) },
  { id: "ci-cd", label: "CI/CD", find: [any("CI/CD", "CI / CD", "CI", "continuous integration", "continuous delivery", "continuous deployment", "deployment pipelines", "build pipelines")],
    proof: proven(file("site", "amplify.yml", 17, "npm test"), file("site", ".github/workflows/ci.yml", 31, "npm test")) },
  { id: "github-actions", label: "GitHub Actions", find: [any("GitHub Actions")],
    proof: proven(file("site", ".github/workflows/ci.yml", 15, "runs-on")) },
  { id: "git", label: "Git and GitHub", find: [any("Git", "GitHub", "version control", "source control")],
    proof: proven(link("This site's commit history", "https://github.com/MdIbuA/ibu-receipts/commits/main")) },

  // Web and APIs
  { id: "react", label: "React", find: [/(?<![\w#+.])React(?:\.?js|JS)?(?![\w#+])(?!\s+Native)/],
    proof: proven(file("documind", "frontend/package.json", 15, "\"react\""), file("cryptopulse", "WebApplication/client/package.json", 15, "\"react\"")) },
  { id: "react-native", label: "React Native", find: [any("React Native")], proof: none() },
  { id: "vite", label: "Vite", find: [any("Vite")], proof: proven(file("documind", "frontend/vite.config.js", 2, "defineConfig")) },
  { id: "tailwind", label: "Tailwind CSS", find: [any("Tailwind", "Tailwind CSS", "TailwindCSS")],
    proof: proven(file("cryptopulse", "WebApplication/client/package.json", 26, "tailwindcss")) },
  { id: "nextjs", label: "Next.js", find: [any("Next.js", "NextJS", "Next JS")], proof: none() },
  { id: "angular", label: "Angular", find: [any("Angular")], proof: none() },
  { id: "vue", label: "Vue", find: [any("Vue", "Vue.js", "VueJS", "Nuxt")], proof: none() },
  { id: "svelte", label: "Svelte", find: [any("Svelte", "SvelteKit")], proof: none() },
  { id: "express", label: "Express", find: [any("Express.js", "ExpressJS"), cased("Express")],
    proof: proven(file("votersaathi", "package.json", 11, "\"express\"")) },
  { id: "fastapi", label: "FastAPI", find: [any("FastAPI")],
    proof: proven(file("cryptopulse", SERVER_REQS, 1, "fastapi"), file("tripwire", "web/server.py", 21, "from fastapi import FastAPI")) },
  { id: "django", label: "Django", find: [any("Django")], proof: none() },
  { id: "flask", label: "Flask", find: [any("Flask")], proof: none() },
  { id: "spring", label: "Spring Boot", find: [any("Spring Boot", "Spring Framework", "Spring MVC")], proof: none() },
  { id: "apis", label: "APIs (REST, HTTP)", find: [cased("REST", "RESTful", "API", "APIs"), any("restful", "web services", "HTTP API", "HTTP APIs")],
    proof: proven(file("site", RECHECK, 67, "Path: /recheck"), file("tripwire", "web/server.py", 97, "@app.post")) },
  { id: "graphql", label: "GraphQL", find: [any("GraphQL")], proof: none() },
  { id: "auth", label: "Authentication (OAuth, JWT)", find: [any("OAuth", "OAuth2", "OAuth 2.0", "JWT", "JWTs", "SSO", "authentication", "authorization")],
    proof: proven(file("cryptopulse", SERVER_REQS, 4, "python-jose"), file("cryptopulse", SERVER_REQS, 12, "google-auth")) },
  { id: "a11y", label: "Accessibility", find: [any("accessibility", "a11y", "WCAG", "screen reader", "screen readers", "ARIA")],
    proof: proven(file("site", "site/feature/receipts/receipts.css", 71, "prefers-reduced-motion")) },
  { id: "web-security", label: "Web security (CSP, headers)", find: [any("web security", "application security", "AppSec", "OWASP", "Content Security Policy", "CSP", "security headers", "secure coding")],
    proof: proven(file("site", "customHttp.yml", 22, "Content-Security-Policy")) },
  { id: "i18n", label: "Internationalization", find: [any("i18n", "internationalization", "internationalisation", "localization", "localisation", "multilingual", "multi-lingual")],
    proof: proven(file("votersaathi", "README.md", 122, "Multilingual Support (12 Languages)")) },
  { id: "chatbots", label: "Chatbots", find: [any("chatbot", "chatbots", "chat bot", "conversational AI", "Telegram")],
    proof: proven(file("supermarket", "src/telegram/bot.ts", 1, "from 'grammy'")) },

  // Data
  { id: "postgres", label: "PostgreSQL", find: [any("PostgreSQL", "Postgres")],
    proof: proven(file("supermarket", "prisma/schema.prisma", 2, "PostgreSQL"), file("supermarket", "docker-compose.yml", 5, "postgres:16-alpine")) },
  { id: "mongodb", label: "MongoDB and NoSQL", find: [any("MongoDB", "Mongo", "NoSQL")],
    proof: proven(file("cryptopulse", SERVER_REQS, 3, "motor")) },
  { id: "orm", label: "ORMs (Prisma)", find: [any("ORM", "ORMs", "Prisma")],
    proof: proven(file("supermarket", "prisma/schema.prisma", 9, "datasource db")) },
  { id: "mysql", label: "MySQL", find: [any("MySQL", "MariaDB")], proof: none() },
  { id: "redis", label: "Redis", find: [any("Redis", "Memcached")], proof: none() },
  { id: "kafka", label: "Kafka", find: [any("Kafka")], proof: none() },
  { id: "spark", label: "Spark", find: [any("Apache Spark", "Spark", "PySpark", "Hadoop", "Databricks")], proof: none() },
  { id: "airflow", label: "Airflow", find: [any("Airflow")], proof: none() },
  { id: "snowflake", label: "Snowflake", find: [any("Snowflake")], proof: none(STUDIED) },
  { id: "bigquery", label: "BigQuery", find: [any("BigQuery")], proof: none(STUDIED) },
  { id: "search", label: "Elasticsearch or OpenSearch", find: [any("Elasticsearch", "OpenSearch")], proof: none() },
  { id: "data-analysis", label: "Data analysis", find: [any("data analysis", "data analytics", "exploratory data analysis", "EDA", "data cleaning", "data preprocessing")],
    proof: proven(file("cryptopulse", "data_preprocessing.ipynb", 2, "\"cells\""), file("cryptopulse", SERVER_REQS, 6, "pandas")) },

  // Quality
  { id: "testing", label: "Automated testing", find: [any("unit tests", "unit testing", "unit test", "automated tests", "automated testing", "test-driven", "TDD", "testing", "tests")],
    proof: proven(file("celebrai", "tests/budget.test.js", 1, "describe"), file("supermarket", "tests/domain.test.ts", 31, "describe"), file("ghostprobe", "code/tests/test_s3_probe.py", 116, "def test_")) },
  { id: "pytest", label: "pytest", find: [any("pytest")], proof: proven(file("ghostprobe", "code/requirements.txt", 2, "pytest")) },
  { id: "vitest", label: "Vitest", find: [any("Vitest")], proof: proven(file("supermarket", "package.json", 10, "vitest run")) },
  { id: "jest", label: "Jest", find: [any("Jest")], proof: none() },
  { id: "e2e", label: "End-to-end testing", find: [any("Playwright", "Cypress", "Selenium", "end-to-end testing", "end-to-end tests", "E2E")], proof: none() },

  // Practice
  { id: "writing", label: "Technical writing", find: [any("technical writing", "documentation", "written communication", "write-ups", "technical blog", "blogging")],
    proof: proven(link("DocuMind AI write-up on AWS Builder Center", ARTICLE)) },
  { id: "leadership", label: "Leadership and mentoring", find: [any("leadership", "mentoring", "mentorship", "student leader", "community leadership")],
    proof: partial("Two of my three community roles are self-reported; my AWS Builder Center author page is public.", { claim: "roles" }) },
  { id: "experience", label: "Industry experience", find: [any("internship", "internships", "work experience", "professional experience", "industry experience")],
    proof: partial("Three internships; only one left public work behind.", { claim: "internships" }) },
  { id: "hackathons", label: "Hackathons and build challenges", find: [any("hackathon", "hackathons", "build challenges", "game jams")],
    proof: proven(link("DocuMind AI: an AWS Builder Center challenge entry", ARTICLE)) }
] as const satisfies readonly Skill[];

export type SkillId = (typeof SKILLS)[number]["id"];
