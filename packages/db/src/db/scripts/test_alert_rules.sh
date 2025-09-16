#!/bin/bash

# Test Alert Rules End-to-End Script
# This script tests the complete flow: seed data -> create alert rule -> trigger alert
#
# Usage:
#   ./test_alert_rules.sh                    # Test all alert rules
#   ./test_alert_rules.sh <filename>         # Test specific alert rule file
#   ./test_alert_rules.sh --list             # List available test files
#   ./test_alert_rules.sh --help             # Show help

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API Configuration
API_BASE_URL="http://localhost:8000"
JSON_DIR="json"

# Counter variables
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to show usage
show_help() {
    echo -e "${BLUE}Alert Rules End-to-End Test Script${NC}"
    echo "============================================"
    echo "Usage:"
    echo "  $0                          # Test all alert rules"
    echo "  $0 <filename>               # Test specific alert rule file"
    echo "  $0 --list                   # List available test files"
    echo "  $0 --help                   # Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 alert_rule_spending_daily_300_trigger.json"
    echo "  $0 spending_daily_300       # Partial filename match"
    echo ""
}

# Function to list available test files
list_files() {
    echo -e "${BLUE}Available Alert Rule Test Files:${NC}"
    echo "============================================"
    local count=0
    local listed_files=()
    for json_file in "$JSON_DIR"/alert_rule_*.json "$JSON_DIR"/alert_*.json; do
        if [[ -f "$json_file" ]] && [[ "$(basename "$json_file")" != "alert_rules.txt" ]]; then
            local filename=$(basename "$json_file")
            # Skip if it's already counted (in case of overlap)
            if [[ ! " ${listed_files[@]} " =~ " ${filename} " ]]; then
                count=$((count + 1))
                echo -e "${YELLOW}${count}.${NC} $filename"
                listed_files+=("$filename")
            fi
        fi
    done
    echo ""
    echo -e "${GREEN}Total: $count test files available${NC}"
}

# Parse command line arguments
SPECIFIC_FILE=""
case "${1:-}" in
    --help|-h)
        show_help
        exit 0
        ;;
    --list|-l)
        list_files
        exit 0
        ;;
    "")
        # No arguments - test all files (default behavior)
        ;;
    *)
        # Specific file argument
        SPECIFIC_FILE="$1"
        ;;
esac

# Display header
if [[ -n "$SPECIFIC_FILE" ]]; then
    echo -e "${BLUE}🧪 Testing Specific Alert Rule: ${SPECIFIC_FILE}${NC}"
else
    echo -e "${BLUE}🧪 Starting Alert Rules End-to-End Tests (All Files)${NC}"
fi
echo "============================================"

# Check if API server is running
echo -e "${YELLOW}📡 Checking API server availability...${NC}"
if ! curl -s "${API_BASE_URL}/health" > /dev/null; then
    echo -e "${RED}❌ API server is not running at ${API_BASE_URL}${NC}"
    echo -e "${YELLOW}💡 Please start the API server first:${NC}"
    echo "   cd packages/api && npm run dev"
    exit 1
fi
echo -e "${GREEN}✅ API server is running${NC}"
echo ""

# Function to extract alert_text from JSON file
extract_alert_text() {
    local file="$1"
    if [[ -f "$file" ]]; then
        # Try to extract alert_text using jq if available, otherwise use python
        if command -v jq >/dev/null 2>&1; then
            jq -r '.alert_text // empty' "$file" 2>/dev/null || echo ""
        else
            python3 -c "
import json, sys
try:
    with open('$file', 'r') as f:
        data = json.load(f)
        print(data.get('alert_text', ''))
except:
    pass
" 2>/dev/null || echo ""
        fi
    else
        echo ""
    fi
}

