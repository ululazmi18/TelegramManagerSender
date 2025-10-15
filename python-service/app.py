"""
Flask Alternative for Pyrogram Service
Use this if FastAPI has compatibility issues with Python 3.12
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
from pyrogram import Client, errors
import asyncio
import logging
import sqlite3
import os
from pathlib import Path

# Load environment variables from parent .env file
try:
    from dotenv import load_dotenv
    # Load .env from parent directory (project root)
    env_path = Path(__file__).parent.parent / '.env'
    load_dotenv(env_path)
    print(f"✅ Loaded .env from: {env_path}")
except ImportError:
    print("⚠️ python-dotenv not available, using system environment variables")

# Use centralized logging
from logger_config import logger, log_request, log_response, log_telegram_operation, log_database_operation, log_error

app = Flask(__name__)
CORS(app)

def format_channels_with_spacing():
    """Format channels with proper spacing between categories"""
    db_path = os.path.join(os.path.dirname(__file__), '..', 'db', 'telegram_app.db')
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Query to get categories with their channels
        query = """
        SELECT c.name as category_name, ch.username as channel_username
        FROM categories c
        LEFT JOIN category_channels cc ON c.id = cc.category_id
        LEFT JOIN channels ch ON cc.channel_id = ch.id
        WHERE ch.username IS NOT NULL
        ORDER BY c.name, ch.username
        """
        
        cursor.execute(query)
        results = cursor.fetchall()
        conn.close()
        
        # Group channels by category
        categories = {}
        for category_name, channel_username in results:
            if category_name not in categories:
                categories[category_name] = []
            categories[category_name].append(channel_username)
        
        # Format with spacing between categories
        category_blocks = []
        for category_name, channels in categories.items():
            # Create block for this category
            block_lines = [category_name]
            block_lines.extend(channels)
            category_blocks.append('\n'.join(block_lines))
        
        # Join category blocks with double newlines for spacing
        return '\n\n'.join(category_blocks)
        
    except Exception as e:
        logger.error(f"Error formatting channels from database: {e}")
        return ""

# Helper to run async functions
def run_async(coro):
    """Run async coroutine in sync context"""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    try:
        return loop.run_until_complete(coro)
    except Exception as e:
        logger.error(f"Error in run_async: {e}")
        raise

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    logger.info("Health check called")
    return jsonify({"status": "healthy", "service": "python-pyrogram-service-flask"})



@app.route('/validate_session', methods=['POST'])
def validate_session():
    """Validate an existing session string - Standard approach"""
    data = request.json
    session_string = data.get("session_string")
    
    if not session_string:
        return jsonify({"success": False, "error": "session_string is required"}), 400
    
    try:
        async def _validate():
            # Use session string like in updated standard approach
            client = Client('validation_session', session_string=session_string)
            await client.start()
            
            # Get user info like in standard
            me = await client.get_me()
            
            await client.stop()
            
            return {
                "success": True,
                "valid": True,
                "user_info": {
                    "id": me.id,
                    "first_name": me.first_name,
                    "last_name": me.last_name,
                    "username": me.username,
                    "phone_number": me.phone_number,
                    "is_premium": me.is_premium
                }
            }
        
        result = run_async(_validate())
        return jsonify(result)
    except Exception as e:
        logger.error(f"Session validation error: {str(e)}")
        return jsonify({
            "success": True,
            "valid": False,
            "error": str(e)
        }), 200

@app.route('/send_message', methods=['POST'])
def send_message():
    """Send a comment to a channel post"""
    data = request.json
    session_string = data.get("session_string")
    chat_id = data.get("chat_id")
    message_type = data.get("message_type")
    file_path = data.get("file_path")
    caption = data.get("caption", "")
    
    log_request('POST', '/send_message', 
                chatId=chat_id, 
                messageType=message_type, 
                hasFile=bool(file_path),
                captionLength=len(caption) if caption else 0,
                sessionStringLength=len(session_string) if session_string else 0)
    
    if not session_string or not chat_id:
        logger.error(f"❌ Missing required parameters: session_string={bool(session_string)}, chat_id={bool(chat_id)}")
        return jsonify({"success": False, "error": "session_string and chat_id are required"}), 400
    
    try:
        logger.debug(f"🚀 Starting async send operation for chat_id: {chat_id}")
        
        async def _send():
            logger.debug(f"🔧 Creating Pyrogram client for session")
            client = Client("temp_client", session_string=session_string)
            
            logger.debug(f"🔌 Starting Pyrogram client connection")
            await client.start()
            logger.debug(f"✅ Pyrogram client connected successfully")

            # Get formatted channels data from database
            logger.debug(f"📋 Getting formatted channels data from database")
            formatted_channels_text = format_channels_with_spacing()
            logger.debug(f"📋 Formatted channels text length: {len(formatted_channels_text) if formatted_channels_text else 0}")
                
            id_save_awal = 11
            username_save = "data_aku"
            duplikat = False
            logger.debug(f"🔍 Starting duplicate check process: id_save_awal={id_save_awal}, username_save={username_save}")
            
            # Cari ID Save Data
            i = id_save_awal
            logger.debug(f"🔄 Starting save data search loop from message ID: {i}")
            
            while True:
                try:
                    logger.debug(f"🔍 Checking message ID {i} for duplicates in {username_save}")
                    comment_count = 0
                    
                    async for comment in client.get_discussion_replies(username_save, i, limit=1):
                        comment_count += 1
                        comment_text = comment.text if comment.text else comment.caption
                        logger.debug(f"📝 Found comment {comment_count}: text_length={len(comment_text) if comment_text else 0}")
                        
                        if comment_text and formatted_channels_text:
                            if formatted_channels_text.strip().lower() in comment_text.strip().lower():
                                logger.debug(f"🔍 Duplicate found! Formatted text already exists in comment")
                                duplikat = True
                                break
                        else:
                            logger.debug(f"🔍 No text comparison possible: comment_text={bool(comment_text)}, formatted_text={bool(formatted_channels_text)}")
                    
                    logger.debug(f"📊 Processed {comment_count} comments for message ID {i}")
                    
                    if not duplikat:
                        logger.debug(f"✅ No duplicate found, posting formatted channels data to message ID {i}")
                        save_data = await client.get_discussion_message(username_save, i)
                        reply_result = await save_data.reply(formatted_channels_text)
                        logger.debug(f"✅ Successfully posted channels data: reply_id={reply_result.id}")
                        break
                    else:
                        logger.debug(f"⚠️ Duplicate detected, skipping channels data posting")
                        break
                        
                except Exception as e:
                    logger.error(f"❌ Error checking message ID {i} for duplicate comment: {str(e)}")
                    logger.debug(f"🔄 Adjusting message ID: current={i}")
                    i = i - 1 if i > 0 else id_save_awal + 1
                    logger.debug(f"🔄 New message ID: {i}")
                    if i > id_save_awal + 1:
                        logger.debug(f"⏳ Sleeping 0.5s before retry")
                        await asyncio.sleep(0.5)

            # Reply Text
            reply_text = caption if caption else ""
            message_id_to_comment = None
            comment_found = False
            result = None
            
            logger.debug(f"💬 Preparing to send comment: reply_text_length={len(reply_text)}")
            logger.debug(f"🎯 Target chat_id: {chat_id}")
            
            # Check for duplicate comments - following standard approach
            logger.debug(f"🔍 Starting duplicate comment check in chat history (limit=30)")
            
            try:
                message_count = 0
                async for message in client.get_chat_history(chat_id=chat_id, limit=30):
                    message_count += 1
                    logger.debug(f"📨 Processing message {message_count}: id={message.id}, date={message.date}")
                    
                    try:
                        comment_count = 0
                        async for comment in client.get_discussion_replies(chat_id=chat_id, message_id=message.id, limit=10):
                            comment_count += 1
                            comment_text = comment.text if comment.text else comment.caption
                            logger.debug(f"💬 Comment {comment_count} in message {message.id}: text_length={len(comment_text) if comment_text else 0}")
                            
                            if comment_text and reply_text:
                                if reply_text.strip().lower() in comment_text.strip().lower():
                                    logger.debug(f"🔍 DUPLICATE FOUND! Reply text already exists in comment {comment.id}")
                                    comment_found = True
                                    message_id_to_comment = message.id
                                    result = comment
                                    break
                            else:
                                logger.debug(f"🔍 No text comparison: comment_text={bool(comment_text)}, reply_text={bool(reply_text)}")
                        
                        logger.debug(f"📊 Processed {comment_count} comments for message {message.id}")
                        
                    except errors.exceptions.bad_request_400.MsgIdInvalid:
                        logger.debug(f"⚠️ Invalid message ID {message.id}, skipping")
                        continue
                    
                    if not comment_found:
                        logger.debug(f"✅ No duplicate found, selecting message {message.id} for commenting")
                        message_id_to_comment = message.id
                        break
                    else:
                        logger.debug(f"🛑 Duplicate found, stopping search")
                        break
                
                logger.debug(f"📊 Chat history analysis complete: processed {message_count} messages")
            except errors.exceptions.bad_request_400.UsernameNotOccupied:
                logger.error(f"❌ Username not occupied or channel not found: {chat_id}")
                await client.stop()
                return {
                    "success": False,
                    "error": "Username not occupied or channel not found"
                }
            
            if comment_found:
                logger.info(f"⏭️ SKIPPING: Duplicate comment found - message_id={result.id}, parent_id={message_id_to_comment}")
                logger.debug(f"📊 Skipped comment details: chat_id={result.chat.id}, date={result.date}")
                await client.stop()
                return {
                    "success": True,
                    "skipped": True,
                "data": {
                    "message_id": result.id,
                    "chat_id": result.chat.id,
                    "date": result.date.isoformat() if result.date else None,
                    "parent_message_id": message_id_to_comment
                }
                }
            
            if not message_id_to_comment:
                logger.error(f"❌ No suitable message found to comment on in chat {chat_id}")
                await client.stop()
                raise Exception("No suitable message found to comment on")
            
            logger.debug(f"📨 Getting discussion message: chat_id={chat_id}, message_id={message_id_to_comment}")
            discussion_message = await client.get_discussion_message(chat_id=chat_id, message_id=message_id_to_comment)
            logger.debug(f"✅ Discussion message retrieved successfully: id={discussion_message.id}")
            
            # Send comment
            logger.debug(f"📤 Preparing to send comment: type={message_type}, has_file={bool(file_path)}")
            
            if file_path and message_type in ["photo", "video"]:
                import os
                ext = os.path.splitext(file_path)[1].lower()
                logger.debug(f"📁 File details: path={file_path}, extension={ext}")
                
                if message_type == "photo" or ext in [".png", ".jpg", ".jpeg", ".gif"]:
                    logger.debug(f"📸 Sending photo with caption: caption_length={len(reply_text)}")
                    result = await discussion_message.reply_photo(photo=file_path, caption=reply_text)
                    logger.debug(f"✅ Photo sent successfully: result_id={result.id}")
                else:
                    logger.debug(f"🎥 Sending video with caption: caption_length={len(reply_text)}")
                    result = await discussion_message.reply_video(video=file_path, caption=reply_text)
                    logger.debug(f"✅ Video sent successfully: result_id={result.id}")
            else:
                logger.debug(f"💬 Sending text message: text_length={len(reply_text)}")
                from pyrogram.enums import ParseMode
                result = await discussion_message.reply(reply_text, parse_mode=ParseMode.MARKDOWN)
                logger.debug(f"✅ Text message sent successfully: result_id={result.id}")
            
            logger.debug(f"🔌 Stopping Pyrogram client")
            await client.stop()
            logger.debug(f"✅ Pyrogram client stopped successfully")
            
            log_telegram_operation('MESSAGE_SENT_SUCCESS',
                                   messageId=result.id,
                                   chatId=result.chat.id,
                                   parentId=message_id_to_comment,
                                   messageDate=result.date.isoformat() if result.date else None)
            
            return {
                "success": True,
                "skipped": False,
                "data": {
                    "message_id": result.id,
                    "chat_id": result.chat.id,
                    "date": result.date.isoformat() if result.date else None,
                    "parent_message_id": message_id_to_comment
                }
            }
        
        logger.debug(f"🚀 Executing async send operation")
        result = run_async(_send())
        
        # Log response
        status_code = 200 if result.get('success') else 500
        log_response('POST', '/send_message', status_code,
                    success=result.get('success'),
                    skipped=result.get('skipped'),
                    messageId=result.get('data', {}).get('message_id') if result.get('success') else None)
        
        return jsonify(result)
    except Exception as e:
        log_error('SEND_MESSAGE', e, 
                 chatId=chat_id,
                 messageType=message_type,
                 hasFile=bool(file_path))
        
        log_response('POST', '/send_message', 500, error=str(e))
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/get_me', methods=['POST'])
def get_me():
    """Get information about the current user - Standard approach"""
    data = request.json
    session_string = data.get("session_string")
    
    if not session_string:
        return jsonify({"success": False, "error": "session_string is required"}), 400
    
    try:
        async def _get_me():
            # Use updated standard approach with start/stop
            client = Client("user_info_session", session_string=session_string)
            await client.start()
            me = await client.get_me()
            await client.stop()
            
            return {
                "success": True,
                "user_info": {
                    "id": me.id,
                    "first_name": me.first_name,
                    "last_name": me.last_name,
                    "username": me.username,
                    "phone_number": me.phone_number,
                    "is_premium": me.is_premium,
                }
            }
        
        result = run_async(_get_me())
        return jsonify(result)
    except Exception as e:
        logger.error(f"Get user info error: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    print("🚀 Starting Flask Pyrogram Service on port 8000...")
    app.run(host="0.0.0.0", port=8000, debug=False)
