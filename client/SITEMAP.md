# Chama Management System - Sitemap

## Application Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    CHAMA MANAGER                             │
│                  http://localhost:5173                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
        ▼                                       ▼
┌───────────────┐                      ┌───────────────┐
│  PUBLIC AREA  │                      │ PRIVATE AREA  │
│  (No Auth)    │                      │ (Auth Required)│
└───────────────┘                      └───────────────┘
        │                                       │
        │                                       │
        ├─► /login                             ├─► /dashboard
        │   • Email & Password                 │   • Overview Stats
        │   • Sign Up Link                     │   • My Chamas Grid
        │   • Error Handling                   │   • Quick Actions
        │                                      │
        └─► /register                          ├─► /discover
            • Full Name                        │   • Search Chamas
            • Email & Phone                    │   • Filter by Type
            • Password                         │   • Join Chamas
            • National ID (optional)           │
                                              ├─► /chamas/create
                                              │   • Chama Name
                                              │   • Type Selection
                                              │   • Contribution Settings
                                              │   • Visibility Controls
                                              │
                                              ├─► /chamas/:id
                                              │   • Overview Tab
                                              │   • Members Tab
                                              │   • Contributions Tab
                                              │   • Loans Tab
                                              │   • Share & Settings
                                              │
                                              ├─► /contributions
                                              │   • Chama Selector
                                              │   • Stats Dashboard
                                              │   • Payment History
                                              │   • Make Payment
                                              │
                                              ├─► /loans
                                              │   • Eligibility Check
                                              │   • Apply for Loan
                                              │   • Active Loans
                                              │   • Loan History
                                              │
                                              └─► /settings
                                                  • Profile Tab
                                                  • Notifications Tab
                                                  • Security Tab
                                                  • Preferences Tab
```

## Navigation Flow

### User Journey 1: New User Registration
```
1. Visit /login
2. Click "Sign up"
3. Fill /register form
4. Submit → Auto redirect to /login
5. Login → Redirect to /dashboard
```

### User Journey 2: Discover & Join Chama
```
1. Login → /dashboard
2. Click "Discover Chamas" → /discover
3. Search/Filter Chamas
4. Click "Join" on a Chama
5. View Chama details → /chamas/:id
```

### User Journey 3: Create New Chama
```
1. Login → /dashboard
2. Click "Create Chama" → /chamas/create
3. Fill Chama details
4. Submit → Redirect to /chamas/:id
5. Invite members
```

### User Journey 4: Make Contribution
```
1. Login → /dashboard
2. Click "Contributions" → /contributions
3. Select Chama
4. Click "Make Payment"
5. Fill payment details
6. Submit payment
```

### User Journey 5: Apply for Loan
```
1. Login → /dashboard
2. Click "Loans" → /loans
3. Check eligibility
4. Click "Apply for Loan"
5. Fill loan application
6. Submit application
```

## Component Hierarchy

```
App
├── BrowserRouter
│   └── Routes
│       ├── Public Routes
│       │   ├── /login → Login
│       │   └── /register → Register
│       │
│       └── Private Routes (wrapped in PrivateRoute)
│           ├── /dashboard → Dashboard
│           │   └── Layout
│           │       ├── Header
│           │       ├── Sidebar
│           │       └── Main Content
│           │
│           ├── /discover → DiscoverChamas
│           │   └── Layout
│           │       ├── Search & Filters
│           │       └── Chama Cards Grid
│           │
│           ├── /chamas/create → CreateChama
│           │   └── Layout
│           │       └── Creation Form
│           │
│           ├── /chamas/:id → ChamaDetails
│           │   └── Layout
│           │       ├── Header Section
│           │       ├── Stats Cards
│           │       └── Tabbed Content
│           │
│           ├── /contributions → Contributions
│           │   └── Layout
│           │       ├── Chama Selector
│           │       ├── Stats Dashboard
│           │       ├── History List
│           │       └── Payment Modal
│           │
│           ├── /loans → Loans
│           │   └── Layout
│           │       ├── Stats Dashboard
│           │       ├── Eligibility Card
│           │       ├── Loans List
│           │       └── Apply Modal
│           │
│           └── /settings → Settings
│               └── Layout
│                   ├── Tab Navigation
│                   └── Tab Content
│                       ├── Profile Form
│                       ├── Notification Toggles
│                       ├── Security Form
│                       └── Preferences Form
```

## State Management

```
Global State (Zustand)
└── authStore
    ├── user
    ├── accessToken
    ├── refreshToken
    ├── isAuthenticated
    ├── setAuth()
    └── clearAuth()

