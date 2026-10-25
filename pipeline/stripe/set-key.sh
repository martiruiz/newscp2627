#!/bin/zsh
# Saves the Stripe secret key into pipeline/.env without showing it on screen (and without storing it anywhere else).
#   zsh pipeline/stripe/set-key.sh
ENV_FILE="${0:A:h}/../.env"
read -rs "KEY?Paste your Stripe Secret key (sk_test_...) and press Enter: "
echo
KEY="${KEY//[[:space:]]/}"
case "$KEY" in
  sk_test_*) ;;
  sk_live_*) echo "That's a LIVE key. Use the test key (sk_test_...) first."; exit 1 ;;
  pk_*) echo "That's the Publishable key. Copy the Secret key instead (click 'Reveal test key')."; exit 1 ;;
  *) echo "That doesn't look like a Stripe secret key (it should start with sk_test_)."; exit 1 ;;
esac
if grep -q '^STRIPE_SECRET_KEY=' "$ENV_FILE"; then
  KEY="$KEY" perl -pi -e 's/^STRIPE_SECRET_KEY=.*/STRIPE_SECRET_KEY=$ENV{KEY}/' "$ENV_FILE"
else
  print -r -- "STRIPE_SECRET_KEY=$KEY" >> "$ENV_FILE"
fi
unset KEY
echo "Saved. Now run: node stripe/setup.mjs"
