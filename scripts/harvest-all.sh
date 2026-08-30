#!/usr/bin/env bash
# The remaining harvest, ready to run in one go.
#
# Four categories are still short of twenty posts. The queries below were shaped
# against the one batch that did run before the X account ran out of credits, and
# the lesson from it is in the exclusions: generic phrasing about games or
# learning pulls in games media, Steam and Switch announcements, and course
# marketing, all of which arrive with enough likes to crowd out the posts worth
# having. Roughly one query in three yields something usable, so each category
# gets six or seven attempts rather than two.
#
# Requires X_BEARER_TOKEN. Writes candidates to /tmp/cand-<label>.json; nothing is
# stored until the output has been read and fed to import-candidates.mts.
set -euo pipefail
cd "$(dirname "$0")/.."

NO_MEDIA='-steam -"nintendo switch" -playstation -xbox -"out now on" -preorder -trailer'

run() { npx tsx scripts/harvest.mts "$@"; }

run web-app \
  '("I built" OR "I made" OR "shipped") ("a web app" OR "an app that" OR "a tool that") ("try it" OR "free" OR "no signup")' \
  '("built a" OR "made a") (dashboard OR calculator OR converter OR planner OR tracker) ("try it" OR "link" OR launched)' \
  '("this app" OR "this tool") ("saves me" OR "saved me" OR "so much time") (built OR made OR shipped)' \
  '("side project" OR "weekend project") (launched OR shipped OR live) ("web app" OR browser OR "no install")' \
  '("replaced" OR "instead of") (spreadsheet OR notion OR excel) ("I built" OR "so I built" OR "so I made")' \
  '("launched" OR "just shipped") ("my first" OR "my new") (app OR tool) -waitlist'

run education \
  '("interactive" OR "visual") (explainer OR explanation OR guide OR lesson) (built OR made OR launched OR "I made")' \
  '("learn" OR "teaches you") ("interactively" OR "by doing" OR "in your browser") (built OR made OR site)' \
  '("visualizing" OR "visualization of" OR "simulation of") ("how" OR "why") (works OR happens) (built OR made)' \
  '("for my kids" OR "for students" OR "for my students") ("I built" OR "I made" OR app OR site)' \
  '("flashcard" OR "quiz app" OR "practice app" OR "study tool") (built OR made OR launched)' \
  '("interactive textbook" OR "interactive course" OR "learning app" OR "explorable explanation")'

run own-site \
  '("my new portfolio" OR "new portfolio" OR "portfolio site") (live OR launched OR redesign OR "finally")' \
  '("personal site" OR "personal website" OR "my website") (redesign OR rebuilt OR launched OR live OR new)' \
  '("my studio" OR "our studio") (site OR website) (live OR launched OR new)' \
  '("finally" OR "just") ("shipped my" OR "launched my") (site OR website OR portfolio)' \
  '("digital garden" OR "now page" OR "personal blog") (built OR launched OR redesign)' \
  '("portfolio" OR "case study") ("feedback welcome" OR "would love feedback" OR "roast my")'

run building-block \
  '("component library" OR "UI kit" OR "design system") (released OR launched OR "open source" OR free)' \
  '("generator" OR "maker") (font OR icon OR gradient OR button OR favicon OR mockup OR pattern) (built OR made OR free)' \
  '("copy and paste" OR "copy-paste" OR "drop into your") (component OR components OR animation OR effect)' \
  '("npm install" OR "just published" OR "v1 is out") (library OR package OR plugin OR hook)' \
  '("I built a tool" OR "I made a tool") (designers OR developers) (free OR "try it")' \
  '("tailwind" OR "react" OR "framer motion") (components OR templates OR blocks) (free OR launched OR released)'

run game \
  '("browser game" OR "playable in the browser") ("I made" OR "I built" OR "we built") '"$NO_MEDIA" \
  '("play it here" OR "play it free" OR "no download") (game OR games) (built OR made OR coded) '"$NO_MEDIA" \
  '("game jam" OR js13k OR "ludum dare") (entry OR submission OR play) '"$NO_MEDIA" \
  '("multiplayer" OR "1v1" OR "io game") (browser OR web OR "no install") (built OR made OR launched) '"$NO_MEDIA"

echo
echo "Read /tmp/cand-*.json, write decisions.json, then:"
echo "  npx tsx scripts/import-candidates.mts decisions.json"
