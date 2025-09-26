# Dia - Voice Command App

The name "Dia" is taken from the Arabic word ضِيَاء (read: Ḍiyā'), which means Rays, bright light, brilliance.

A mobile-first React.js application that implements voice command functionality with a customizable wake-up word detection system.

## Features

- Continuous listening for customizable wake-up word
- Speech-to-text conversion in real-time
- Visual feedback during listening and processing states
- Customizable settings (wake-up word, sensitivity, language)
- Command history with local storage persistence
- Responsive design for mobile and desktop
- Error handling for speech recognition failures

## How to Use

1. Click "Start Listening" to begin listening for the wake-up word
2. Say the wake-up word (default: "hey assistant") to activate voice recognition
3. Speak your command after the wake-up word is detected
4. View the transcribed command in the display area
5. Access command history in the history section
6. Customize settings using the gear icon

## Settings

- **Wake Word**: The word that activates voice recognition (default: "hey assistant")
- **Sensitivity Level**: Adjust the sensitivity of wake word detection (0.1-1.0)
- **Language**: Select the language for speech recognition

## Technical Implementation

This application uses the Web Speech API for speech recognition. The wake-up word detection works by continuously listening for speech and checking if the transcript starts with the configured wake word.

## Browser Support

This application requires a browser that supports the Web Speech API:
- Google Chrome (recommended)
- Microsoft Edge
- Other Chromium-based browsers

Note: Speech recognition may not work in all browsers or over insecure connections (HTTP).

## Installation

1. Clone the repository
2. Run `npm install` to install dependencies
3. Run `npm start` to start the development server
4. Open http://localhost:3000 in your browser

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.
Open http://localhost:3000 to view it in your browser.

The page will reload when you make changes.
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.

### `npm run build`

Builds the app for production to the `build` folder.
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.
Your app is ready to be deployed!

## Learn More

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).