Server State (TanStack Query)
├── Chamas
│   ├── myChamas
│   ├── discoverChamas
│   └── chamaDetails
├── Contributions
│   ├── contributions
│   └── contributionHistory
└── Loans
    ├── loans
    └── loanApplications
```

## API Integration

```
API Client (Axios)
├── Base URL: http://localhost:3000/api
├── Interceptors
│   ├── Request: Add JWT token
│   └── Response: Handle 401 & refresh token
│
└── Services
    ├── authService
    │   ├── login()
    │   ├── register()
    │   ├── logout()
    │   └── getCurrentUser()
    │
    ├── chamaService
    │   ├── getMyChamas()
    │   ├── getChamaById()
    │   ├── createChama()
    │   ├── discoverChamas()
    │   ├── joinChama()
    │   └── getMembers()
    │
    └── contributionService
        ├── getContributions()
        ├── makeContribution()
        └── initiateMpesaPayment()
```

## File Structure

```
client/src/
├── components/
│   └── Layout.tsx              # Main layout wrapper
│
├── pages/
│   ├── Login.tsx               # Authentication
│   ├── Register.tsx            # User signup
│   ├── Dashboard.tsx           # Main dashboard
│   ├── DiscoverChamas.tsx      # Browse Chamas
│   ├── CreateChama.tsx         # Create new Chama
│   ├── ChamaDetails.tsx        # Chama information
│   ├── Contributions.tsx       # Payment management
│   ├── Loans.tsx               # Loan management
│   └── Settings.tsx            # User preferences
│
├── services/
│   ├── authService.ts          # Auth API calls
│   ├── chamaService.ts         # Chama API calls
│   └── contributionService.ts  # Contribution API calls
│
├── store/
│   └── authStore.ts            # Zustand auth store
│
├── types/
│   └── index.ts                # TypeScript types
│
├── config/
│   └── api.ts                  # Axios configuration
│
├── App.tsx                     # Main app component
├── main.tsx                    # Entry point
└── index.css                   # Global styles
```

## Responsive Breakpoints

```
Mobile (< 768px)
├── Single column layout
├── Collapsible sidebar
├── Stacked cards
└── Full-width forms

Tablet (768px - 1024px)
├── Two column layout
├── Visible sidebar
├── Grid cards (2 columns)
└── Optimized forms

Desktop (> 1024px)
├── Full layout with sidebar
├── Grid cards (3-4 columns)
├── Multi-column forms
└── Expanded content areas
```

## Security Flow

```
Authentication Flow
1. User enters credentials
2. POST /api/auth/login
3. Receive JWT tokens
4. Store in localStorage + Zustand
5. Attach token to all requests
6. On 401 error → Refresh token
7. On refresh fail → Redirect to login

Protected Routes
1. Check isAuthenticated
2. If false → Redirect to /login
3. If true → Render component
```

## Data Flow

```
User Action
    ↓
Component Event Handler
    ↓
Service Function (API call)
    ↓
Axios Interceptor (Add token)
    ↓
Backend API
    ↓
Response
    ↓
Axios Interceptor (Handle errors)
    ↓
Update State (Zustand/TanStack Query)
    ↓
Re-render Component
    ↓
Update UI
```

---

**This sitemap provides a complete overview of the application structure, navigation flow, and component hierarchy.**
