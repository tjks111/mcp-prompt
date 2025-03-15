#!/bin/bash
# Docker Configurations Test Script for MCP Prompts
# Tests all Docker Compose configurations to ensure they work correctly

set -e

# Change to the project root directory
cd "$(dirname "$0")/../.."
ROOT_DIR=$(pwd)

echo "=== MCP Prompts Docker Configurations Test ==="
echo "Testing all Docker Compose configurations..."

# Function to test a Docker Compose configuration
test_compose_config() {
  local config_name=$1
  local compose_files=$2
  local success_check_command=$3
  
  echo ""
  echo "Testing $config_name configuration..."
  echo "Command: docker compose $compose_files up -d"
  
  # Start the containers
  eval "docker compose $compose_files up -d"
  
  # Wait for containers to start
  echo "Waiting 30 seconds for containers to start..."
  sleep 30
  
  # Run the success check command
  echo "Running success check..."
  if eval "$success_check_command"; then
    echo "✅ $config_name configuration test PASSED"
    result="PASS"
  else
    echo "❌ $config_name configuration test FAILED"
    result="FAIL"
  fi
  
  # Stop and remove the containers
  echo "Cleaning up..."
  eval "docker compose $compose_files down -v"
  
  return $([ "$result" = "PASS" ] && echo 0 || echo 1)
}

# Array to track test results
declare -A test_results

# Test 1: Basic configuration (file storage)
echo "Test 1: Basic Configuration (file storage)"
test_compose_config "Basic" "-f docker-compose.yml" "docker ps | grep -q 'mcp-prompts.*' && curl -s -o /dev/null -w '%{http_code}' http://localhost:3003/health | grep -q '200'"
test_results["Basic"]=$?

# Test 2: PostgreSQL configuration
echo "Test 2: PostgreSQL Configuration"
test_compose_config "PostgreSQL" "-f docker-compose.yml -f docker/docker-compose.postgres.yml" "docker ps | grep -q 'mcp-postgres.*' && docker ps | grep -q 'mcp-prompts-postgres.*' && curl -s -o /dev/null -w '%{http_code}' http://localhost:3004/health | grep -q '200'"
test_results["PostgreSQL"]=$?

# Test 3: Development environment
echo "Test 3: Development Environment"
test_compose_config "Development" "-f docker-compose.yml -f docker/docker-compose.dev.yml" "docker ps | grep -q 'postgres-dev.*' && docker ps | grep -q 'mcp-prompts-dev.*'"
test_results["Development"]=$?

# Test 4: Testing environment
echo "Test 4: Testing Environment"
test_compose_config "Testing" "-f docker-compose.yml -f docker/docker-compose.test.yml" "docker ps | grep -q 'postgres-test.*' && docker ps | grep -q 'mcp-unit-tests.*'"
test_results["Testing"]=$?

# Test 5: Integration with multiple MCP servers
echo "Test 5: Integration Environment"
test_compose_config "Integration" "-f docker-compose.yml -f docker/docker-compose.integration.yml" "docker ps | grep -q 'mcp-prompts-file.*' && docker ps | grep -q 'mcp-memory.*' && docker ps | grep -q 'mcp-github.*'"
test_results["Integration"]=$?

# Show test results summary
echo ""
echo "=== Test Results Summary ==="
all_passed=true
for config in "${!test_results[@]}"; do
  status=$([ "${test_results[$config]}" -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")
  echo "$config Configuration: $status"
  if [ "${test_results[$config]}" -ne 0 ]; then
    all_passed=false
  fi
done

echo ""
if $all_passed; then
  echo "🎉 All Docker Compose configurations passed!"
  exit 0
else
  echo "⚠️ Some Docker Compose configurations failed!"
  exit 1
fi 