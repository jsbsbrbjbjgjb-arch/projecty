# Verdant — Setup Guide

This guide covers setting up the dashboard account, registering a plant sensor, and connecting the ESP8266. No paid services are required.

## 1. Create the owner account

1. Open the app and choose **Sign up** with your email and password.
2. The first account to sign up becomes the owner and goes straight to the dashboard.
3. Any later sign-ups are held as pending until the owner approves them. Approval is currently done by setting the pending flag to false in the database table editor.

## 2. Register a device

1. Go to **Settings** and choose **Register device**. Give it a name.
2. The device secret is shown once. Copy it now.
3. If the secret is lost, generate a new one from Settings. The old one stops working immediately.

## 3. Connect the ESP8266

The firmware is not yet written. When it is, it needs:

- The device ID shown in Settings.
- The device secret from step 2.
- The app's Edge Functions address (from the project settings).

Each request sends two headers: `X-Device-Id` with the device ID, and `Authorization: Bearer <device secret>`.

Endpoints:

- `POST /functions/v1/device-telemetry` sends `{ sequence, raw_reading, moisture_percent, pump_on }` every 8 seconds. The response includes any pending commands.
- `POST /functions/v1/device-command-ack` confirms a command was received and then executed or failed.

The device must never hold the database service key. Keep the sequence counter in flash memory so it does not reset after a restart; a reset makes new readings look out of order and stops the dashboard from updating.

## 4. Free-tier usage

At an 8-second interval, one device makes roughly 324,000 calls per month. Check the current Supabase free-plan limits before adding a second device, and consider a longer interval (for example 30 seconds) if you run more than one.

## 5. Troubleshooting

- **Dashboard shows "No readings yet":** the device has not sent telemetry yet, or the device ID and secret do not match.
- **Device shows offline:** no reading has arrived in the last few minutes. Check Wi-Fi and the device secret.
- **Pump command stays pending:** the device has not fetched it yet. Commands expire automatically if they are not picked up.
