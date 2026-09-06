# Start Chama Management System - Step by Step

## ✅ Docker is Installed!

Docker version 29.2.0 is installed on your system.

---

## 🚀 Steps to Start Everything

### Step 1: Start Docker Desktop
1. **Open Docker Desktop** from your Start Menu or Desktop
2. **Wait** for Docker Desktop to fully start (you'll see the whale icon in your system tray)
3. **Verify** it's running - the whale icon should be steady, not animated

### Step 2: Start Database Services
Once Docker Desktop is running, open a terminal and run:

```bash
docker compose up -d postgres redis
```

This will start:
- PostgreSQL database on port 5432
- Redis cache on port 6379

### Step 3: Run Database Migrations
```bash
npm run db:migrate
```

This creates all the database tables and schema.

### Step 4: Start Backend Server
```bash
npm run dev
```

Backend will run at: http://localhost:3000

### Step 5: Access Frontend
The frontend is already running at: http://localhost:5173

---

## 📋 Quick Command Reference

### Check Docker Status
```bash
docker --version
docker compose ps
```

### Start Services
```bash
# Start database and cache
docker compose up -d postgres redis

# Run migrations
npm run db:migrate

# Start backend
npm run dev
```

### Stop Services
```bash
# Stop backend (Ctrl+C in terminal)

# Stop database
docker compose down
```

### View Logs
```bash
# Database logs
docker compose logs postgres

# Backend logs
# Check terminal where npm run dev is running
```

---

## 🔍 Verify Everything is Running

### 1. Check Docker Containers
```bash
docker compose ps
```

You should see:
- `chama_postgres` - running
- `chama_redis` - running

### 2. Check Backend
Open: http://localhost:3000/health
Should return: `{"status":"ok"}`

### 3. Check Frontend
Open: http://localhost:5173
Should show the login page

---

## 🎯 Complete Startup Sequence

```bash
# 1. Start Docker Desktop (manually)
# 2. Wait for Docker to be ready
# 3. Run these commands:

docker compose up -d postgres redis
npm run db:migrate
npm run dev

# 4. Open browser to http://localhost:5173
```

---

## 🐛 Troubleshooting

### Docker Desktop Not Starting
**Problem**: "Docker Desktop is unable to start"
**Solution**: 
1. Close Docker Desktop completely
2. Restart your computer
3. Open Docker Desktop again
4. Wait for it to fully start

### Port Already in Use
**Problem**: "Port 5432 is already allocated"
**Solution**:
```bash
# Stop any existing PostgreSQL
docker compose down
# Or change port in docker-compose.yml
```

### Database Connection Failed
**Problem**: "Can't reach database server"
**Solution**:
1. Check Docker containers: `docker compose ps`
2. Restart containers: `docker compose restart postgres`
3. Check logs: `docker compose logs postgres`

### Migration Errors
**Problem**: "Migration failed"
**Solution**:
```bash
# Reset database
docker compose down -v
docker compose up -d postgres redis
npm run db:migrate
```

---

## 📊 System Status Check

Run this to check everything:

```bash
# Check Docker
docker --version
docker compose ps

# Check if ports are listening
netstat -an | findstr "5432"  # PostgreSQL
netstat -an | findstr "6379"  # Redis
netstat -an | findstr "3000"  # Backend
netstat -an | findstr "5173"  # Frontend
```

---

## 🎉 Success Indicators

When everything is running correctly, you should see:

✅ Docker Desktop icon is steady (not animated)
✅ `docker compose ps` shows 2 containers running
✅ Backend terminal shows "Server running on port 3000"
✅ Frontend shows login page at http://localhost:5173
✅ No error messages in any terminal

---

## 📝 What to Do After Starting

1. **Open Frontend**: http://localhost:5173
2. **Click "Sign up"** to create an account
3. **Fill in the registration form**:
   - First Name
   - Last Name
   - Email
   - Phone
   - Password
4. **Login** with your credentials
5. **Explore the dashboard**
6. **Create a Chama** or **Discover existing Chamas**

---

## 🔄 Daily Workflow

### Starting Work
```bash
# 1. Start Docker Desktop
# 2. Start services
docker compose up -d postgres redis
npm run dev
# 3. Open http://localhost:5173
```

### Stopping Work
```bash
# 1. Stop backend (Ctrl+C)
# 2. Stop Docker services
docker compose down
# 3. Close Docker Desktop (optional)
```

---

## 📚 Additional Resources

- **Frontend Documentation**: `FRONTEND_SETUP_COMPLETE.md`
- **Quick Start Guide**: `FRONTEND_QUICK_START.md`
- **Current Status**: `CURRENT_STATUS.md`
- **Sitemap**: `client/SITEMAP.md`

---

## 🎊 You're Almost There!

Just follow these steps:
1. ✅ Docker is installed
2. ⏳ Start Docker Desktop
3. ⏳ Run the commands above
4. 🎉 Enjoy your Chama Management System!

**The system is ready to go - just start Docker Desktop and run the commands!** 🚀
