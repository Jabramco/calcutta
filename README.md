# NCAA Calcutta Auction Management System

A comprehensive web application for managing NCAA tournament Calcutta auctions. Track team ownership, auction costs, tournament progress, and automatically distribute prize pools based on round-by-round performance.

## 🚀 Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Jabramco/calcutta&env=JWT_SECRET&envDescription=Required%20environment%20variables&project-name=calcutta-auction&repository-name=calcutta&stores=[{"type":"postgres"}])

**[See detailed deployment instructions →](DEPLOYMENT.md)**

## Features

### 🎭 Live Auction System
- Real-time bidding with automated auction bot
- Random team selection from unassigned teams
- Countdown timer with "Going once, twice, sold!" announcements
- Chat history with bid tracking
- Admin controls to restart auction
- Automatic database updates when teams are sold

### 🔐 Authentication & User Management
- Secure user registration and login
- Role-based access control (Admin/User)
- Admin panel for user management
- JWT-based session management
- Protected routes with middleware

### 🏆 Dashboard & Leaderboard
- Real-time owner rankings sorted by ROI or total payout
- Global statistics showing total prize pool and payout per win for each tournament round
- Interactive leaderboard with clickable owner profiles

### 📊 Team Management
- Organize all 64 teams by region (South, West, East, Midwest)
- Editable owner assignments and auction costs
- Round-by-round progress tracking with checkboxes
- Collapsible region views for easy navigation

### 👤 Owner Profile Pages
- Detailed view of each owner's portfolio
- Team-by-team breakdown showing:
  - Cost paid for each team
  - Rounds won with visual indicators
  - Individual team payouts
- Summary statistics: total teams, investment, payout, and ROI

### 💰 Finances Page
- Administrative tracking of payments
- Owner payment status (Paid/Unpaid)
- Payout distribution status
- Summary totals for accounting

## Tournament Payout Structure

The prize pool is distributed across six rounds with the following percentages:

| Round | Percentage | Winners | Payout per Win |
|-------|-----------|---------|----------------|
| Round of 64 | 16% | 32 teams | 0.5% each |
| Round of 32 | 16% | 16 teams | 1% each |
| Sweet 16 | 24% | 8 teams | 3% each |
| Elite 8 | 16% | 4 teams | 4% each |
| Final Four | 16% | 2 teams | 8% each |
| Championship | 12% | 1 team | 12% |

### Calculation Examples

**Total Prize Pool**: Sum of all team auction costs

**Payout Per Win**: 
```
Round Payout = (Total Pot × Round Percentage) / Number of Winners
```

**Team Payout**: 
```
Total Payout = Sum of all round payouts the team has won
```

**Owner ROI**: 
```
ROI% = ((Total Payout - Total Investment) / Total Investment) × 100
```

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS (Dark theme inspired by Sleeper)
- **Authentication**: JWT with bcrypt password hashing
- **Deployment**: Vercel with Vercel Postgres
- **Runtime**: Node.js

