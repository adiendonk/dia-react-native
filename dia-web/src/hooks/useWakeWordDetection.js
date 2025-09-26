import { useEffect, useRef } from 'react';

const useWakeWordDetection = (wakeWord, sensitivity, onDetected) => {
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const silenceTimeoutRef = useRef(null);
  const lastResultTimeRef = useRef(0);
  const isIntentionallyStoppedRef = useRef(false);

  // Initialize speech recognition for wake word detection
  const initWakeWordRecognition = () => {
    console.log('Initializing wake word recognition');
    console.log('window.SpeechRecognition:', window.SpeechRecognition);
    console.log('window.webkitSpeechRecognition:', window.webkitSpeechRecognition);
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    console.log('Selected SpeechRecognition:', SpeechRecognition);
    
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported');
      return null;
    }
    
    const recognition = new SpeechRecognition();
    console.log('Created recognition object:', recognition);
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    // Keep recognition in English for wake word detection
    recognition.lang = 'en-US'; // Always use English for wake word detection
    
    recognition.onresult = (event) => {
      console.log('Wake word recognition result event:', event);
      lastResultTimeRef.current = Date.now();
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        console.log('Wake word transcript:', transcript);
        
        // Check if wake word is in the transcript
        if (detectWakeWord(transcript, wakeWord)) {
          console.log('Wake word detected, calling onDetected callback');
          // Mark as intentionally stopped to prevent restart
          isIntentionallyStoppedRef.current = true;
          // Stop recognition before calling onDetected to prevent conflicts
          try {
            recognitionRef.current.stop();
          } catch (err) {
            console.warn('Error stopping recognition before onDetected:', err);
          }
          // Call onDetected after a small delay to ensure recognition is fully stopped
          setTimeout(() => {
            onDetected();
          }, 100);
          break;
        }
      }
      
      // Restart recognition to continue listening only if still listening and not intentionally stopped
      if (isListeningRef.current && !isIntentionallyStoppedRef.current) {
        console.log('Restarting wake word recognition');
        restartRecognition();
      }
    };
    
    recognition.onerror = (event) => {
      console.error('Wake word recognition error:', event.error);
      
      // Try to restart on error
      if (isListeningRef.current) {
        setTimeout(() => {
          if (isListeningRef.current) {
            restartRecognition();
          }
        }, 1000);
      }
    };
    
    recognition.onend = () => {
      console.log('Wake word recognition ended');
      // If intentionally stopped, don't restart
      if (isIntentionallyStoppedRef.current) {
        console.log('Wake word recognition intentionally stopped, not restarting');
        isIntentionallyStoppedRef.current = false; // Reset the flag
        return;
      }
      // Restart recognition if still listening
      if (isListeningRef.current) {
        console.log('Restarting wake word recognition on end');
        restartRecognition();
      }
    };
    
    return recognition;
  };

  // Simple wake word detection algorithm with sensitivity
  const detectWakeWord = (transcript, wakeWord) => {
    console.log('Detecting wake word:', transcript, wakeWord);
    if (!transcript || !wakeWord) return false;
    
    // Convert to lowercase for comparison
    const lowerTranscript = transcript.toLowerCase().trim();
    const lowerWakeWord = wakeWord.toLowerCase().trim();
    
    console.log('Lowercase comparison:', lowerTranscript, lowerWakeWord);
    
    // Check if wake word is in the transcript (not just at the beginning)
    const isMatch = lowerTranscript.includes(lowerWakeWord);
    
    console.log('Wake word match result:', isMatch);
    
    // Apply sensitivity - for now we'll just return the match
    // In a more advanced implementation, we could use confidence scores
    return isMatch;
  };

  // Restart recognition with a delay to prevent rapid restarts
  const restartRecognition = () => {
    if (!recognitionRef.current) return;
    
    try {
      recognitionRef.current.stop();
    } catch (err) {
      console.warn('Error stopping recognition:', err);
    }
    
    // Add a small delay before restarting
    setTimeout(() => {
      // Check if we should still restart (not intentionally stopped)
      if (isListeningRef.current && recognitionRef.current && !isIntentionallyStoppedRef.current) {
        try {
          console.log('Restarting wake word recognition');
          // Check if recognition is already started
          recognitionRef.current.start();
          console.log('Wake word recognition restarted successfully');
        } catch (err) {
          // Don't log the error if it's an InvalidStateError (already started)
          if (err.name !== 'InvalidStateError') {
            console.error('Error restarting wake word recognition:', err);
          } else {
            console.log('Wake word recognition already started, skipping restart');
          }
        }
      }
    }, 500); // Increased delay to 500ms
  };

  // Start wake word detection
  const startDetection = async () => {
    console.log('Starting wake word detection');
    
    isListeningRef.current = true;
    isIntentionallyStoppedRef.current = false; // Reset the flag when starting
    
    // Initialize recognition if needed
    if (!recognitionRef.current) {
      console.log('Initializing wake word recognition');
      recognitionRef.current = initWakeWordRecognition();
    }
    
    // Start recognition
    if (recognitionRef.current) {
      try {
        console.log('Attempting to start wake word recognition');
        recognitionRef.current.start();
        console.log('Wake word recognition started successfully');
      } catch (err) {
        console.error('Error starting wake word recognition:', err);
        // Check if it's a permission error
        if (err.name === 'NotAllowedError') {
          console.error('Microphone permission denied');
        }
      }
    }
  };

  // Stop wake word detection
  const stopDetection = () => {
    console.log('Stopping wake word detection');
    isListeningRef.current = false;
    isIntentionallyStoppedRef.current = true;
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        console.log('Wake word recognition stopped');
      } catch (err) {
        console.warn('Error stopping recognition:', err);
      }
    }
    
    // Clear any timeouts
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection();
    };
  }, []);

  return {
    startDetection,
    stopDetection,
    isListening: isListeningRef.current
  };
};

export default useWakeWordDetection;