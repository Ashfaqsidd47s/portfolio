export const profile = {
  name: "Mohammad Ashfaq",
  role: "Full-Stack Developer",
  location: "Dehradun, India",
  email: "ashfaqsidd47@gmail.com",
  phone: "+91 7456033975",
  available: true,
  availableLabel: "Open to full-stack & AI-product roles",
  resumeFile: "/Mohammad_Ashfaq_Resume.pdf",
  resumeFileName: "Mohammad_Ashfaq_Resume.pdf",

  summary:
    "Full-stack developer building AI-native, real-time web products on Next.js/React and Go/Node backends. Recent focus: shipping an AI hiring platform with an MCP-based chatbot integration and a multi-store commerce analytics OS — owning frontend architecture, backend services, and AI-driven feature integration end-to-end.",

  about: [
    "I'm a full-stack developer based in Dehradun, India. Most of my work sits where product engineering meets AI: shipping real applications where an LLM isn't a bolt-on demo, but a first-class way for users to drive the product.",
    "Day to day I own features end-to-end — React and Next.js on the front, Node or Go on the back, PostgreSQL underneath, and increasingly an MCP server in the middle so AI agents can call the same actions a human would click.",
    "I care about the unglamorous parts: data tables that stay fast at scale, workflow builders that don't collapse under edge cases, and interfaces that feel calm rather than clever.",
  ],

  socials: {
    github: "https://github.com/Ashfaqsidd47s",
    linkedin: "https://www.linkedin.com/in/ashfaqsidd47/",
    email: "mailto:ashfaqsidd47@gmail.com",
  },
} as const

export type Experience = {
  company: string
  role: string
  period: string
  location: string
  summary: string
  highlights: string[]
  stack: string[]
  current?: boolean
  /** The public product this role shipped, when there is one. */
  url?: string
  urlLabel?: string
}

export const experience: Experience[] = [
  {
    company: "Axe Consultancy Services",
    role: "Full Stack Developer",
    period: "Jan 2026 — Present",
    location: "Dehradun, India",
    current: true,
    summary:
      "Owning production web applications end-to-end — architecture through deployment — with a focus on AI-driven product surfaces.",
    highlights: [
      "Own end-to-end development of production web applications across frontend, backend, APIs, and databases.",
      "Design and ship scalable product features, owning architecture and implementation from development through deployment.",
      "Build AI-powered features and MCP integrations that let users interact with core product functionality through AI agents.",
    ],
    stack: ["React", "TypeScript", "Go", "PostgreSQL", "MCP", "Docker"],
  },
  {
    company: "Whatbytes",
    role: "Frontend Developer",
    period: "Feb 2025 — Dec 2025",
    location: "Remote",
    url: "https://trypnow.com",
    urlLabel: "trypnow.com",
    summary:
      "Built the supplier and agent side of TrypNow, a B2B travel platform, with heavy emphasis on large-scale data tables and AI-assisted content creation.",
    highlights: [
      "Built a travel-booking platform enabling suppliers to list hotels, attractions, and packages, and agents to book them for their organizations.",
      "Built and maintained 30+ filterable data tables covering bookings, transactions, hotels, attractions, and packages.",
      "Integrated an AI-powered generator letting suppliers create attraction listings from a single text prompt.",
    ],
    stack: ["Next.js", "React", "Tailwind CSS", "ShadCN UI", "Zustand"],
  },
  {
    company: "Unfluke",
    role: "Full Stack Web Developer (Intern)",
    period: "2023",
    location: "Remote",
    summary:
      "Worked on an options trading platform, building the workflows traders use to analyse and execute strategies.",
    highlights: [
      "Contributed to an options trading platform — building core trading workflows, market-analysis features, and user-facing tools for analyzing and executing options strategies.",
    ],
    stack: ["React", "Node.js", "REST APIs"],
  },
]

export type Project = {
  name: string
  tagline: string
  /** Where the work happened, when it was not a personal project. */
  context?: string
  url?: string
  urlLabel?: string
  repo?: string
  status: string
  highlights: string[]
  stack: string[]
}

export const projects: Project[] = [
  {
    name: "11Jobs",
    tagline: "AI-driven hiring assessment platform",
    url: "https://11jobs.in",
    urlLabel: "11jobs.in",
    status: "Production",
    highlights: [
      "Built the core hiring assessment experience end-to-end, including a customizable assessment workflow builder and recruiter/candidate portals.",
      "Shipped 30+ assessment management views along with automated proctoring and cheating detection.",
      "Built an MCP server exposing platform actions for AI-driven assignment creation and management through chat.",
    ],
    stack: ["React", "TypeScript", "TanStack Query/Table", "ShadCN UI", "MCP"],
  },
  {
    name: "11Matrix",
    tagline: "Unified commerce & analytics OS",
    url: "https://11matrix.co",
    urlLabel: "11matrix.co",
    status: "In development",
    highlights: [
      "Building a unified Shopify commerce platform for multi-store analytics, marketing, operations, and support; own the React Router frontend and the Go/Gin/PostgreSQL backend.",
      "Independently developing core APIs, ticket generation, Shopify integrations, and the MCP integration layer.",
    ],
    stack: ["React", "TanStack Query/Table", "ShadCN UI", "Zustand", "Go", "Gin", "PostgreSQL", "MCP", "Docker"],
  },
  {
    name: "SureGem",
    tagline: "Multi-vendor diamond & fine-jewelry marketplace",
    url: "https://suregem.com",
    urlLabel: "suregem.com",
    status: "Production",
    highlights: [
      "Built the frontend and end-to-end application flow for a B2B marketplace connecting diamond and fine-jewelry suppliers with buyers.",
      "Covered product discovery, advanced search and filtering, vendor catalogs, product details, inquiries, and orders.",
    ],
    stack: ["React", "TypeScript", "Tailwind CSS", "REST APIs"],
  },
  {
    name: "TrypNow",
    tagline: "B2B travel booking platform for DMCs and travel agents",
    context: "Built at Whatbytes",
    url: "https://trypnow.com",
    urlLabel: "trypnow.com",
    status: "Production",
    highlights: [
      "Built the supplier and agent sides of a platform that digitises a fragmented booking ecosystem — suppliers and DMCs list hotels, attractions and packages, and travel agents book them on behalf of their organizations.",
      "Built and maintained 30+ filterable data tables covering bookings, transactions, hotels, attractions, and packages — the operational core agents work in day to day.",
      "Integrated an AI-powered generator that turns a single text prompt into a complete attraction listing, cutting the manual work of cataloguing inventory.",
    ],
    stack: ["Next.js", "React", "Tailwind CSS", "ShadCN UI", "Zustand"],
  },
]

