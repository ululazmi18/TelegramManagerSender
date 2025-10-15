#!/home/ulul/telegramManagerSender/venv/bin/python
"""
Telegram Session String Generator
Converts phone number to session string for Telegram API usage.
"""

import asyncio
import sys
import os
from pyrogram import Client

# Telegram API credentials
API_ID = 20233450
API_HASH = "f32bc9aff34316b554bce7796e4c4738"

def get_phone_number():
    """Get phone number from user input."""
    while True:
        phone = input("Enter your phone number (with country code, e.g., 6281234567890): ").strip()
        if phone:
            return phone
        print("❌ Phone number cannot be empty. Please try again.")

async def generate_session_string(phone_number):
    """
    Generate session string from phone number.
    
    Args:
        phone_number (str): Phone number with country code
        
    Returns:
        str: Session string for Telegram API
    """
    try:
        print(f"📱 Starting login process for: {phone_number}")
        
        # Create Telegram client
        app = Client(
            name='telegram_session',
            api_id=API_ID,
            api_hash=API_HASH,
            phone_number=phone_number,
            in_memory=True
        )
        
        # Start client and authenticate
        print("🔐 Connecting to Telegram...")
        await app.start()
        
        # Export session string
        print("📋 Generating session string...")
        session_string = await app.export_session_string()
        
        # Stop client
        await app.stop()
        
        return session_string
        
    except Exception as e:
        print(f"❌ Error generating session string: {str(e)}")
        return None

async def main():
    """Main function to generate session string."""
    print("🚀 Telegram Session String Generator")
    print("=" * 50)
    
    try:
        # Get phone number
        phone_number = get_phone_number()
        
        # Generate session string
        session_string = await generate_session_string(phone_number)
        
        if session_string:
            print("\n" + "=" * 50)
            print("✅ SUCCESS! Session string generated successfully!")
            print("=" * 50)
            print(f"📱 Phone Number: {phone_number}")
            print(f"📋 Session String: {session_string}")
            print("=" * 50)
            
            print("\n💡 IMPORTANT:")
            print("• Copy the session string above")
            print("• Use it in 'Add Session' on the Sessions page")
            print("• Keep it secure - treat it like a password")
            print("• This session string allows full access to your Telegram account")
            
        else:
            print("\n❌ Failed to generate session string.")
            print("Please check your phone number and try again.")
            
    except KeyboardInterrupt:
        print("\n\n⚠️ Process interrupted by user.")
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")
    
    print("\n🔚 Session generator finished.")

if __name__ == "__main__":
    # Run the async main function
    asyncio.run(main())
