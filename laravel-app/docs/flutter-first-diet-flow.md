# Flutter First Diet Flow

This document describes the required Flutter/API flow for the first nutrition diet request after a customer purchases a package.

The important rule is:

**Buying a package does not create a diet request by itself.**

The app must guide the customer through the remaining first-diet steps, then explicitly confirm the diet request.

## High-Level Flow

```text
Package purchased
-> Refresh nutrition profile or diet request options
-> If mindset is incomplete, show the 5-question prompt
-> Submit all mindset answers
-> Open the diet confirmation screen
-> Preview the first diet request
-> Customer confirms
-> Create the diet request
-> Show "Your diet is being prescribed"
-> Refresh profile
-> Keep showing prescribing state until the expert publishes the diet
-> After publish, show "View diet"
```

## Step 1: Refresh State After Package Purchase

After a successful package purchase, call one of these endpoints:

```http
GET /api/v1/app/nutrition/profile
```

or:

```http
GET /api/v1/app/nutrition/diet-requests/options
```

Use these fields to decide the next screen:

```json
{
  "dashboard": {
    "state": "needs_mindset"
  }
}
```

or:

```json
{
  "requirements": {
    "mindsetCompleted": false
  }
}
```

If either indicates that mindset is incomplete, the customer must answer the 5 supplementary questions before confirming the first diet request.

## Step 2: Show the Mindset Intro Screen

Before opening the questions, show a short screen or modal:

Title:

```text
Supplementary Questions
```

Body:

```text
To receive your diet, please answer 5 short supplementary questions first.
```

Primary button:

```text
Start Questions
```

The primary button opens the mindset flow.

## Step 3: Load and Submit the 5 Mindset Questions

Load the questions:

```http
GET /api/v1/app/membership/mindset
```

This endpoint returns all 5 questions. The UI may show them as:

- A 5-step wizard
- A single form
- A paged question flow

After all answers are collected, submit them together:

```http
POST /api/v1/app/membership/mindset
```

After success, go to the first diet confirmation screen.

## Step 4: Open the First Diet Confirmation Screen

Before showing the confirmation screen, call preview:

```http
POST /api/v1/app/nutrition/diet-requests/preview
```

For auto-first-diet mode, use this payload:

```json
{
  "requestType": "ai"
}
```

When `autoFirstDietEnabled` is enabled and a valid template exists for the customer goal/package, `nutritionDietTemplateId` is not required. The server resolves the template automatically and returns it in `request.dietTemplate`.

If auto-first-diet is not available, the server may require the app to send a selected template:

```json
{
  "requestType": "ai",
  "nutritionDietTemplateId": 12
}
```

## Step 5: Design the Confirmation Screen

Use the preview response to render the confirmation screen.

Example preview response shape:

```json
{
  "success": true,
  "message": "Preview is ready.",
  "data": {
    "flowType": "first_diet",
    "request": {
      "requestType": "ai",
      "dietTemplate": {
        "id": "12",
        "name": "Balanced Weight Loss Diet",
        "prescriptionMode": "daily_prescription",
        "durationDays": 30
      },
      "expertDescription": null,
      "currentWeightKg": 84,
      "dietGoal": "lose-weight",
      "followUp": null
    },
    "balance": {
      "mode": "ai",
      "total": 2,
      "used": 0,
      "remaining": 2,
      "remainingAfterConfirmation": 1
    },
    "subscription": {
      "id": "7",
      "status": "active",
      "onlineDietTotal": 2,
      "onlineDietUsed": 0,
      "onlineDietRemaining": 2,
      "offlineDietTotal": 0,
      "offlineDietUsed": 0,
      "offlineDietRemaining": 0
    },
    "canConfirm": true,
    "confirmEndpoint": "/api/v1/app/nutrition/diet-requests"
  },
  "meta": {}
}
```

Recommended screen title:

```text
Confirm Diet Request
```

Show these fields:

- Diet/template name: `data.request.dietTemplate.name`
- Diet duration: `data.request.dietTemplate.durationDays`
- Current weight: `data.request.currentWeightKg`
- Diet goal: `data.request.dietGoal`
- Remaining quota before confirmation: `data.balance.remaining`
- Remaining quota after confirmation: `data.balance.remainingAfterConfirmation`

Recommended body text:

```text
After confirmation, one diet credit will be used from your package and your request will be sent for prescription.
```

Primary button:

```text
Confirm and Send for Prescription
```

Secondary button:

```text
Back
```

Disable the primary button if:

```json
"canConfirm": false
```

## Step 6: Confirm the First Diet Request

When the customer taps the primary button, call:

```http
POST /api/v1/app/nutrition/diet-requests
```

For auto-first-diet mode:

```json
{
  "requestType": "ai"
}
```

For manual template selection:

```json
{
  "requestType": "ai",
  "nutritionDietTemplateId": 12
}
```

On success:

- A diet request is created.
- One online diet credit is consumed.
- The user should no longer be able to create another diet request while this one is active.
- The app should show a success message.

Recommended success message:

```text
Your diet is being prescribed.
```

Then refresh the profile:

```http
GET /api/v1/app/nutrition/profile
```

## Step 7: Profile State While Prescribing

After confirmation, before the expert publishes the diet, the profile should return:

```json
{
  "dashboard": {
    "state": "prescribing",
    "banner": {
      "type": "prescribing",
      "title": "Your diet is being prescribed"
    },
    "dietAction": {
      "type": "prescribing",
      "title": "Diet is being prescribed",
      "href": null,
      "disabled": true
    }
  }
}
```

In this state:

- Show a clear "Your diet is being prescribed" card.
- Disable the get-diet button.
- Do not allow another diet request.
- The user should wait until the expert publishes the diet.

Recommended profile card:

Title:

```text
Your diet is being prescribed
```

Description:

```text
After your diet is ready, you can view it from this section.
```

## Step 8: After Expert Approval / Publish

After the expert approves and publishes the prescription, the profile changes to:

```json
{
  "dashboard": {
    "dietAction": {
      "type": "view_current_diet",
      "title": "View diet",
      "href": "/nutrition/my-diet",
      "disabled": false
    }
  }
}
```

In this state, show:

```text
View Diet
```

Tapping it should open the current diet screen.

## Endpoint Summary

Refresh profile:

```http
GET /api/v1/app/nutrition/profile
```

Get diet request options:

```http
GET /api/v1/app/nutrition/diet-requests/options
```

Load mindset questions:

```http
GET /api/v1/app/membership/mindset
```

Submit mindset answers:

```http
POST /api/v1/app/membership/mindset
```

Preview first diet request:

```http
POST /api/v1/app/nutrition/diet-requests/preview
```

Confirm first diet request:

```http
POST /api/v1/app/nutrition/diet-requests
```

## Important Implementation Notes

- Package purchase alone must not create a diet request.
- The first diet request is created only after `POST /api/v1/app/nutrition/diet-requests`.
- If auto-first-diet is enabled, Flutter should not require template selection.
- In auto-first-diet mode, send `{ "requestType": "ai" }` to both preview and confirm.
- The confirmation screen must be driven by the preview response.
- Do not consume quota during preview.
- Quota is consumed only during final confirmation.
- After confirmation, always refresh profile and show the `prescribing` state.
- Once the expert publishes the prescription, the profile action becomes `view_current_diet`.

