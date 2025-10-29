#!/bin/bash

# ALECONS Production Deployment Script
echo "🚀 Deploying ALECONS to Production..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if we're in production mode
if [ "$NODE_ENV" != "production" ]; then
    print_info "Setting NODE_ENV to production"
    export NODE_ENV=production
fi

# Install production dependencies
print_info "Installing production dependencies..."
npm ci --only=production --workspaces

# Build all applications
print_info "Building all applications..."
npm run build:all

if [ $? -eq 0 ]; then
    print_status "Build completed successfully"
else
    print_error "Build failed"
    exit 1
fi

# Optional: Run tests before deployment
if [ "$RUN_TESTS" = "true" ]; then
    print_info "Running tests..."
    npm run test:all
    if [ $? -ne 0 ]; then
        print_error "Tests failed. Deployment aborted."
        exit 1
    fi
    print_status "All tests passed"
fi

# Create production start script
cat > start-production.sh << 'EOF'
#!/bin/bash
echo "Starting ALECONS in production mode..."
NODE_ENV=production npm run start:all
EOF

chmod +x start-production.sh

print_status "Production deployment ready!"
echo ""
echo -e "${BLUE}Production files:${NC}"
echo -e "  API build:     ${YELLOW}packages/api/dist/${NC}"
echo -e "  CBT build:     ${YELLOW}apps/cbt/dist/${NC}"
echo -e "  App build:     ${YELLOW}apps/application-portal/dist/${NC}"
echo -e "  Staff build:   ${YELLOW}apps/staff-portal/dist/${NC}"
echo -e "  Student build: ${YELLOW}apps/student-portal/dist/${NC}"
echo ""
echo -e "${GREEN}To start production:${NC} ${YELLOW}./start-production.sh${NC}"