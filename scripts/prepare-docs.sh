#!/usr/bin/env bash
set -euo pipefail

# Copies the 4 project doc directories into site/ for the unified VitePress build,
# excluding each sub-site's .vitepress/ directory.

DOC_DIRS=("claude_code_docs" "codex_docs" "vercel_ai_docs" "hermes_agent_docs")

# Cross-platform sed in-place: macOS needs -i '', Linux needs -i
SED_INPLACE=(sed -i)
if [[ "$OSTYPE" == "darwin"* ]]; then
  SED_INPLACE=(sed -i '')
fi

# Verify all source directories exist before copying anything
for dir in "${DOC_DIRS[@]}"; do
  if [ ! -d "$dir" ]; then
    echo "ERROR: Required doc directory '$dir' not found in workspace root." >&2
    exit 1
  fi
done

# Copy each doc directory into site/, excluding .vitepress/
for dir in "${DOC_DIRS[@]}"; do
  echo "Copying $dir -> site/$dir (excluding .vitepress/)"
  rm -rf "site/$dir"
  rsync -a --exclude='.vitepress' "$dir/" "site/$dir/"
done

# Rewrite internal links in each sub-site so they resolve correctly
# within the unified site/ directory structure.
for dir in "${DOC_DIRS[@]}"; do
  echo "Rewriting internal links in site/$dir/ to include /$dir prefix"

  # Markdown links: ](/path) → ](/dir/path)
  find "site/$dir" -name '*.md' -exec "${SED_INPLACE[@]}" -E "s|\]\(/${dir}/|](__KEEP__/${dir}/|g" {} +
  find "site/$dir" -name '*.md' -exec "${SED_INPLACE[@]}" -E "s|\]\(/([a-z])|](/${dir}/\1|g" {} +
  find "site/$dir" -name '*.md' -exec "${SED_INPLACE[@]}" -E "s|\]\(__KEEP__/|](/|g" {} +

  # Frontmatter link: properties
  find "site/$dir" -name '*.md' -exec "${SED_INPLACE[@]}" -E "s|^([[:space:]]+link: )/${dir}/|\1__KEEP__/${dir}/|g" {} +
  find "site/$dir" -name '*.md' -exec "${SED_INPLACE[@]}" -E "s|^([[:space:]]+link: )/([a-z])|\1/${dir}/\2|g" {} +
  find "site/$dir" -name '*.md' -exec "${SED_INPLACE[@]}" -E "s|^([[:space:]]+link: )__KEEP__/|\1/|g" {} +
done

echo "All doc directories copied and links rewritten successfully."
