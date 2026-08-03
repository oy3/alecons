#!/bin/bash

# ALECONS Project Setup Script
echo "🚀 Setting up ALECONS Project..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. Current version: $(node --version)"
    exit 1
fi

print_status "Node.js version: $(node --version)"

# Check if MongoDB is running (optional)
if command -v mongod &> /dev/null; then
    if pgrep -x "mongod" > /dev/null; then
        print_status "MongoDB is running"
    else
        print_warning "MongoDB is installed but not running. Start it with: brew services start mongodb-community"
    fi
else
    print_warning "MongoDB not found. Install it for full functionality: brew install mongodb-community"
fi

# Setup environment file
if [ ! -f ".env" ]; then
    print_info "Creating .env file from template..."
    cp .env.example .env
    print_status ".env file created. Please update it with your configuration."
else
    print_info ".env file already exists"
fi

# Install dependencies
print_info "Installing all dependencies..."
npm run install:all

if [ $? -eq 0 ]; then
    print_status "All dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Make binaries executable (fix permission issues)
print_info "Fixing binary permissions..."
chmod +x node_modules/.bin/* 2>/dev/null || true

# Setup complete
echo ""
echo -e "${GREEN}🎉 Setup complete!${NC}"
echo ""
echo -e "${BLUE}Available commands:${NC}"
echo -e "  ${YELLOW}npm run dev:all${NC}        - Start all apps and API in development mode"
echo -e "  ${YELLOW}npm run dev:frontend${NC}   - Start only frontend apps"
echo -e "  ${YELLOW}npm run dev:api${NC}        - Start only API server"
echo -e "  ${YELLOW}npm run build:all${NC}      - Build all apps for production"
echo -e "  ${YELLOW}npm run start:all${NC}      - Start all apps in production mode"
echo -e "  ${YELLOW}npm run clean:all${NC}      - Clean all node_modules and caches"
echo ""
echo -e "${BLUE}Development URLs (after running dev:all):${NC}"
echo -e "  API Server:         ${YELLOW}http://localhost:8000${NC}"
echo -e "  CBT Portal:         ${YELLOW}http://localhost:3004${NC}"  
echo -e "  Application Portal: ${YELLOW}http://localhost:3000${NC}"
echo -e "  Staff Portal:       ${YELLOW}http://localhost:3001${NC}"
echo -e "  Student Portal:     ${YELLOW}http://localhost:3002${NC}"
echo ""
echo -e "${BLUE}Portal Access Requirements:${NC}"
echo -e "  ${YELLOW}CBT Portal:${NC}         Users with role 'applicants' or 'student' or 'staff'"
echo -e "  ${YELLOW}Application Portal:${NC} Open registration for applicants"  
echo -e "  ${YELLOW}Staff Portal:${NC}       Users with role 'staff' and isActive=true"
echo -e "  ${YELLOW}Student Portal:${NC}     Users with role 'student' and isActive=true"
echo ""
echo -e "${GREEN}Ready to start development!${NC}"
echo -e "Run: ${YELLOW}npm run dev:all${NC}"