# ALECONS Production Deployment Guide

## Domain Structure
- **Main Website**: alecons.com.ng
- **Student Portal**: portal.alecons.com.ng (includes CBT at /cbt route)
- **Application Portal**: apply.alecons.com.ng
- **Staff Portal**: staff.alecons.com.ng
- **API Backend**: api.alecons.com.ng

## Prerequisites
1. Digital Ocean account with payment method
2. Domain alecons.com.ng registered and nameservers pointed to Digital Ocean
3. MongoDB Atlas account or DigitalOcean Managed Database
4. Paystack live API keys
5. Production email credentials

## Quick Secret Generation Reference

Before starting deployment, generate these secrets (detailed instructions in Step 3.2):

```bash
# JWT Secret (64 characters)
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# Session Secret (32 characters)  
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Redis Password (if using local Redis)
node -e "console.log('REDIS_PASSWORD=' + require('crypto').randomBytes(32).toString('base64'))"
```

---

## STEP 1: Domain Configuration

### 1.1 Configure Domain in Digital Ocean
```bash
# Go to Digital Ocean Networking -> Domains
# Add domain: alecons.com.ng
# Point nameservers from your domain registrar to:
ns1.digitalocean.com
ns2.digitalocean.com
ns3.digitalocean.com
```

### 1.2 Create DNS Records
```bash
# A Records (point to your droplet IP)
@ (root)           -> Your_Droplet_IP
www                -> Your_Droplet_IP
portal             -> Your_Droplet_IP
apply              -> Your_Droplet_IP
staff              -> Your_Droplet_IP
api                -> Your_Droplet_IP

# CNAME Records (optional, for redundancy)
*.alecons.com.ng   -> alecons.com.ng
```

---

## STEP 2: Digital Ocean Infrastructure Setup

### 2.1 Create Production Droplet
```bash
# Recommended specs:
# - Ubuntu 22.04 LTS
# - 4GB RAM / 2 vCPUs (Basic plan $24/month)
# - 80GB SSD
# - Enable monitoring and backups
# - Add SSH keys for secure access

# Create droplet in your preferred region (London for LON1)
```

### 2.2 Initial Server Setup
```bash
# SSH into your droplet
ssh root@your_droplet_ip

# Update system
apt update && apt upgrade -y

# Create sudo user
adduser alecons
usermod -aG sudo alecons

# Configure firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable

# Install basic packages (without pm2)
apt install -y nginx certbot python3-certbot-nginx git curl

# Install Node.js 18 (LTS) - this will also install npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Now install pm2 globally via npm
npm install -g pm2

# Verify installations
node --version
npm --version
pm2 --version
nginx -v
```

### 2.3 Setup MongoDB (Choose One Option)

#### Option A: MongoDB Atlas (Recommended)
```bash
# 1. Go to https://cloud.mongodb.com
# 2. Create new cluster in closest region to your droplet
# 3. Configure network access to allow your droplet IP
# 4. Create database user with read/write permissions
# 5. Get connection string for .env.production
```

#### Option B: DigitalOcean Managed Database
```bash
# 1. Go to Digital Ocean Databases
# 2. Create MongoDB cluster
# 3. Configure trusted sources (your droplet)
# 4. Get connection string
```

---

## STEP 3: Deploy API Backend

### 3.1 Clone and Setup API
```bash
# Switch to alecons user
su - alecons

# Clone repository
git clone https://github.com/oy3/alecons.git
cd alecons/packages/api

# Install dependencies
npm install

# Update .env.production with real values
nano .env.production

# Key values to update:
# DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/alecons
# JWT_SECRET=generate-strong-256-bit-secret
# PAYSTACK_SECRET_KEY=sk_live_your_live_key
# PAYSTACK_PUBLIC_KEY=pk_live_your_live_key
# SPACES_KEY=your_production_spaces_key
# SPACES_SECRET=your_production_spaces_secret
# SMTP_USER=noreply@alecons.com.ng
# SMTP_PASS=your_production_email_password
```

### 3.2 Generate Production Secrets

Before starting the API, you need to generate secure secrets for production:

#### Generate JWT Secret (256-bit minimum)
```bash
# Method 1: Using Node.js crypto (Recommended)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Method 2: Using OpenSSL
openssl rand -hex 64

# Method 3: Using online generator (if no tools available)
# Visit: https://generate-secret.vercel.app/64
# Copy the generated 64-character hex string
```

#### Generate Session Secret
```bash
# Generate a strong session secret (32-byte minimum)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Alternative using OpenSSL
openssl rand -hex 32
```

#### Setup Redis for Production

