# AI-Interview-Coach

AI-powered interview practice app with a React frontend, C# API, and Azure Cosmos DB (SQL API) persistence.

## Features implemented

- Generate role-specific interview questions via LLM API
- Choose how many questions to generate
- Add manual/custom questions
- Answer each question in an open text box
- Get per-answer LLM feedback
- Save questions/answers for future reference
- Generate overall coaching feedback after **X** answered questions
- View saved sessions

## Structure

- Frontend: `src/ai-interview-coach-web` (React + Vite)
- API: `src/AIInterviewCoach.Api` (ASP.NET Core)
- Tests: `src/AIInterviewCoach.Api.Tests` (xUnit)

## Configure backend

Set these in `appsettings.json` or environment variables:

- `Llm:Endpoint` (OpenAI-compatible chat completions endpoint)
- `Llm:ApiKey`
- `Llm:Model`
- `Cosmos:Endpoint`
- `Cosmos:Key`
- `Cosmos:DatabaseName`
- `Cosmos:ContainerName`
- `Frontend:Url` (default `http://localhost:5173`)

If Cosmos settings are not provided, the API uses in-memory storage for local development.

## Run locally

### API

```bash
cd <repository-root>
dotnet run --project src/AIInterviewCoach.Api
```

### Frontend

```bash
cd src/ai-interview-coach-web
npm run dev
```

Optional: set `VITE_API_BASE_URL` if API is not hosted at `http://localhost:5000`.

## Test

```bash
cd <repository-root>
dotnet test AIInterviewCoach.slnx
```
