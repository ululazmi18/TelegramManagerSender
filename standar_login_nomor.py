import asyncio
from pyrogram import Client, errors

api_id = 20233450
api_hash = "f32bc9aff34316b554bce7796e4c4738"

phone_number = ""

async def main():
    app = Client('my_account', api_id=api_id, api_hash=api_hash, in_memory=True)
    await app.connect()
    result = await app.send_code(phone_number)
    phone_code = input("Enter the code you received: ")
    try:
        await app.sign_in(phone_number=phone_number, phone_code_hash=result.phone_code_hash, phone_code=phone_code)
    except errors.SessionPasswordNeeded as e:
        print("Two-step verification is enabled. Please enter your password:")
        password = input("Password: ")
        try:
            await app.check_password(password)
        except errors.BadRequest as e:
            print("Incorrect password. Please try again.")
            password = input("Password: ")
            await app.check_password(password)
    session_string = await app.export_session_string()
    print("Session String:", session_string)
    me = await app.get_me()
    print(me)
    await app.disconnect()

if __name__ == "__main__":
    asyncio.run(main())

