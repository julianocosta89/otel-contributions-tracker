.PHONY: fetch-data fetch-data-full serve

fetch-data:
	node scripts/fetch-data.mjs
	node scripts/fetch-sigs.mjs

fetch-data-full:
	node scripts/fetch-data.mjs --full
	node scripts/fetch-sigs.mjs --full

serve:
	python3 -m http.server 3456
