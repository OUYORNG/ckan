# Upstream software

- `ckan/` is a Git submodule pointing to https://github.com/ckan/ckan at CKAN 2.11.7, commit `f6b16ad71f4bd08c61276ff94cb386fadef70e71`.
- `ckan-docker/` contains setup files from https://github.com/ckan/ckan-docker at commit `7dcd4c1f3da14c9701870980d483d1d3de93d98c`, with local configuration, initialization, and helper additions. Its separate Git history is not included in this repository.

CKAN and the upstream Docker setup are licensed under GNU AGPL v3. See `LICENSE.txt` and the upstream copyright notices retained in their documentation.

## React interface

The frontend uses React and React DOM (MIT), React Router (MIT), Lucide (ISC), Vite (MIT), and TypeScript (Apache-2.0). Exact versions and transitive packages are recorded in `frontend/package-lock.json`.

Inter and Noto Sans Khmer are self-hosted through Fontsource and distributed under SIL Open Font License 1.1. Their copyright and license texts are included in `frontend/public/licenses/` and served with the production interface.
