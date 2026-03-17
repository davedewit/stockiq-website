#!/usr/bin/env python3

import boto3
import json
from datetime import datetime

def view_email_subscribers():
    """View all email subscribers for daily market alerts"""
    
    print("📧 StockIQ Email Subscribers")
    print("=" * 50)
    
    try:
        # Initialize DynamoDB
        dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
        table = dynamodb.Table('stockiq-email-subscribers')
        
        # Scan all subscribers
        response = table.scan()
        items = response.get('Items', [])
        
        if not items:
            print("No subscribers found.")
            return
        
        # Sort by subscription date
        items.sort(key=lambda x: x.get('subscribed_at', ''), reverse=True)
        
        print(f"Total subscribers: {len(items)}")
        print()
        
        active_count = 0
        unsubscribed_count = 0
        
        for item in items:
            email = item.get('email', 'N/A')
            status = item.get('status', 'unknown')
            subscribed_at = item.get('subscribed_at', 'N/A')
            source = item.get('source', 'unknown')
            
            if status == 'subscribed':
                active_count += 1
                status_icon = "✅"
            else:
                unsubscribed_count += 1
                status_icon = "❌"
            
            # Format date
            if subscribed_at != 'N/A':
                try:
                    date_obj = datetime.fromisoformat(subscribed_at.replace('Z', '+00:00'))
                    formatted_date = date_obj.strftime('%Y-%m-%d %H:%M')
                except:
                    formatted_date = subscribed_at
            else:
                formatted_date = 'N/A'
            
            print(f"{status_icon} {email}")
            print(f"   Status: {status}")
            print(f"   Subscribed: {formatted_date}")
            print(f"   Source: {source}")
            print()
        
        print("=" * 50)
        print(f"📊 Summary:")
        print(f"   Active subscribers: {active_count}")
        print(f"   Unsubscribed: {unsubscribed_count}")
        print(f"   Total: {len(items)}")
        
    except Exception as e:
        print(f"❌ Error retrieving subscribers: {e}")

if __name__ == "__main__":
    view_email_subscribers()