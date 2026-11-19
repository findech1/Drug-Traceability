# PharmaChain Kenya — React Native Mobile App (Expo)

Native iOS & Android companion app built with **React Native + Expo (`expo-camera`)**, consuming the Node.js Express API Gateway (`server.ts`) backed by Hyperledger Fabric & Apache CouchDB.

## Features
- **Live Camera QR & GS1 DataMatrix Scanner**: Parses GS1 Digital Link URIs (`(01)/(10)/(17)/(21)`) and queries `GET /api/verify/:batchNo`.
- **Consumer Safety Verdicts**: Displays instant Authentic, Expired, Counterfeit, or PPB Class I Recall lockouts with full custody history.
- **Field Officer Custody Acceptance**: Lists World State inventory (`GET /api/ledger/state`) and submits `receiveBatch` chaincode transactions (`POST /api/fabric/invoke`).

## Running Locally
1. Ensure the Node.js backend (`npm run dev`) is running on port `3000`.
2. Install mobile dependencies & start Expo:
```bash
cd mobile
npm install
npx expo start
```
3. Optional: For testing on a physical phone via **Expo Go**, set your computer's LAN IP before starting:
```bash
EXPO_PUBLIC_API_URL=http://192.168.1.50:3000 npx expo start
```
