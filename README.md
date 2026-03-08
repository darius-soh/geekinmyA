# Sure Boh? — Explainable News Credibility Assistant

Sure Boh? is a news credibility assistant designed to help users make better trust decisions when reading online content. Instead of relying on a black-box score, the platform surfaces transparent signals such as source reputation, evidence strength, and source-registry similarity to help users understand *why* an article appears credible, questionable, or mixed.

Built as an MVP for fast-moving information environments, Sure Boh? focuses on clarity, explainability, and a smoother user experience. Users can browse content by category, receive personalised recommendations based on their interests, and open articles for deeper credibility analysis presented in a simple, accessible format.

## Why we built this

Online information spreads quickly, but trust is often hard to judge. Many tools either provide overly simplistic labels or opaque scores without explanation. Sure Boh? was built to make credibility assessment more understandable by showing the reasoning behind each evaluation.

Our goal is not to declare absolute truth, but to help users approach articles more critically by combining trustworthy source signals, structured analysis, and user-friendly explanations.

## Key Features

- **Explainable credibility scoring**  
  Each article is assessed using visible trust signals instead of a black-box output.

- **Source registry similarity**  
  Articles are compared against a registry of high-credibility and verified sources to identify source-reputation support.

- **Article-level analysis on demand**  
  Credibility analysis is triggered when a user opens an article, improving performance and reducing unnecessary API calls.

- **Personalised “For You” feed**  
  Users can explore content aligned with their selected interests.

- **Category-based browsing**  
  Articles are organised into categories for easier discovery.

- **Readable trust summaries**  
  Users see a TL;DR summary, recommendation, confidence level, and supporting reasoning in a format that is easy to interpret.

## MVP Design Approach

For the MVP, the platform uses a **curated article set** rather than relying entirely on unpredictable real-time article fetching. This ensures a more stable and controlled user experience during demonstration and testing, while allowing the credibility workflow, recommendation flow, and explainability features to be evaluated consistently.

This approach helps us prioritise:
- consistent article quality
- reliable UI behaviour
- faster page performance
- clearer evaluation of the credibility pipeline

In a production version, this content layer can be extended to support broader live ingestion pipelines and larger-scale source coverage.

## How it works

1. Users browse articles through the homepage, categories, or personalised recommendations.
2. When an article is opened, the system generates a credibility assessment.
3. The platform presents:
   - a credibility score
   - confidence level
   - evidence signal strength
   - source-registry similarity
   - a recommendation on what the reader should do next
4. Users can then use these trust signals to read more critically and verify claims more effectively.

## Tech Stack

- **Frontend:** Next.js, TypeScript, Tailwind CSS
- **UI:** shadcn/ui
- **AI / analysis layer:** OpenAI API
- **Vector / source matching layer:** Pinecone
- **Deployment:** Vercel

## Future Improvements

- Expand from curated datasets to more dynamic article ingestion
- Improve claim-level verification against multiple primary sources
- Add multilingual support for broader accessibility
- Enhance credibility reasoning with richer evidence cards and citation trails
- Improve user profiles and recommendation quality

## Project Vision

Sure Boh? aims to make media literacy more practical by helping users understand credibility through transparent signals rather than unexplained labels. The long-term vision is to build a trust assistant that is educational, explainable, and useful in everyday news consumption.

---