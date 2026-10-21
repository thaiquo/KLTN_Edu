# EduConnect Mobile M0

Expo/React Native client for the shared EduConnect API Gateway. No service owns a mobile-only database.

Set `EXPO_PUBLIC_API_URL` to the Gateway URL reachable from the device. Android emulator can use `http://10.0.2.2:8080`; iOS simulator can use `http://localhost:8080`; a physical device needs the host LAN address and firewall access. Use HTTPS for non-local deployments.

Run `npm install`, `npm run typecheck`, then `npm start`. Access tokens stay in memory; the rotating refresh credential is stored with Expo SecureStore. WalletConnect and transaction UI are reserved for M7/M8.
