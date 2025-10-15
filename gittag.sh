#!/bin/bash

# Script ini melakukan:
# 1. Add dan Commit semua perubahan lokal.
# 2. Push branch saat ini ke remote.
# 3. Membuat/Mengganti Tag versi.
# 4. Push Tag versi ke remote.

# --- 1. Persiapan Commit & Push Branch ---

# Minta input pesan commit
read -p "Masukkan pesan commit untuk perubahan ini: " commit_message

# Cek kalau pesan commit kosong
if [ -z "$commit_message" ]
then
  echo "⚠️  Pesan commit tidak boleh kosong."
  exit 1
fi

# Tambahkan semua perubahan
echo "➕ Menambahkan semua perubahan (git add .)..."
git add .

# Commit dengan pesan yang diberikan user
echo "📦 Melakukan commit..."
git commit -m "$commit_message"

# Cek status commit
if [ $? -ne 0 ]; then
  echo "❌ Error saat commit. Periksa apakah ada yang perlu di-commit."
  exit 1
fi

# Push branch (asumsi branch saat ini adalah yang ingin di-push)
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "🚀 Push branch '$CURRENT_BRANCH' ke remote..."
git push origin "$CURRENT_BRANCH"

# Cek status push branch
if [ $? -ne 0 ]; then
  echo "❌ Error saat push branch. Periksa koneksi atau hak akses Anda."
  exit 1
fi

echo "✅ Branch '$CURRENT_BRANCH' berhasil didorong (pushed) ke remote."
echo "-------------------------------------"


# --- 2. Proses Tagging & Push Tag ---

# Minta input versi tag
read -p "Masukkan versi tag baru (misal: v1.0.0): " tag_version

# Cek kalau versi tag kosong
if [ -z "$tag_version" ]
then
  echo "⚠️  Versi tag tidak boleh kosong."
  exit 1
fi

# Tanya apakah tag yang sudah ada ingin diganti (overwrite)
read -p "Apakah Anda ingin MENGGANTI tag yang sudah ada (overwrite)? (y/N) [N]: " force_tag
force_tag=${force_tag,,} # Ubah ke huruf kecil

FORCE_FLAG=""
if [[ "$force_tag" == "y" ]]; then
  FORCE_FLAG="-f"
  echo "⚠️  Mode overwrite (force) diaktifkan."
fi

# Tanya apakah ini untuk rilis (membutuhkan tag anotasi)
read -p "Apakah tag ini untuk RILIS dan butuh pesan (y/N)? [N]: " is_release
is_release=${is_release,,} # Ubah ke huruf kecil

# Default: Tag Ringan (Lightweight Tag)
TAG_COMMAND="git tag $FORCE_FLAG"
TAG_TYPE="Ringan (Lightweight)"

if [[ "$is_release" == "y" ]]; then
  
  # Jika Ya, buat Tag Anotasi
  TAG_TYPE="Anotasi (Annotated)"
  
  # Minta input pesan tag
  read -p "Masukkan pesan tag (misal: Rilis stabil pertama): " tag_message
  
  # Cek kalau pesan tag kosong
  if [ -z "$tag_message" ]
  then
    echo "⚠️  Pesan tag tidak boleh kosong untuk tag Anotasi."
    exit 1
  fi
  
  # Set perintah untuk Tag Anotasi dengan flag -f jika ada
  TAG_COMMAND="git tag -a $FORCE_FLAG -m \"$tag_message\""
fi

# 3. Buat/Ganti tag
echo "🏷️  Membuat/Mengganti tag $TAG_TYPE: $tag_version"

# Eksekusi perintah tag
eval $TAG_COMMAND "$tag_version"

# Cek status pembuatan tag
if [ $? -ne 0 ]; then
  echo "❌ Error saat membuat tag. Periksa pesan error di atas."
  exit 1
fi

# 4. Push tag ke remote
PUSH_TAG_COMMAND="git push origin $tag_version"
if [[ "$force_tag" == "y" ]]; then
  echo "🔥 Mengirim tag ke remote dengan force..."
  # Gunakan -f saat push tag
  PUSH_TAG_COMMAND="git push -f origin $tag_version"
fi

# Eksekusi push tag
eval $PUSH_TAG_COMMAND

# Cek status push tag
if [ $? -ne 0 ]; then
  echo "❌ Error saat push tag. Mungkin Anda perlu memastikan remote 'origin' sudah terhubung atau memiliki hak akses."
  exit 1
fi

echo "-------------------------------------"
echo "✅ SELURUH PROSES SELESAI. Tag '$tag_version' ($TAG_TYPE) berhasil didorong (pushed) ke remote."