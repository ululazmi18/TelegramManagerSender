#!/bin/bash

# Script untuk add, commit, dan push ke branch main

# Minta input pesan commit
read -p "Masukkan pesan commit: " commit_message

# Cek kalau pesan commit kosong
if [ -z "$commit_message" ]
then
  echo "⚠️  Pesan commit tidak boleh kosong."
  exit 1
fi

# Tambahkan semua perubahan
git add .

# Commit dengan pesan yang diberikan user
git commit -m "$commit_message"

# Cek apakah ada argumen -u
if [ "$1" == "-u" ]; then
  echo "🚀 Push pertama kali dengan upstream..."
  git push -u origin main
else
  echo "🚀 Push ke branch main..."
  git push origin main
fi