## Getting Started

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- PostgreSQL database (local or hosted)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Jabramco/calcutta.git
cd calcutta
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/calcutta"
JWT_SECRET="your-secret-key-change-in-production"
NODE_ENV="development"
```

4. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

5. Seed the database with sample data:
```bash
npm run seed
```

6. Create an admin user:
```bash
npx tsx scripts/make-admin.ts
```

7. Start the development server:
```bash
npm run dev
```

8. Open your browser and navigate to:
```
http://localhost:3000
```

## Database Schema

### Owner Model
- `id`: Unique identifier
- `name`: Owner name
- `paid`: Payment received status
- `paidOut`: Payout distributed status
- `teams`: Related teams (one-to-many)

### Team Model
- `id`: Unique identifier
- `name`: Team name
- `region`: Tournament region (South, West, East, Midwest)
- `seed`: Tournament seed (1-16)
- `ownerId`: Foreign key to Owner
- `cost`: Auction cost
- `round64`, `round32`, `sweet16`, `elite8`, `final4`, `championship`: Boolean flags for round progress

### User Model
- `id`: Unique identifier
- `username`: Unique username
- `password`: Hashed password
- `role`: User role (admin/user)
- `createdAt`: Account creation timestamp

### Settings Model
- `id`: Unique identifier
- `key`: Setting key
- `value`: Setting value

## API Routes

### Authentication
- `POST /api/auth/signup` - Create a new user account
- `POST /api/auth/login` - Log in with username and password
- `POST /api/auth/logout` - Log out and clear session
- `GET /api/auth/me` - Get current logged-in user

### Admin
- `GET /api/admin/users` - Get all users (admin only)
- `POST /api/admin/users` - Create a new user (admin only)
- `GET /api/admin/users/[id]` - Get specific user (admin only)
- `PATCH /api/admin/users/[id]` - Update user (admin only)
- `DELETE /api/admin/users/[id]` - Delete user (admin only)

### Auction
- `GET /api/auction` - Get current auction state
- `POST /api/auction` - Manage auction actions (start, bid, sold, next)
- `POST /api/auction/restart` - Reset auction (admin only)

### Stats
- `GET /api/stats` - Get global tournament statistics

### Owners
- `GET /api/owners` - Get all owners with their teams
- `POST /api/owners` - Create a new owner
- `GET /api/owners/[id]` - Get specific owner details
- `PATCH /api/owners/[id]` - Update owner information

### Teams
- `GET /api/teams` - Get all teams
- `POST /api/teams` - Create a new team
- `GET /api/teams/[id]` - Get specific team details
- `PATCH /api/teams/[id]` - Update team information

### Leaderboard
- `GET /api/leaderboard` - Get calculated owner rankings

## Project Structure

```
calcutta/
├── app/
│   ├── admin/          # Admin user management page
│   ├── api/            # API route handlers
│   │   ├── admin/      # Admin endpoints
│   │   ├── auction/    # Auction management
│   │   ├── auth/       # Authentication endpoints
│   │   ├── leaderboard/
│   │   ├── owners/
│   │   ├── stats/
│   │   └── teams/
│   ├── auction/        # Live auction page
│   ├── finances/       # Finances tracking page
│   ├── login/          # Login page
│   ├── signup/         # Registration page
│   ├── owners/[id]/    # Owner profile pages
│   ├── teams/          # Team management page
│   ├── layout.tsx      # Root layout with navigation
│   ├── page.tsx        # Dashboard/Leaderboard
│   └── globals.css     # Global styles (dark theme)
├── components/
│   └── Navigation.tsx  # Navigation component
├── lib/
│   ├── auth.ts         # JWT authentication utilities
│   ├── calculations.ts # Core calculation functions
│   ├── prisma.ts       # Prisma client
│   ├── types.ts        # TypeScript type definitions
│   └── hooks/
│       └── useAuth.ts  # Authentication React hook
├── prisma/
│   ├── schema.prisma   # Database schema
│   ├── seed.ts         # Seed script
│   └── migrations/     # Database migrations
├── scripts/
│   ├── make-admin.ts   # Script to make user admin
│   └── reset-auction.ts # Script to reset auction data
├── middleware.ts       # Next.js middleware for route protection
└── package.json
```

## Sample Data

The seed script populates the database with:
- 1 admin user (username: "justin", password: "password123")
- Sample owners
- 64 NCAA tournament teams across 4 regions
- All teams start unassigned for auction day

## Features & Functionality

### Live Auction
- Real-time bidding interface
- Automated countdown timer (5 seconds per stage)
- Chat history with localStorage persistence
- Admin-only controls for managing auction
- Automatic team assignment and database updates

### Authentication
- Secure JWT-based sessions
- Password hashing with bcrypt
- Protected routes with middleware
- Role-based access control

### Auto-save
All edits in the Team Management page are automatically saved to the database.

### Responsive Design
The application is fully responsive and works on desktop, tablet, and mobile devices.

### Dark Theme
Modern dark UI inspired by Sleeper.com with:
- Teal accent colors (#00ceb8)
- Dark backgrounds (#0d0d14, #15151e, #1c1c28)
- Smooth transitions and hover effects
- Custom scrollbar styling

### Real-time Calculations
All payouts, ROI percentages, and statistics are calculated in real-time based on current data.

### Visual Indicators
- ROI displayed in green (positive) or red (negative)
- Round progress shown with badges
- Championship wins marked with trophy emoji 🏆

## Customization

### Changing Payout Percentages
Edit the `PAYOUT_PERCENTAGES` constant in `lib/calculations.ts`:

```typescript
export const PAYOUT_PERCENTAGES = {
  round64: 0.16,    // 16%
  round32: 0.16,    // 16%
  sweet16: 0.24,    // 24%
  elite8: 0.16,     // 16%
  final4: 0.16,     // 16%
  championship: 0.12 // 12%
}
```

## Production Deployment

**See [DEPLOYMENT.md](DEPLOYMENT.md) for complete Vercel deployment instructions.**

### Quick Steps:
1. Push your code to GitHub
2. Import repository on Vercel
3. Add Vercel Postgres database
4. Set environment variables (JWT_SECRET)
5. Deploy
6. Run database migrations and seed

Your app will be live at `https://your-project.vercel.app`

## Environment Variables

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT token generation
- `NODE_ENV` - Environment (development/production)

## License

MIT

## Support

For issues or questions, please open an issue on the GitHub repository.