##### Option A: DigitalOcean Managed Redis (Recommended)
```bash
# 1. Go to DigitalOcean Databases
# 2. Click "Create Database"
# 3. Choose Redis as database engine
# 4. Select same region as your droplet (London - LON1)
# 5. Choose plan: Basic ($15/month for 1GB RAM)
# 6. Set database name: alecons-redis
# 7. Add your droplet to trusted sources
# 8. Get connection details:
#    - Host: your-redis-cluster.db.ondigitalocean.com
#    - Port: 25061 (default)
#    - Password: auto-generated password
```

##### Option B: Redis on Same Droplet (Budget Option)
```bash
# Install Redis on your droplet
sudo apt update
sudo apt install redis-server

# Configure Redis for production
sudo nano /etc/redis/redis.conf

# Update these settings:
# bind 127.0.0.1
# requirepass your_strong_redis_password
# maxmemory 512mb
# maxmemory-policy allkeys-lru

# Generate Redis password
redis_password=$(openssl rand -base64 32)
echo "Generated Redis password: $redis_password"

# Update Redis config with password
sudo sed -i "s/# requirepass foobared/requirepass $redis_password/" /etc/redis/redis.conf

# Restart Redis
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# Test Redis connection
redis-cli -a $redis_password ping
```

#### Update .env.production with Generated Secrets
```bash
# Edit the production environment file
nano /home/alecons/alecons/packages/api/.env.production

# Replace these values with your generated secrets:

# JWT Secret (use output from crypto generation above)
JWT_SECRET=your_generated_64_character_hex_string

# Session Secret (use output from session secret generation above)
SESSION_SECRET=your_generated_32_character_hex_string

# Redis Configuration
# For DigitalOcean Managed Redis:
REDIS_HOST=your-redis-cluster.db.ondigitalocean.com
REDIS_PORT=25061
REDIS_PASSWORD=your_managed_redis_password

# For Redis on same droplet:
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_generated_redis_password
```

#### Verify Generated Secrets
```bash
# Check that all secrets are properly set
grep -E "JWT_SECRET|SESSION_SECRET|REDIS_" /home/alecons/alecons/packages/api/.env.production

# Ensure no placeholder values remain
if grep -q "your-" /home/alecons/alecons/packages/api/.env.production; then
    echo "Warning: Placeholder values still exist in .env.production"
    grep "your-" /home/alecons/alecons/packages/api/.env.production
else
    echo "All secrets properly configured"
fi
```

### 3.3 Build and Start API
```bash
# Build the application
npm run build

# Start with PM2
pm2 start dist/main.js --name "alecons-api" --env production

# Save PM2 configuration
pm2 save
pm2 startup
```

---

## STEP 4: Deploy Frontend Applications

### 4.1 Build All Applications
```bash
cd /home/alecons/alecons

# Build Student Portal (includes CBT)
cd apps/student-portal
npm install
npm run build

# Build Application Portal
cd ../application-portal
npm install
npm run build

# Build Staff Portal
cd ../staff-portal
npm install
npm run build

# Build Main Website
cd ../website
npm install
npm run build

# Build CBT Portal
cd ../cbt
npm install
npm run build
```

### 4.2 Setup Nginx Configuration
```bash
# Create main nginx config
sudo nano /etc/nginx/sites-available/alecons

# Add the following configuration:
```

---

## STEP 5: Nginx Configuration

Create `/etc/nginx/sites-available/alecons`:

```nginx
# Main Website (alecons.com.ng)
server {
    listen 80;
    server_name alecons.com.ng www.alecons.com.ng;
    root /home/alecons/alecons/apps/website/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        return 301 https://api.alecons.com.ng$request_uri;
    }
}

# Student Portal (portal.alecons.com.ng)
server {
    listen 80;
    server_name portal.alecons.com.ng;
    root /home/alecons/alecons/apps/student-portal/dist;
    index index.html;

    # CBT Portal route
    location /cbt {
        alias /home/alecons/alecons/apps/cbt/dist;
        try_files $uri $uri/ /cbt/index.html;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}

# Application Portal (apply.alecons.com.ng)
server {
    listen 80;
    server_name apply.alecons.com.ng;
    root /home/alecons/alecons/apps/application-portal/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

# Staff Portal (staff.alecons.com.ng)
server {
    listen 80;
    server_name staff.alecons.com.ng;
    root /home/alecons/alecons/apps/staff-portal/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

# API Backend (api.alecons.com.ng)
server {
    listen 80;
    server_name api.alecons.com.ng;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Enable Nginx Configuration
```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/alecons /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

---

## STEP 6: SSL Certificate Setup

