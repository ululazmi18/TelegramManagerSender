import asyncio
from pyrogram import Client, errors

async def main():
    session_string = ""
    chat_id = ""
    message_type = ""
    file_path = ""
    caption = ""

    client = Client("temp_client", session_string=session_string)
    await client.start()
    
    reply_text = caption if caption else ""
    message_id_to_comment = None
    comment_found = False
    
    # Check for duplicate comments
    try:
        async for message in client.get_chat_history(chat_id=chat_id, limit=30):
            try:
                async for comment in client.get_discussion_replies(chat_id=chat_id, message_id=message.id, limit=10):
                    comment_text = comment.text if comment.text else comment.caption
                    if comment_text and reply_text:
                        if reply_text.strip().lower() in comment_text.strip().lower():
                            comment_found = True
                            break
            except errors.exceptions.bad_request_400.MsgIdInvalid:
                continue
            
            if not comment_found:
                message_id_to_comment = message.id
                break
    
    except errors.exceptions.bad_request_400.UsernameNotOccupied:
        return
    
    if not message_id_to_comment:
        await client.stop()
        return
    
    discussion_message = await client.get_discussion_message(chat_id=chat_id, message_id=message_id_to_comment)
    
    # Send comment
    if file_path and message_type in ["photo", "video"]:
        import os
        ext = os.path.splitext(file_path)[1].lower()
        if message_type == "photo" or ext in [".png", ".jpg", ".jpeg", ".gif"]:
            result = await discussion_message.reply_photo(photo=file_path, caption=reply_text)
        else:
            result = await discussion_message.reply_video(video=file_path, caption=reply_text)
    else:
        from pyrogram.enums import ParseMode
        result = await discussion_message.reply(reply_text, parse_mode=ParseMode.MARKDOWN)

    print(result)

    await client.stop()

if __name__ == "__main__":
    asyncio.run(main())
