#!/bin/sh
(
set -eu
ckan -c "$CKAN_INI" nis-import init-db
cp "$CKAN_INI" /nis-config/ckan.ini
)
