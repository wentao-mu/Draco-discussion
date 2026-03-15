# Draco Discussion

This project is a discussion-oriented Draco demo built on top of `draco-vis`.

It turns the 2018 Draco paper into a live classroom interface:

- `studio` mode for running Draco examples
- `discussion` mode with staged questions and answer demos
- QR-code audience voting for live class participation
- local vote syncing between the host screen and phone audience page

## What It Is

This is not just the original `draco-vis` library demo anymore. It has been adapted into a small teaching tool for presenting the Draco paper in class.

The discussion flow is designed around:

- multiple discussion stages
- answer reveal with a matching Draco demo
- live audience voting from mobile devices

## Run Locally

Install dependencies:

```bash
yarn
```

Start the app:

```bash
yarn start
```

This starts:

- the web app on `http://localhost:1234`
- the local vote server on port `8787`

## How To Use

1. Open `http://localhost:1234`
2. Use `studio` to test Draco examples
3. Use `discussion` to present the paper
4. Let students scan the QR code to join the live poll
5. Reveal the answer and run the linked demo for each stage

## Main Files

- `demo/index.html`: app structure
- `demo/main.ts`: discussion flow, voting logic, Draco demo behavior
- `demo/styles.css`: UI styling
- `demo/vote-server.js`: local audience voting server

## Build

```bash
yarn build
```

## Notes

- Audience voting is designed for devices on the same local network.
- The project keeps the Draco solver in the browser and adds a lightweight local vote service for classroom use.
- The content is currently tailored to the Draco paper discussion workflow.