export const sideProjects: Project[] = [
  {
    name: "Fujin",
    tagline: "Feature-first React registry — build features, not boilerplate",
    repo: "https://github.com/Ashfaqsidd47s/fujin-registry",
    status: "Open source",
    highlights: [
      "A shadcn-style registry that ships whole copy-pasteable features instead of bare components, built as a single-source-of-truth monorepo with an automated registry build engine.",
      "Paired with a companion CLI (`npx fujin add`) for scaffolding and installing features into Next.js projects.",
    ],
    stack: ["TypeScript", "Next.js", "Monorepo", "MDX", "CLI"],
  },
  {
    name: "Bingo Master",
    tagline: "Real-time multiplayer board game — Bingo meets chess",
    url: "https://bingo-master-ts.vercel.app",
    urlLabel: "bingo-master-ts.vercel.app",
    repo: "https://github.com/Ashfaqsidd47s/bingo-master-ts",
    status: "Live",
    highlights: [
      "Real-time two-player matches over raw WebSockets — room management implemented from scratch on the native `ws` library rather than Socket.IO.",
      "Randomized 5×5 boards, strategic turn-based play, and a fully responsive interface rebuilt from the ground up after a UI overhaul.",
    ],
    stack: ["TypeScript", "React", "Express", "WebSockets", "PostgreSQL"],
  },
  {
    name: "Gaming Era",
    tagline: "Social platform for gamers with real-time chat and video",
    repo: "https://github.com/Ashfaqsidd47s/gaming_era_nextjs",
    status: "Open source",
    highlights: [
      "Custom WebSocket server with hand-rolled room management for instant messaging, plus peer-to-peer video calling over WebRTC.",
      "Google OAuth 2.0 implemented from scratch without a helper library, with JWT-based authorization across services.",
    ],
    stack: ["Next.js", "TypeScript", "WebRTC", "WebSockets", "PostgreSQL", "OAuth 2.0"],
  },
  {
    name: "File Scanner",
    tagline: "Secure upload & malware scanning dashboard",
    url: "https://cyberxplore-assignment.vercel.app",
    urlLabel: "cyberxplore-assignment.vercel.app",
    repo: "https://github.com/Ashfaqsidd47s/cyberxplore-assignment",
    status: "Live",
    highlights: [
      "Three-service architecture — frontend, API, and a background scanning worker — where uploads are queued, scanned asynchronously, and streamed back to a live dashboard.",
    ],
    stack: ["TypeScript", "Node.js", "Queues", "React"],
  },
]

export type SkillGroup = {
  label: string
  items: string[]
}

export const skills: SkillGroup[] = [
  {
    label: "Languages",
    items: ["TypeScript", "JavaScript", "Go", "Python", "Java"],
  },
  {
    label: "Frontend",
    items: ["React.js", "Next.js", "React Router", "TanStack Query", "TanStack Table", "Redux", "Zustand", "Tailwind CSS", "ShadCN UI", "Vite"],
  },
  {
    label: "Backend",
    items: ["Node.js", "Express", "Go / Gin", "PostgreSQL", "MongoDB", "Drizzle", "REST APIs", "GraphQL", "WebSockets"],
  },
  {
    label: "AI / Agent",
    items: ["MCP server development", "LLM feature integration", "AI chatbot design"],
  },
  {
    label: "Tools",
    items: ["Git", "GitHub", "Docker", "AWS (EC2, S3)", "Postman"],
  },
]

export type Education = {
  degree: string
  institution: string
  period: string
  detail?: string
}

export const education: Education[] = [
  {
    degree: "M.C.A — Master of Computer Applications",
    institution: "Uttaranchal University",
    period: "2023 — 2025",
    detail: "8.4 CGPA",
  },
  {
    degree: "B.Sc. Computer Science",
    institution: "Doon University",
    period: "2020 — 2023",
  },
]

export const focusAreas = [
  {
    title: "AI-native product surfaces",
    body: "MCP servers that expose real product actions, so an agent can create, edit, and manage the same things a user can — not just answer questions about them.",
  },
  {
    title: "Data-dense interfaces",
    body: "Filterable, sortable, server-driven tables and dashboards built on TanStack Query and Table that stay responsive as the dataset grows.",
  },
  {
    title: "Real-time systems",
    body: "WebSocket servers written against the raw protocol with hand-rolled room and presence management, plus WebRTC for peer-to-peer media.",
  },
  {
    title: "End-to-end ownership",
    body: "Schema and API design in Go or Node, frontend architecture in React, containerised and deployed — one person carrying a feature the whole way.",
  },
]
