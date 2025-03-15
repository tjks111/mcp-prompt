#!/bin/bash
set -e

# Display help
function show_help {
  echo "Usage: ./docker-manage.sh [COMMAND] [ENVIRONMENT]"
  echo "Manage Docker environments for MCP-Prompts"
  echo ""
  echo "Commands:"
  echo "  start       Start Docker containers"
  echo "  stop        Stop Docker containers"
  echo "  restart     Restart Docker containers"
  echo "  logs        Show logs from containers"
  echo "  clean       Remove containers, networks, and volumes"
  echo "  build       Build Docker images"
  echo "  test        Run tests in Docker containers"
  echo "  help        Display this help message"
  echo ""
  echo "Environments:"
  echo "  dev         Development environment (default)"
  echo "  test        Testing environment"
  echo "  prod        Production environment"
  echo ""
  echo "Examples:"
  echo "  ./docker-manage.sh start dev     # Start development environment"
  echo "  ./docker-manage.sh test          # Run tests in Docker"
  echo "  ./docker-manage.sh logs prod     # Show logs from production environment"
  echo ""
  exit 0
}

# Default values
COMMAND=${1:-help}
ENVIRONMENT=${2:-dev}

# Validate environment
if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "test" && "$ENVIRONMENT" != "prod" ]]; then
  echo "Error: Invalid environment: $ENVIRONMENT"
  echo "Valid environments are: dev, test, prod"
  exit 1
fi

# Set Docker Compose file based on environment
if [ "$ENVIRONMENT" = "dev" ]; then
  COMPOSE_FILE="docker-compose.dev.yml"
elif [ "$ENVIRONMENT" = "test" ]; then
  COMPOSE_FILE="docker-compose.test.yml"
else
  COMPOSE_FILE="docker-compose.yml"
fi

# Execute command
case $COMMAND in
  start)
    echo "Starting $ENVIRONMENT environment..."
    docker-compose -f $COMPOSE_FILE up -d
    ;;
  
  stop)
    echo "Stopping $ENVIRONMENT environment..."
    docker-compose -f $COMPOSE_FILE down
    ;;
  
  restart)
    echo "Restarting $ENVIRONMENT environment..."
    docker-compose -f $COMPOSE_FILE down
    docker-compose -f $COMPOSE_FILE up -d
    ;;
  
  logs)
    echo "Showing logs for $ENVIRONMENT environment..."
    docker-compose -f $COMPOSE_FILE logs -f
    ;;
  
  clean)
    echo "Cleaning up $ENVIRONMENT environment..."
    docker-compose -f $COMPOSE_FILE down -v --remove-orphans
    ;;
  
  build)
    echo "Building images for $ENVIRONMENT environment..."
    docker-compose -f $COMPOSE_FILE build --no-cache
    ;;
  
  test)
    echo "Running tests in Docker..."
    docker-compose -f docker-compose.test.yml build
    docker-compose -f docker-compose.test.yml up --abort-on-container-exit
    docker-compose -f docker-compose.test.yml down
    ;;
  
  help)
    show_help
    ;;
  
  *)
    echo "Error: Unknown command: $COMMAND"
    show_help
    ;;
esac

exit 0 