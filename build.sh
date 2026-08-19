#!/usr/bin/env bash
set -o errexit

pip install --upgrade pip
pip install -r backend/requirements.txt

python backend/manage.py collectstatic --no-input --clear
python backend/manage.py migrate