```bash
# Install SSL certificates for all domains
sudo certbot --nginx -d alecons.com.ng -d www.alecons.com.ng -d portal.alecons.com.ng -d apply.alecons.com.ng -d staff.alecons.com.ng -d api.alecons.com.ng

# Setup auto-renewal
sudo crontab -e

# Add this line:
0 12 * * * /usr/bin/certbot renew --quiet
```

---

## STEP 7: Final Configuration

### 7.1 Update API Environment
```bash
# Edit production environment
nano /home/alecons/alecons/packages/api/.env.production

# Update with real production values:
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/alecons_prod
JWT_SECRET=your-very-strong-production-jwt-secret-at-least-256-bits
PAYSTACK_SECRET_KEY=sk_live_your_actual_live_secret_key
PAYSTACK_PUBLIC_KEY=pk_live_your_actual_live_public_key
SMTP_USER=noreply@alecons.com.ng
SMTP_PASS=your_actual_email_password
```

### 7.2 Restart Services
```bash
# Restart API
pm2 restart alecons-api

# Restart nginx
sudo systemctl restart nginx

# Check PM2 status
pm2 status
pm2 logs alecons-api
```

---

## STEP 8: Monitoring and Maintenance

### 8.1 Setup Monitoring
```bash
# Install monitoring tools
npm install -g pm2-logrotate
pm2 install pm2-logrotate

# Setup log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

### 8.2 Backup Strategy
```bash
# Setup automated backups
# 1. Database: Use MongoDB Atlas automated backups or DigitalOcean backups
# 2. Files: Setup DigitalOcean Spaces backup
# 3. Code: Ensure git repository is up to date
```

---

## STEP 9: Testing

### 9.1 Test Each Domain
- https://alecons.com.ng - Main website
- https://portal.alecons.com.ng - Student portal
- https://portal.alecons.com.ng/cbt - CBT portal
- https://apply.alecons.com.ng - Application portal
- https://staff.alecons.com.ng - Staff portal
- https://api.alecons.com.ng/health - API health check

### 9.2 Test API Endpoints
```bash
# Test API connectivity
curl https://api.alecons.com.ng/api/v1/health

# Test authentication
curl -X POST https://api.alecons.com.ng/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass"}'
```

---

## STEP 10: Post-Deployment Checklist

- [ ] All domains resolve correctly
- [ ] SSL certificates installed and working
- [ ] API responds to health checks
- [ ] Database connections working
- [ ] Email sending functional
- [ ] File uploads to DigitalOcean Spaces working
- [ ] Payment integration with Paystack working
- [ ] Cross-portal navigation working
- [ ] CBT portal accessible from student portal
- [ ] PM2 processes running and stable
- [ ] Nginx serving all sites correctly
- [ ] Monitoring and logging configured

---

## Troubleshooting

### Common Issues
1. **Domain not resolving**: Check DNS propagation (can take up to 48 hours)
2. **SSL certificate fails**: Ensure domains point to droplet before running certbot
3. **API not responding**: Check PM2 logs with `pm2 logs alecons-api`
4. **Database connection fails**: Verify connection string and network access
5. **File uploads fail**: Check DigitalOcean Spaces credentials and CORS settings

### Useful Commands
```bash
# Check PM2 status
pm2 status
pm2 logs alecons-api

# Check nginx status
sudo systemctl status nginx
sudo nginx -t

# Check SSL certificates
sudo certbot certificates

# Monitor system resources
htop
df -h
```

---

## Security Best Practices

### Environment Variables Security
```bash
# Ensure .env files have proper permissions (readable only by owner)
chmod 600 /home/alecons/alecons/packages/api/.env.production

# Verify no secrets are exposed in git
cd /home/alecons/alecons
git status
# Ensure .env files are in .gitignore and not tracked
```

### Secret Rotation Schedule
```bash
# Rotate secrets every 3-6 months for maximum security:
# 1. JWT_SECRET - Forces all users to re-login
# 2. SESSION_SECRET - Invalidates all sessions
# 3. REDIS_PASSWORD - Requires Redis restart
# 4. Database passwords - Coordinate with MongoDB Atlas

# To rotate JWT secret safely:
# 1. Generate new JWT_SECRET
# 2. Update .env.production
# 3. Restart API with: pm2 restart alecons-api
# 4. Notify users they need to re-login
```

### Additional Security Measures
```bash
# Enable fail2ban for SSH protection
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Setup automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades

# Configure firewall rules
sudo ufw status
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw deny 8000/tcp   # Block direct API access
```

### Secret Storage Alternatives
For enhanced security, consider using:
- **DigitalOcean App Platform** with environment variables
- **HashiCorp Vault** for secret management
- **Docker Secrets** if containerizing
- **Kubernetes Secrets** for K8s deployments

This deployment guide provides a complete production setup for your ALECONS platform on DigitalOcean with proper domain structure and SSL security.