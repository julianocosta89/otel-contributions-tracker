.PHONY: fetch-data fetch-data-full fetch-affiliations serve

fetch-data:
	node scripts/fetch-data.mjs & \
	node scripts/fetch-sigs.mjs & \
	node scripts/fetch-roles.mjs & \
	node scripts/fetch-affiliations.mjs & \
	wait

fetch-data-full:
	node scripts/fetch-data.mjs --full & \
	node scripts/fetch-sigs.mjs --full & \
	node scripts/fetch-roles.mjs & \
	node scripts/fetch-affiliations.mjs & \
	wait

# Run the full affiliation pipeline: gitdm first, then GitHub profile fallback.
# fetch-github-companies.mjs depends on both cache.json and affiliations.json.
fetch-affiliations:
	node scripts/fetch-affiliations.mjs
	node scripts/fetch-github-companies.mjs

serve:
	python3 -m http.server 3456
