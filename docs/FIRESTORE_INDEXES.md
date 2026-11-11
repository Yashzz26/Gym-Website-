# Firestore Composite Indexes & Deployment Guide

This document outlines the Firestore composite index definitions required by the **Gym Management System** and provides deployment instructions.

---

## 1. Membership Plans Collection (`membershipPlans`)

To query active membership plans ordered by display priority and price, composite indexes are configured in [firestore.indexes.json](../firestore.indexes.json):

| Collection Group | Fields Indexed | Query Scope | Purpose |
|------------------|----------------|-------------|---------|
| `membershipPlans` | `isActive` (ASC), `displayOrder` (ASC) | `COLLECTION` | Powers public portal & member joining plan queries ordered by presentation tier |
| `membershipPlans` | `isActive` (ASC), `priceInPaise` (ASC) | `COLLECTION` | Powers sorting plans by pricing tier (lowest to highest) |

---

## 2. Configuration File

The indexes are defined in `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "membershipPlans",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isActive", "order": "ASCENDING" },
        { "fieldPath": "displayOrder", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "membershipPlans",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isActive", "order": "ASCENDING" },
        { "fieldPath": "priceInPaise", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

---

## 3. Deployment Instructions

### Deploy to Live Firebase Project

Ensure the Firebase CLI is installed and logged in (`firebase login`), then deploy indexes:

```bash
firebase deploy --only firestore:indexes
```

### Local Testing with Firebase Emulator

When running the local emulator suite, the emulator automatically loads `firestore.indexes.json`:

```bash
firebase emulators:start --only firestore
```

