#!/bin/bash

PROJECT_ID="$1"

if [ -z "$PROJECT_ID" ]; then
    echo "Usage: $0 <project_id>"
    echo "Example: $0 69c12c35-4136-4a2a-8379-9d482e1960fb"
    exit 1
fi

echo "🔍 Quick Log Analysis for Project: $PROJECT_ID"
echo "=============================================="

echo ""
echo "📊 Event Counts:"
echo "• Total events: $(grep -c "$PROJECT_ID" logs/combined.log)"
echo "• Job processing: $(grep -c "Worker processing job.*$PROJECT_ID" logs/combined.log)"
echo "• Job completed: $(grep -c "Job completed successfully.*$PROJECT_ID" logs/combined.log)"
echo "• Stats updated: $(grep -c "Successfully updated.*stats.*$PROJECT_ID" logs/combined.log)"
echo "• Auto status checks: $(grep -c "check_project_status.*$PROJECT_ID" logs/combined.log)"
echo "• Manual checks: $(grep -c "manual_completion_check.*$PROJECT_ID" logs/combined.log)"

echo ""
echo "🔄 Recent Process Runs:"
sqlite3 ../db/telegram_app.db "SELECT id, status, stats FROM process_runs WHERE project_id = '$PROJECT_ID' ORDER BY created_at DESC LIMIT 3;"

echo ""
echo "📋 Current Project Status:"
sqlite3 ../db/telegram_app.db "SELECT id, name, status FROM projects WHERE id = '$PROJECT_ID';"

echo ""
echo "⏰ Latest Events (last 10):"
grep "$PROJECT_ID" logs/combined.log | tail -10 | while read line; do
    timestamp=$(echo "$line" | grep -o '"timestamp": "[^"]*"' | cut -d'"' -f4)
    message=$(echo "$line" | grep -o '"message": "[^"]*"' | cut -d'"' -f4)
    operation=$(echo "$line" | grep -o '"operation": "[^"]*"' | cut -d'"' -f4)
    
    if [ -n "$timestamp" ]; then
        echo "  $timestamp [$operation] $message"
    fi
done

echo ""
echo "🚨 Race Condition Detection:"
echo "Looking for status checks with completed_jobs: 0..."
grep "$PROJECT_ID" logs/combined.log | grep -E "(completedJobs|completed_jobs).*: 0" | tail -3

echo ""
echo "💡 Project Management Commands:"
echo "• Stop project: curl -X POST http://localhost:3000/api/projects/$PROJECT_ID/stop"
echo "• View logs: curl http://localhost:3000/api/projects/$PROJECT_ID/logs"
