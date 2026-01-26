# NCAA Calcutta Auction Management System

A comprehensive web application for managing NCAA tournament Calcutta auctions. Track team ownership, auction costs, tournament progress, and automatically distribute prize pools based on round-by-round performance.

## Features

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
- **Database**: SQLite with Prisma ORM
- **Styling**: Tailwind CSS
- **Runtime**: Node.js

## Getting Started

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd calcutta
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
```bash
npx prisma migrate dev
```

4. Seed the database with sample data:
```bash
npx prisma db seed
```

5. Start the development server:
```bash
npm run dev
```

6. Open your browser and navigate to:
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

### Settings Model
- `id`: Unique identifier
- `key`: Setting key
- `value`: Setting value

## API Routes

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
│   ├── api/            # API route handlers
│   ├── owners/[id]/    # Owner profile pages
│   ├── teams/          # Team management page
│   ├── finances/       # Finances page
│   ├── layout.tsx      # Root layout with navigation
│   └── page.tsx        # Dashboard/Leaderboard
├── components/
│   └── Navigation.tsx  # Navigation component
├── lib/
│   ├── calculations.ts # Core calculation functions
│   ├── prisma.ts       # Prisma client
│   └── types.ts        # TypeScript type definitions
├── prisma/
│   ├── schema.prisma   # Database schema
│   ├── seed.ts         # Seed script
│   └── migrations/     # Database migrations
└── package.json
```

## Sample Data

The seed script populates the database with:
- 10 owners with randomized names
- 64 NCAA tournament teams across 4 regions
- Randomized auction costs ($15-$80 based on seed)
- Sample tournament progress for demonstration

## Features & Functionality

### Auto-save
All edits in the Team Management and Finances pages are automatically saved to the database.

### Responsive Design
The application is fully responsive and works on desktop, tablet, and mobile devices.

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

1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

For deployment to platforms like Vercel, Railway, or Heroku, consult their respective documentation for Next.js applications.

## License

MIT

## Support

For issues or questions, please open an issue on the GitHub repository.
