# Flutter First Diet Flow

This document describes the required Flutter/API flow for the first nutrition diet request after a customer purchases a package.

The core rule is:

**Buying a package does not create a diet request by itself.**

The app must guide the customer through the 5 supplementary mindset questions, show a confirmation screen, and only then create the first diet request.

## High-Level Flow

```text
Package purchased
-> Refresh nutrition profile or diet request options
-> If mindset is incomplete, show the 5-question mindset flow
-> User taps an answer; the UI automatically moves to the next question
-> Submit all 5 answers together
-> If auto-first-diet is available, open confirmation directly
-> Preview the first AI diet request without nutritionDietTemplateId
-> Customer confirms
-> Create the diet request
-> Show "Your diet is being prescribed"
-> Refresh profile
-> Keep showing prescribing state until the expert approves/publishes the diet
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
  "flowType": "first_diet",
  "requirements": {
    "profileCompleted": true,
    "activePackage": true,
    "mindsetCompleted": false,
    "hasActiveDietRequest": false
  },
  "autoFirstDiet": {
    "enabled": true,
    "requiresApproval": true,
    "templateAvailable": true
  },
  "nextStep": "/nutrition/membership/mindset/1"
}
```

If `mindsetCompleted` is `false`, the customer must answer the 5 supplementary questions before previewing or confirming the first diet request.

## Step 2: Show the Mindset Intro Screen

Before opening the questions, show a short screen or modal.

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

This endpoint returns all 5 questions.

Required UI behavior:

- Show the questions as a 5-step flow.
- Each question should show its answer choices as tappable options.
- When the user taps an option, save that answer locally and automatically move to the next question.
- Do not require a separate "Next" button after choosing an answer.
- Allow Back so the user can review/change the previous answer.
- Submit only after all 5 answers are collected.

Submit all answers together:

```http
POST /api/v1/app/membership/mindset
```

After success, refresh diet request options or go directly to the first diet confirmation route indicated by `nextStep`.

## Step 4: Decide Auto-First vs Manual Template

Call:

```http
GET /api/v1/app/nutrition/diet-requests/options
```

Use this logic:

```text
If flowType == first_diet
and requirements.mindsetCompleted == true
and autoFirstDiet.enabled == true
and autoFirstDiet.templateAvailable == true
and the AI mode is available
-> open the confirmation screen and preview with {"requestType":"ai"}.

Otherwise
-> show the normal manual diet type/template selection flow.
```

Important:

- Auto-first-diet is only for the first diet after package purchase.
- For the second diet and later, `flowType` becomes `follow_up`; the user must go through the follow-up questions and select the required mode/template manually.
- The app must still show a confirmation screen before final creation, even in auto-first-diet mode.

## Step 5: Preview the First Diet Request

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

When `autoFirstDiet.enabled` is true and a valid template exists for the customer goal/package, `nutritionDietTemplateId` is not required. The server resolves the template automatically and returns it in `data.request.dietTemplate`.

If the server returns a validation error for `nutritionDietTemplateId`, fall back silently to manual template selection.

For manual template selection:

```http
GET /api/v1/app/nutrition/diet-templates?goal=lose-weight
```

Use the customer's `dietGoal` as `goal` when available:

```text
lose-weight | gain-weight | maintain-weight
```

Then preview again with:

```json
{
  "requestType": "ai",
  "nutritionDietTemplateId": 12
}
```

Only a final leaf template without children should be sent as `nutritionDietTemplateId`.

## Step 6: Design the Confirmation Screen

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

## Step 7: Confirm the First Diet Request

When the customer taps the primary button, call:

```http
POST /api/v1/app/nutrition/diet-requests
```

Use the same payload that succeeded in preview.

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

## Step 8: Profile State While Prescribing

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
- The user should wait until the expert approves and publishes the diet.

Recommended profile card:

Title:

```text
Your diet is being prescribed
```

Description:

```text
After your diet is ready, you can view it from this section.
```

## Step 9: After Expert Approval / Publish

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

List diet templates for manual fallback:

```http
GET /api/v1/app/nutrition/diet-templates?goal=lose-weight
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
- The 5 mindset questions must auto-advance on answer tap; do not require a separate Next button after each selected option.
- If auto-first-diet is enabled and `templateAvailable` is true, Flutter should not require template selection.
- In auto-first-diet mode, send `{ "requestType": "ai" }` to both preview and confirm.
- The confirmation screen is required and must be driven by the preview response.
- If preview rejects missing `nutritionDietTemplateId`, fall back to manual template selection and call `GET /diet-templates` with the user's `dietGoal` in `goal`.
- Do not consume quota during preview.
- Quota is consumed only during final confirmation.
- After confirmation, always refresh profile and show the `prescribing` state.
- Once the expert publishes the prescription, the profile action becomes `view_current_diet`.
- For the second diet and later, do not use auto-first-diet. Use the follow-up flow and manual selection rules.
