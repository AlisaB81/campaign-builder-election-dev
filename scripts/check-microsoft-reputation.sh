#!/bin/bash

# Microsoft Reputation Checker for IP: 51.222.16.252

echo "════════════════════════════════════════════════════════"
echo "        Microsoft Email Reputation Checker"
echo "════════════════════════════════════════════════════════"
echo ""

IP="51.222.16.252"
DOMAIN="kootenayconservative.ca"

echo "Checking IP: $IP"
echo "Domain: $DOMAIN"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Microsoft SNDS (Smart Network Data Services)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Purpose: Check your IP reputation with Microsoft"
echo "   URL: https://sendersupport.olc.protection.outlook.com/snds/"
echo "   Action: Register this IP and check color:"
echo "           - Green = Good"
echo "           - Yellow = Some issues"
echo "           - Red = Listed/blocked"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. Submit Sender Information (if not delivering)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   URL: https://sendersupport.olc.protection.outlook.com/pm/services.aspx"
echo "   Fill in:"
echo "           IP: $IP"
echo "           Domain: $DOMAIN"
echo "           Reverse DNS: mail.sw7ft.com"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. Request Delisting (if blocked)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   URL: https://sender.office.com/"
echo "   Select: Delist IP Address"
echo "   Enter: $IP"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. Checking General Reputation Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check Sender Score
echo ""
echo "📊 Sender Score:"
echo "   Visit: https://www.senderscore.org/lookup?lookup=$IP"
echo "   (Score 0-100, aim for 80+)"

# Check Talos reputation
echo ""
echo "📊 Talos Intelligence:"
echo "   Visit: https://talosintelligence.com/reputation_center/lookup?search=$IP"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. Quick Blacklist Check (from our script)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Reverse IP for DNSBL queries
REV_IP=$(echo $IP | awk -F. '{print $4"."$3"."$2"."$1}')

blacklists=(
    "zen.spamhaus.org"
    "bl.spamcop.net"
    "b.barracudacentral.org"
)

for bl in "${blacklists[@]}"; do
    result=$(dig +short ${REV_IP}.${bl} A 2>/dev/null)
    if [ -z "$result" ]; then
        echo "   ✓ Not listed on $bl"
    else
        echo "   ✗ LISTED on $bl"
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. DNS Records Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check SPF
echo ""
echo "SPF Record:"
spf=$(dig +short TXT $DOMAIN | grep spf)
if [ ! -z "$spf" ]; then
    echo "   ✓ $spf"
else
    echo "   ✗ No SPF record found"
fi

# Check DKIM
echo ""
echo "DKIM Record (mail._domainkey):"
dkim=$(dig +short TXT mail._domainkey.$DOMAIN 2>/dev/null | head -1)
if [ ! -z "$dkim" ]; then
    echo "   ✓ Found: ${dkim:0:60}..."
else
    echo "   ✗ No DKIM record found"
fi

# Check DMARC
echo ""
echo "DMARC Record:"
dmarc=$(dig +short TXT _dmarc.$DOMAIN)
if [ ! -z "$dmarc" ]; then
    echo "$dmarc" | while read line; do
        echo "   ✓ $line"
    done
    
    # Check for duplicates
    count=$(echo "$dmarc" | wc -l)
    if [ $count -gt 1 ]; then
        echo "   ⚠ WARNING: Multiple DMARC records detected ($count)"
        echo "             Remove duplicates - only first one is used!"
    fi
else
    echo "   ✗ No DMARC record found"
fi

# Check PTR
echo ""
echo "Reverse DNS (PTR):"
ptr=$(dig +short -x $IP)
if [ ! -z "$ptr" ]; then
    echo "   ✓ $ptr"
else
    echo "   ✗ No reverse DNS found"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "                    RECOMMENDATIONS"
echo "════════════════════════════════════════════════════════"
echo ""
echo "🔥 CRITICAL ACTIONS (Do today):"
echo "   1. Register IP with Microsoft SNDS"
echo "   2. Submit sender information form"
echo "   3. If blocked, request delisting"
echo "   4. Remove duplicate DMARC record"
echo ""
echo "📈 IP WARMING SCHEDULE:"
echo "   Week 1: 100 emails/day to Microsoft addresses"
echo "   Week 2: 200 emails/day"
echo "   Week 3: 500 emails/day"
echo "   Week 4: 1,000 emails/day"
echo "   Week 5+: Scale to target volume"
echo ""
echo "📋 For detailed guide, see:"
echo "   scripts/microsoft-fix-guide.md"
echo ""
echo "════════════════════════════════════════════════════════"

