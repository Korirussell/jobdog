# MASTER PROJECT BLUEPRINT: JOBDOG
**Role:** You are an elite Staff-Level Full Stack Engineer assisting with the development of "JobDog."
**Context:** JobDog is a highly opinionated, gamified tech job board targeting CS undergrads. It subverts the traditional, sterile job search by wrapping the experience in a pixelated, retro-OS graphical user interface (GUI) and utilizing rigorous AI to "roast" and grade resumes.

## CURRENT TECH STACK
* **Frontend:** Next.js (App Router), deployed on Vercel. 
* **Backend API:** Java Spring Boot 3.x, deployed on DigitalOcean.
* **Database & Cache:** PostgreSQL and Redis, deployed on DigitalOcean.
* **Data Extraction:** Independent Go worker using an Adapter Pattern.
* **AI:** OpenAI API (Strict JSON Schema structured outputs).

## CRITICAL ARCHITECTURAL RULES (DO NOT VIOLATE)
1. **API Boundary:** Next.js MUST NEVER connect directly to PostgreSQL. All frontend database operations must be routed via HTTP REST/GraphQL calls to the Spring Boot backend to prevent Vercel serverless connection exhaustion.
2. **Database Pooling:** The Spring Boot backend must have HikariCP explicitly tuned for high-frequency writes and reads.
3. **Go Worker Safety:** The Go extraction pipeline must never scrape HTML if an ATS JSON API exists. It must use Redis to manage a distributed task queue, implement cryptographic jitter (randomized sleep), and spoof modern browser headers to avoid WAF IP bans.
4. **Execution Protocol:** Do not attempt to build all phases at once. We will execute this blueprint phase by phase. Ask for confirmation before beginning a new phase.

---

## PHASE 1: CORE INFRASTRUCTURE & AUTHENTICATION
* **Auth System:** Implement robust Email/Password authentication using JWTs in Spring Boot, and set up the scaffolding for GitHub/Google OAuth2 integrations.
* **Social Privacy:** Create user profiles with a database schema that defaults all resume scores and ranks to "Private" unless explicitly shared with a recognized friend connection.

## PHASE 2: THE GO DATA ENGINE (ATS ADAPTERS)
Refactor the Go worker to use an Adapter Pattern for direct ATS querying:
* **Greenhouse Adapter:** Query `https://api.greenhouse.io/v1/boards/{client}/jobs?content=true`. Extract `updated_at` and strip HTML from the `content` field.
* **Lever Adapter:** Query `https://api.lever.co/v0/postings/`. Extract `descriptionPlain`, `locations_derived`, and `salary_raw`.
* **Workday Adapter:** Programmatically spoof the CXS frontend API. Execute initial GET requests to capture `wday-vbt`, `PLAY_SESSION`, and CSRF tokens via `net/http/cookiejar`. Execute POST requests to `/wday/cxs/client/...` bypassing pagination using the `offset` parameter.
* **Database Pruning:** Implement a cron job that pings existing job URLs; if a 404 is returned, mark the job as `inactive` in Postgres.

## PHASE 3: BACKEND AI & GAMIFICATION LOGIC (SPRING BOOT)
* **Top Dog Resume Roaster:** Create an endpoint that accepts a PDF resume and a target Job ID. Use OpenAI structured outputs (JSON schema) to compare the resume against the scraped job description. The AI must adopt the persona of a cynical Senior SWE conducting a brutal code review.
    * *Output Format:* `brutal_roast_text` (String), `missing_dependencies` (Array), and `Top_Dog_Rank` (Integer 0-100 mapped to dog-themed tiers).
* **Kernel Panic Ghost Radar:** Implement logic to track the lifespan of a job. Calculate a company's "Ghost Score" based on how long jobs sit open versus user reports of being ghosted.
* **Real-time Pipeline:** When the Go worker finds a new job, push the JSON payload into a Redis Pub/Sub channel. Spring Boot will broadcast this to the Next.js frontend via WebSockets.

## PHASE 4: FRONTEND OS-THEMED UI/UX (NEXT.JS)
Design a pixelated, retro-OS interface incorporating the following components:
1. **The Vault/Profile:** A private OS-style window where users store their 1 allowed resume and view their "Top Dog" rank and roast history. Include a custom pixel animation on the profile of a dog dropping a file folder.
2. **Zero-Day Conveyor Belt:** A continuous, pixelated industrial conveyor belt fixed to the bottom of the screen. New jobs pushed via WebSockets visually drop onto the belt. Users must drag and drop the job folder into their "Saved" directory before it falls off the screen into an incinerator.
3. **The Task Manager:** An application tracking interface styled like a system task manager. Applied jobs become "processes" (e.g., status: RUNNING). If a job is closed by the employer, the status becomes ORPHANED, prompting the user to execute a gamified `kill -9` command to clear it.
4. **Terminal Salary Decryptor:** A pixelated command-line interface component. Users type commands like `decrypt_comp --company "Stripe"` to view estimated salary bands parsed from the Lever `salary_raw` data.
5. **Skill Tree Mapping:** A UI component that visualizes parsed job requirements as an RPG-style dependency tree (e.g., Docker -> Kubernetes). Nodes light up if the user's parsed resume contains the skill.

**AI ASSISTANT INSTRUCTIONS:** Read this document and acknowledge that you understand the architecture, the OS theme, and the strict rules. Do not write any code yet. Ask me which Phase or specific feature we should start building first.