# Function to test a single alert rule file
test_alert_rule() {
    local json_file="$1"
    local filename=$(basename "$json_file")
    local seed_command=""
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -e "${BLUE}🔄 Testing: ${filename}${NC}"
    echo "----------------------------------------"
    
    # Map filename to seed command
    case "$filename" in
        "alert_rule_dining_30d_avg_40pct.json")
            seed_command="seed:dining-30d-avg-40pct" ;;
        "alert_rule_location_far_from_last_known_trigger.json")
            seed_command="seed:location-far-from-known" ;;
        "alert_rule_merchant_same_day_duplicates_trigger.json")
            seed_command="seed:merchant-same-day-dupes" ;;
        "alert_rule_pattern_new_recurring_detected_trigger.json")
            seed_command="seed:pattern-new-recurring" ;;
        "alert_rule_pattern_recurring_charge_20pct_trigger.json")
            seed_command="seed:pattern-recurring-20pct" ;;
        "alert_rule_pattern_recurring_charge_plus5_trigger.json")
            seed_command="seed:pattern-recurring-plus5" ;;
        "alert_rule_spending_daily_300_trigger.json")
            seed_command="seed:spending-daily-300" ;;
        "alert_rule_spending_dining_avg_plus20_trigger.json")
            seed_command="seed:dining-avg-plus20" ;;
        "alert_rule_spending_electronics_apple_3x_trigger.json")
            seed_command="seed:spending-electronics-3x" ;;
        "alert_rule_spending_weekly_500_trigger.json")
            seed_command="seed:spending-weekly-500" ;;
        "alert_rule_transaction_last_hour.json")
            seed_command="seed:last-hour" ;;
        "alert_rule_spending_amount_dining.json")
            seed_command="seed:dining" ;;
        "alert_charged_significantly_more_same_merchant.json")
            seed_command="seed:charged-more-same-merchant" ;;
        "alert_more_than_20_dollars_same_merchant.json")
            seed_command="seed:more-than-20-same-merchant" ;;
        "alert_outside_home_state_sample.json")
            seed_command="seed:outside-home-state" ;;
        *)
            echo -e "${YELLOW}⚠️  No seed command mapped for ${filename}, skipping...${NC}"
            return ;;
    esac
    
    # Extract alert text from JSON file
    local alert_text=$(extract_alert_text "$json_file")
    
    if [[ -z "$alert_text" ]]; then
        echo -e "${YELLOW}⚠️  No alert_text found in ${filename}, skipping...${NC}"
        return
    fi
    
    echo -e "${YELLOW}📝 Alert Text: ${alert_text}${NC}"
    
    # Step 1: Seed the data
    echo -e "${YELLOW}🌱 Seeding data with: pnpm ${seed_command} --force${NC}"
    if pnpm "$seed_command" --force > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Data seeded successfully${NC}"
    else
        echo -e "${RED}❌ Failed to seed data${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo ""
        return
    fi
    
    # Step 2: Create alert rule via API
    echo -e "${YELLOW}🚨 Creating alert rule via API...${NC}"
    
    local create_response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST "${API_BASE_URL}/alerts/rules" \
        -H "Content-Type: application/json" \
        -d "{\"natural_language_query\": \"$alert_text\"}")
    
    local http_status=$(echo "$create_response" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    local response_body=$(echo "$create_response" | sed -e 's/HTTPSTATUS:.*//g')
    
    if [[ "$http_status" == "200" ]]; then
        echo -e "${GREEN}✅ Alert rule created successfully (HTTP 200)${NC}"
        
        # Extract rule ID from response
        local rule_id=""
        if command -v jq >/dev/null 2>&1; then
            rule_id=$(echo "$response_body" | jq -r '.id // empty')
        else
            rule_id=$(echo "$response_body" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(data.get('id', ''))
except:
    pass
")
        fi
        
        if [[ -z "$rule_id" ]]; then
            echo -e "${RED}❌ Could not extract rule ID from response${NC}"
            echo -e "${YELLOW}📄 Response: ${response_body}${NC}"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            echo ""
            return
        fi
        
        echo -e "${GREEN}🆔 Rule ID: ${rule_id}${NC}"
        
        # Step 3: Trigger the alert rule
        echo -e "${YELLOW}🔔 Triggering alert rule...${NC}"
        
        local trigger_response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST "${API_BASE_URL}/alerts/rules/${rule_id}/trigger" \
            -H "Content-Type: application/json")
        
        local trigger_http_status=$(echo "$trigger_response" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
        local trigger_response_body=$(echo "$trigger_response" | sed -e 's/HTTPSTATUS:.*//g')
        
        if [[ "$trigger_http_status" == "200" ]]; then
            echo -e "${GREEN}✅ Alert trigger API call successful (HTTP 200)${NC}"
            
            # Check if alert was actually triggered
            local alert_triggered=""
            local status=""
            local alert_message=""
            
            if command -v jq >/dev/null 2>&1; then
                alert_triggered=$(echo "$trigger_response_body" | jq -r '.rule_evaluation.alert_triggered // false')
                status=$(echo "$trigger_response_body" | jq -r '.status // ""')
                alert_message=$(echo "$trigger_response_body" | jq -r '.rule_evaluation.alert_message // ""')
            else
                alert_triggered=$(echo "$trigger_response_body" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(data.get('rule_evaluation', {}).get('alert_triggered', False))
except:
    print('false')
")
                status=$(echo "$trigger_response_body" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(data.get('status', ''))
except:
    pass
")
                alert_message=$(echo "$trigger_response_body" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(data.get('rule_evaluation', {}).get('alert_message', ''))
except:
    pass
")
            fi
            
            if [[ "$alert_triggered" == "true" && "$status" == "triggered" ]]; then
                echo -e "${GREEN}🎉 ALERT TRIGGERED SUCCESSFULLY!${NC}"
                echo -e "${GREEN}📨 Alert Message: ${alert_message}${NC}"
                PASSED_TESTS=$((PASSED_TESTS + 1))
            else
                echo -e "${RED}❌ Alert was not triggered${NC}"
                echo -e "${YELLOW}🔍 Alert Triggered: ${alert_triggered}${NC}"
                echo -e "${YELLOW}🔍 Status: ${status}${NC}"
                echo -e "${YELLOW}📄 Full Response: ${trigger_response_body}${NC}"
                FAILED_TESTS=$((FAILED_TESTS + 1))
            fi
        else
            echo -e "${RED}❌ Failed to trigger alert (HTTP ${trigger_http_status})${NC}"
            echo -e "${YELLOW}📄 Response: ${trigger_response_body}${NC}"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
        
    else
        echo -e "${RED}❌ Failed to create alert rule (HTTP ${http_status})${NC}"
        echo -e "${YELLOW}📄 Response: ${response_body}${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    echo ""
}

# Function to find and test alert rule files
find_and_test_files() {
    local target_pattern="$1"
    local found_files=()
    
    # Find matching files - search both patterns
    local processed_files=()
    for json_file in "$JSON_DIR"/alert_rule_*.json "$JSON_DIR"/alert_*.json; do
        if [[ -f "$json_file" ]] && [[ "$(basename "$json_file")" != "alert_rules.txt" ]]; then
            local filename=$(basename "$json_file")
            
            # Skip if already processed (avoid duplicates)
            if [[ " ${processed_files[@]} " =~ " ${filename} " ]]; then
                continue
            fi
            processed_files+=("$filename")
            
            # If no specific file requested, add all files
            if [[ -z "$target_pattern" ]]; then
                found_files+=("$json_file")
            # If specific file requested, check for matches
            elif [[ "$filename" == "$target_pattern" ]] || [[ "$filename" == *"$target_pattern"* ]]; then
                found_files+=("$json_file")
            fi
        fi
    done
    
    # Check if we found any matching files
    if [[ ${#found_files[@]} -eq 0 ]]; then
        if [[ -n "$target_pattern" ]]; then
            echo -e "${RED}❌ No test files found matching: ${target_pattern}${NC}"
            echo ""
            echo -e "${YELLOW}Available files:${NC}"
            list_files
            exit 1
        else
            echo -e "${RED}❌ No alert rule test files found in ${JSON_DIR}${NC}"
            exit 1
        fi
    fi
    
    # Display what we're testing
    if [[ -n "$target_pattern" ]]; then
        echo -e "${BLUE}🔍 Found ${#found_files[@]} matching file(s) for pattern: ${target_pattern}${NC}"
    else
        echo -e "${BLUE}🔍 Found ${#found_files[@]} alert rule test file(s)${NC}"
    fi
    
    # Test each found file
    for json_file in "${found_files[@]}"; do
        test_alert_rule "$json_file"
        # Small delay between tests
        sleep 1
    done
}

# Main execution
find_and_test_files "$SPECIFIC_FILE"

# Final summary
echo "============================================"
echo -e "${BLUE}📊 TEST SUMMARY${NC}"
echo "============================================"
echo -e "${YELLOW}Total Tests: ${TOTAL_TESTS}${NC}"
echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"

if [[ $FAILED_TESTS -eq 0 ]]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}💥 Some tests failed!${NC}"
    if [[ $TOTAL_TESTS -eq 1 ]]; then
        echo -e "${YELLOW}💡 Tip: Check the API logs or run with verbose debugging for more details${NC}"
    else
        echo -e "${YELLOW}💡 Tip: Run individual failing tests for easier debugging${NC}"
        echo -e "${YELLOW}   Example: $0 <filename>${NC}"
    fi
    exit 1
fi
