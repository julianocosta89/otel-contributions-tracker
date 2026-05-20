.PHONY: fetch-data fetch-data-full fetch-affiliations serve

fetch-data:
	node scripts/fetch-data.mjs & P1=$$!; \
	node scripts/fetch-sigs.mjs & P2=$$!; \
	node scripts/fetch-roles.mjs & P3=$$!; \
	node scripts/fetch-affiliations.mjs & P4=$$!; \
	EC=0; wait $$P1 || EC=1; wait $$P2 || EC=1; wait $$P3 || EC=1; wait $$P4 || EC=1; exit $$EC

fetch-data-full:
	node scripts/fetch-data.mjs --full & P1=$$!; \
	node scripts/fetch-sigs.mjs --full & P2=$$!; \
	node scripts/fetch-roles.mjs & P3=$$!; \
	node scripts/fetch-affiliations.mjs & P4=$$!; \
	EC=0; wait $$P1 || EC=1; wait $$P2 || EC=1; wait $$P3 || EC=1; wait $$P4 || EC=1; exit $$EC

# Run the full affiliation pipeline: gitdm first, then GitHub profile fallback.
# fetch-github-companies.mjs depends on both cache.json and affiliations.json.
fetch-affiliations:
	node scripts/fetch-affiliations.mjs
	node scripts/fetch-github-companies.mjs

serve:
	python3 -m http.server 3456
