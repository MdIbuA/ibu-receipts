/*
  Sample job descriptions, so anyone can try the job receipt in one click. I wrote
  them for this page (they aren't real postings), mixing skills I can prove with
  ones I can't, the way real descriptions do.
*/

export interface SampleRole {
  readonly id: string;
  /** Button text. */
  readonly label: string;
  readonly text: string;
}

export const ROLES = [
  {
    id: "cloud-intern",
    label: "AWS cloud intern",
    text: `Cloud Engineering Intern (AWS)

What you'll do
- Build and run serverless services on AWS Lambda and API Gateway
- Define infrastructure as code with AWS SAM or CloudFormation
- Keep IAM permissions least-privilege and watch costs in CloudWatch

What you'll need
- Python or TypeScript
- Amazon S3 and DynamoDB
- Git, and a CI/CD pipeline you set up yourself
- Docker

Nice to have
- Terraform or AWS CDK
- Amazon Bedrock or another LLM API
- Kubernetes`
  },
  {
    id: "ml-engineer",
    label: "ML engineer",
    text: `Machine Learning Engineer, GenAI (Junior)

Requirements
- Strong Python, with pandas and NumPy
- Hands-on deep learning in TensorFlow or PyTorch
- At least one shipped LLM feature: prompt engineering, tool calling or agents
- RAG with a vector database
- Honest model evaluation on held-out data

Preferred
- Amazon Bedrock or SageMaker
- MLOps: experiment tracking and model monitoring
- Hugging Face`
  },
  {
    id: "backend",
    label: "Backend developer",
    text: `Backend Developer (Node.js)

You have
- TypeScript and Node.js in production
- REST APIs with Express or FastAPI
- PostgreSQL and an ORM such as Prisma
- Unit tests you trust (Vitest, Jest or pytest)
- Docker

Bonus
- Redis or Kafka
- Java or Go
- GraphQL`
  }
] as const satisfies readonly SampleRole[];

export type RoleId = (typeof ROLES)[number]["id"];
