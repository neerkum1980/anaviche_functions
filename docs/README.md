# Architecture

Diagrams of how anaviche-functions runs, where it is hosted and how it is deployed. [architecture.html](architecture.html) has the same diagrams with tables and notes; open it in a browser.

## 1. Runtime architecture

The browser has no function key, so it goes through the anonymous `gateway`, which forwards each call with the key attached. The MCP server holds a key and calls the APIs directly. Every API reads and writes Azure Storage directly.

![Runtime architecture](diagrams/1-runtime-architecture.svg)

## 2. Deployment topology

Test (`anaviche-functions-test-y1`) and production (`anaviche-functions`) are separate Function Apps in separate resource groups, each with its own storage. GitHub logs in through the Entra ID app `anaviche-functions-github-deploy`, which can deploy to these two apps only.

![Deployment topology](diagrams/2-deployment-topology.svg)

## 3. Deployment pipeline

What one run of the deploy job does, call by call. All building happens on the GitHub runner. Azure mounts the uploaded zip through `WEBSITE_RUN_FROM_PACKAGE` and never runs `pip install`, so dependencies must be inside the zip. The smoke test then makes one read-only request to each of the five functions and checks each returns its expected status.

![Deployment pipeline](diagrams/3-deployment-pipeline.svg)

## 4. CI/CD and promotion

Every push to `main` deploys to test automatically. Production deploys only when you run the workflow manually from `main` (Actions → Deploy Functions → Run workflow).

![CI/CD and promotion](diagrams/4-cicd-promotion.svg)

## Updating the diagrams

`architecture.html` is the source. The SVGs in `diagrams/` are copies of its inline `<svg>` blocks with the page's styles embedded. When you change a diagram, update both.
