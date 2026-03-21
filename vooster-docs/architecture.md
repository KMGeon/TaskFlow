# Technical Requirements Document (TRD)
  
## Tech Stack

Next.js 15,Hono.js,TypeScript,TailwindCSS,shadcn/ui,lucide-react,@tanstack/react-query,Claude Agent SDK,Turborepo,Commander.js,Node.js

## Directory Structure


/
├── src/
│   ├── app/                        # Next.js app router
│   │   ├── (protected)/            # protected routes group
│   │   │   └── dashboard/          # dashboard pages
│   │   ├── api/                    # API routes (Hono integration)
│   │   ├── login/                  # auth pages
│   │   ├── signup/                 # auth pages
│   │   └── example/                # example pages
│   ├── backend/                    # server-side logic
│   │   ├── config/                 # backend configuration
│   │   ├── hono/                   # Hono app setup
│   │   ├── http/                   # HTTP utilities
│   │   ├── middleware/             # server middleware
│   │   └── supabase/               # supabase server client
│   ├── components/                 # common components
│   │   └── ui/                     # shadcn/ui components
│   ├── features/                   # feature-based modules
│   │   ├── auth/                   # authentication feature
│   │   │   ├── context/            # auth contexts
│   │   │   ├── hooks/              # auth hooks
│   │   │   ├── server/             # auth server logic
│   │   │   └── types.ts            # auth types
│   │   └── [featureName]/          
│   │       ├── backend/            # backend logic
│   │       ├── components/         # feature components
│   │       ├── pages/              # feature pages
│   │       ├── constants.ts        # feature constants
│   │       ├── types.ts            # feature types
│   │       └── utils.ts            # feature utils
│   │       ├── hooks/              # feature hooks
│   │       └── lib/                # feature utilities
│   ├── constants/                  # global constants
│   ├── hooks/                      # common hooks
│   └── lib/                        # utilities
│       ├── remote/                 # API client
│       ├── supabase/               # supabase client setup
│       └── utils.ts                # shadcn cn utility
├── public/                         # static assets
└── supabase/migrations/            # supabase migrations

  