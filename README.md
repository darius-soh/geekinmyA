# Sure Bo?

An opinionated news credibility checker built for fast demos and clear signal design.

Sure Bo? combines:
- a curated local news dataset for stable testing
- multilingual UI and article rendering
- source-registry checks from a vetted JSON dataset
- Pinecone-backed source similarity
- OpenAI reasoning as a deeper fallback layer

The result is an MVP that opens quickly, shows article credibility context immediately, and stays predictable during demos.

## Overview

This app is a React + Vite project with a lightweight server-side credibility layer. Instead of depending on a live news API, articles are defined locally so the team can curate reliable, mixed, and low-credibility examples on purpose.

The app currently includes:
- `Home` for the main news feed
- `For You` for interest-based article filtering
- `Guide` for fake-news education
- `Check a Claim` for article and claim analysis
- `Settings` for language and interest preferences

## Core Experience

### Curated article feed
Articles are stored locally and rendered instantly from the app bundle. This keeps the UI stable and makes credibility testing repeatable.

### Multilingual UI
The interface supports multiple languages through a shared i18n layer. UI labels, guide content, and localized article text update when the user changes language.

### Credibility pipeline
Article credibility is staged rather than guessed from one signal:

1. Local source-registry assessment from `credibleSources.json`
2. Pinecone source-similarity lookup for unresolved cases
3. OpenAI reasoning only when more analysis is still needed

This keeps known sources fast and avoids doing slow remote work when the source is already clearly classified.

### Explainable signals
The article detail view separates:
- overall credibility
- confidence
- evidence/source signals
- source-registry similarity
- recommendations and summary

The UI is designed to present trust signals, not absolute truth claims.

## Tech Stack

- Frontend
  - React 19
  - React Router DOM 7
  - Plain CSS
  - Lucide React for icons
  - Radix Slot for shared component composition
- Build and tooling
  - Vite 7
  - ESLint 9
- AI and credibility infrastructure
  - OpenAI API for article reasoning and fallback credibility analysis
  - Pinecone for vetted-source similarity search
  - Pinecone integrated embeddings with `multilingual-e5-large`
- Data layer
  - Local hardcoded article dataset in `src/data/articles.js`
  - Local vetted-source registry in `data/credibleSources.json`
- Application architecture
  - Client-side React app with a lightweight server-side credibility pipeline in `server/`
  - Shared scoring and source-registry logic in `shared/`

## Project Structure

```text
src/
  api/                 local article access, related-article logic, client assessment calls
  components/          reusable UI blocks
  components/ui/       shared button components
  context/             auth and language state
  data/                hardcoded article content and translation data
  i18n/                locale dictionaries
  pages/               route-level screens
  utils/               localization helpers

server/
  credibilityPipeline.js
  credibleSources.js
  pineconeCredibility.js

shared/
  credibilityModel.js
  sourceRegistryAssessment.js

data/
  credibleSources.json

scripts/
  seedCredibleSources.js
```

## Local Content

### Articles
Edit the main article dataset here:

`src/data/articles.js`

Each article can include fields such as:
- `id`
- `category`
- `image`
- `source`
- `sourceUrl`
- `title`
- `shortDescription`
- `summary`
- `publishedAt`
- `link`

### Credible source registry
The source registry lives here:

`data/credibleSources.json`

It includes high-credibility sources, satire sources, and social/user-generated platforms so the app can distinguish between:
- established publishers
- official institutions
- satire
- social platforms
- unknown sources

## Environment Variables

Create a `.env` file using `.env.example` as the template.

```env
OPENAI_API_KEY=your_openai_api_key_here
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_HOST=https://your-index-host-here
PINECONE_INDEX_NAME=hackomania
PINECONE_CREDIBLE_SOURCES_NAMESPACE=credible-sources
PINECONE_INTEGRATED_EMBEDDING_MODEL=multilingual-e5-large
PINECONE_TEXT_FIELD=text
```

Notes:
- `OPENAI_API_KEY` is used for the deeper reasoning layer.
- Pinecone is used for the integrated-embedding source-similarity flow.
- `.env.example` should stay sanitized. Real keys belong only in `.env`.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the app locally:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Seeding Pinecone

The vetted source registry can be seeded into Pinecone from `data/credibleSources.json`.

Dry run:

```bash
npm run seed:credible-sources:dry
```

Actual seed:

```bash
npm run seed:credible-sources
```

Use `-- --force` if you intentionally want to overwrite existing seeded records.

## How Credibility Works

### Fast path
For hardcoded articles, the app first checks the article source against the local registry. If the source is already known:
- reliable mainstream/official source -> immediate stronger result
- satire or social platform -> immediate weaker result

This avoids making users wait for unnecessary analysis.

### Similarity path
If the source is not resolved locally, the app queries Pinecone to compare the article against vetted source profiles.

### Reasoning path
Only unresolved cases fall through to OpenAI for a more detailed explanation.

This design keeps the article page responsive while still supporting richer analysis when needed.

## Useful Files

- Main article data: `src/data/articles.js`
- Article translations: `src/data/articleTranslations.js`
- Source registry: `data/credibleSources.json`
- Credibility pipeline: `server/credibilityPipeline.js`
- Pinecone similarity logic: `server/pineconeCredibility.js`
- Registry matching logic: `shared/sourceRegistryAssessment.js`
- Shared scoring model: `shared/credibilityModel.js`

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run seed:credible-sources
npm run seed:credible-sources:dry
```

## Current Product Direction

This codebase is intentionally optimized for an MVP:
- local article content instead of unstable live feeds
- explainable credibility signals instead of black-box labels
- quick article opening with staged analysis
- easy manual editing for demos and testing

## Notes for Teammates

- Keep article content in `src/data/articles.js` aligned with the categories used in the UI.
- Add translated article text in `src/data/articleTranslations.js` when needed.
- Update `data/credibleSources.json` when adding new source types or domain classifications.
- Reseed Pinecone after meaningful source-registry changes.

## License

Internal project / hackathon MVP unless your team adds a separate license file.
=======
# geekinmyA
>>>>>>> b48807946586be1d53da5ba4058f67d768958c6f
