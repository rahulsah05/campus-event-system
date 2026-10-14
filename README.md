# Campus Event and Workshop Management System

Three-tier cloud app for creating, searching, updating, and deleting campus events.

```
              +---------------------------+
              |      CLIENT BROWSER       |
              +---------------------------+
                            | HTTPS
                            v
              +---------------------------+
              |          NETLIFY          |  Tier 1: Presentation Layer
              |    React.js + Vite SPA    |  (Static Hosting & CDN)
              +---------------------------+
                            | REST API (HTTPS)
                            | CORS Enabled
                            v
              +---------------------------+
              |          RENDER           |  Tier 2: Application Layer
              |    Node.js + Express      |  (Web Service / API)
              +---------------------------+
                            | Mongoose TLS Connection
                            | MONGODB_URI
                            v
              +---------------------------+
              |       MONGODB ATLAS       |  Tier 3: Database Layer
              |  Managed Cloud Database   |  (campusEventDB -> events)
              +---------------------------+
```

## Features

- Add, edit, and delete events
- Search by id, title, venue, organizer, category, or status
- Filter by category: Workshop, Hackathon, Seminar, Competition, Cultural
- Dashboard counts for total, upcoming, ongoing, and completed events
- Live backend health indicator

Each event stores `eventId`, `title`, `description`, `category`, `date`, `venue`, `organizer`, `capacity`, and `status` (`Upcoming`, `Ongoing`, `Completed`, or `Cancelled`).

## Project structure

```
CampusEventSystem/
├── backend/                      # Tier 2: Application / API Layer
│   ├── config/
│   │   └── database.js           # Mongoose Atlas connection
│   ├── controllers/
│   │   └── eventController.js    # CRUD and statistics
│   ├── models/
│   │   └── Event.js              # Event schema
│   ├── routes/
│   │   └── eventRoutes.js        # /api/events routes
│   ├── .env.example
│   ├── package.json
│   └── server.js
│
├── frontend/                     # Tier 1: Presentation Layer
│   ├── public/
│   │   └── _redirects            # Netlify SPA fallback
│   ├── src/
│   │   ├── components/
│   │   │   ├── ArchitectureBanner.jsx
│   │   │   ├── DeleteModal.jsx
│   │   │   ├── EventModal.jsx
│   │   │   ├── EventStats.jsx
│   │   │   ├── EventTable.jsx
│   │   │   ├── Header.jsx
│   │   │   └── Toast.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── .gitignore
├── package.json
└── README.md
```

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | Service info |
| `GET` | `/health` | Health check |
| `GET` | `/api/events` | List events. Optional query: `search`, `category` |
| `GET` | `/api/events/stats/summary` | Event counts by status |
| `GET` | `/api/events/:id` | One event by event id or MongoDB id |
| `POST` | `/api/events` | Create an event |
| `PUT` | `/api/events/:id` | Update an event |
| `DELETE` | `/api/events/:id` | Delete an event |

## Run locally

1. Copy the env templates and fill in your Atlas connection string:

   ```bash
   copy backend\.env.example backend\.env
   copy frontend\.env.example frontend\.env
   ```

   `backend/.env`:

   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/campusEventDB?retryWrites=true&w=majority
   DB_NAME=campusEventDB
   FRONTEND_URL=http://localhost:5173
   ```

   `frontend/.env`:

   ```env
   VITE_API_URL=http://localhost:5000
   ```

   The UI already falls back to `http://localhost:5000` when `VITE_API_URL` is unset.

2. Install and start the API:

   ```bash
   npm run install:all
   npm run start:backend
   ```

3. In a second terminal, start the UI:

   ```bash
   npm run start:frontend
   ```

4. Open `http://localhost:5173`.

## Deploy

### 1. MongoDB Atlas

1. Create a free M0 cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Add a database user with read and write access.
3. Under Network Access, allow `0.0.0.0/0` so Render can connect.
4. Copy the driver connection string and set the database name to `campusEventDB`:

   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/campusEventDB?retryWrites=true&w=majority
   ```

### 2. Render (API)

1. New Web Service from this GitHub repository.
2. Settings:
   - Root directory: `backend`
   - Build command: `npm install`
   - Start command: `node server.js`
3. Environment variables:

   | Key | Value |
   |---|---|
   | `PORT` | `5000` |
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | Your Atlas connection string |
   | `DB_NAME` | `campusEventDB` |
   | `FRONTEND_URL` | Your Netlify URL, or `*` while testing |

4. Confirm `https://<your-service>.onrender.com/health` returns:

   ```json
   { "status": "UP", "database": "connected" }
   ```

### 3. Netlify (UI)

1. Import this repository.
2. Build settings:
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `frontend/dist`
3. Environment variable:

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | Your Render URL, for example `https://campus-event-api.onrender.com` |

4. After the site is live, set Render `FRONTEND_URL` to that Netlify origin. Requests from `*.netlify.app` and `localhost` are already allowed.

## Verification

| Case | Action | Expected result |
|---|---|---|
| Add event | Click **Add Event**. Use id `EVT101`, a title, category `Workshop`, a date, venue, organizer, capacity, and status `Upcoming`. | Success toast, and the row appears in the table. |
| List events | Load or refresh the home page. | `GET /api/events` fills the table from Atlas. |
| Search and filter | Type a title or venue, then choose a category. | The table shows only matching events. |
| Update event | Edit `EVT101` and change the status to `Ongoing`. | Atlas and the table both show the new status. Stats update. |
| Delete event | Delete `EVT101` and confirm. | The event is removed from Atlas and the table. |
| Database | Open the `events` collection in `campusEventDB`. | Documents match the changes made in the UI. |
