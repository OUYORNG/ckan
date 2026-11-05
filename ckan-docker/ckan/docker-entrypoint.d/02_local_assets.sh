#!/bin/sh
(
set -eu
asset_target="${CKAN_STORAGE_PATH}/webassets/ckanext-datatablesview/vendor/FontAwesome/images"
mkdir -p "$asset_target"
cp "${SRC_DIR}/ckan/ckanext/datatablesview/assets/vendor/FontAwesome/images/times-circle-solid.svg" "$asset_target/"
)
