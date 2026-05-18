.PHONY: fetch-data fetch-data-full serve

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

serve:
	python3 -m http.server 3456
