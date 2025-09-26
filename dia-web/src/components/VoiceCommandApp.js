import React, { useState, useEffect, useRef, useCallback } from 'react';
import useWakeWordDetection from '../hooks/useWakeWordDetection';
import SettingsPanel from './SettingsPanel';
import CommandHistory from './CommandHistory';
import VoiceVisualizer from './VoiceVisualizer';
import './VoiceCommandApp.css';

const VoiceCommandApp = () => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [commandHistory, setCommandHistory] = useState([]);
  const [assistantResponses, setAssistantResponses] = useState([]);
  const [settings, setSettings] = useState({
    wakeWord: 'hey',
    sensitivity: 0.7,
    language: 'id-ID',
    useWakeWord: false,
    websocketUrl: 'wss://openrouter-websocket-proxy-production.adhie-arysanto.workers.dev'
  });
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isWakeWordDetected, setIsWakeWordDetected] = useState(false);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  const recognitionRef = useRef(null);
  const wakeWordTimeoutRef = useRef(null);
  const mainRecognitionTimeoutRef = useRef(null);
  const websocketRef = useRef(null);
  const speechSynthesisRef = useRef(null);
  const isSpeakingRef = useRef(false);
  const commandHistoryRef = useRef(commandHistory);
  const assistantResponsesRef = useRef(assistantResponses);
  const stopWakeWordDetectionRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Load settings and command history from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('voiceCommandSettings');
    const savedHistory = localStorage.getItem('voiceCommandHistory');
    const savedResponses = localStorage.getItem('voiceCommandResponses');
    
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
    
    if (savedHistory) {
      const history = JSON.parse(savedHistory);
      // Convert any Date objects to timestamps for consistent sorting
      const normalizedHistory = history.map(item => ({
        ...item,
        timestamp: item.timestamp instanceof Date ? item.timestamp.getTime() : item.timestamp
      }));
      setCommandHistory(normalizedHistory);
      commandHistoryRef.current = normalizedHistory;
    }
    
    if (savedResponses) {
      const responses = JSON.parse(savedResponses);
      // Convert any Date objects to timestamps for consistent sorting
      const normalizedResponses = responses.map(item => ({
        ...item,
        timestamp: item.timestamp instanceof Date ? item.timestamp.getTime() : item.timestamp
      }));
      setAssistantResponses(normalizedResponses);
      assistantResponsesRef.current = normalizedResponses;
    }
  }, []);


  // Save settings and command history to localStorage
  useEffect(() => {
    localStorage.setItem('voiceCommandSettings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('voiceCommandHistory', JSON.stringify(commandHistory));
  }, [commandHistory]);

  useEffect(() => {
    localStorage.setItem('voiceCommandResponses', JSON.stringify(assistantResponses));
  }, [assistantResponses]);

  // Wake word detection callback
  const onWakeWordDetected = () => {
    console.log('Wake word detected callback called');
    setIsWakeWordDetected(true);
    // Start main speech recognition
    console.log('Calling startMainRecognition');
    startMainRecognition();
    
    // Reset wake word detection after a timeout
    if (wakeWordTimeoutRef.current) {
      clearTimeout(wakeWordTimeoutRef.current);
    }
    
    wakeWordTimeoutRef.current = setTimeout(() => {
      setIsWakeWordDetected(false);
    }, 5000); // Reset after 5 seconds
  };

  // Initialize wake word detection
  const { startDetection: startWakeWordDetection, stopDetection: stopWakeWordDetection } = useWakeWordDetection(
    settings.wakeWord,
    settings.sensitivity,
    onWakeWordDetected
  );

  // Update stopWakeWordDetection ref when it changes
  useEffect(() => {
    stopWakeWordDetectionRef.current = stopWakeWordDetection;
  }, [stopWakeWordDetection]);

  // Initialize main speech recognition
  useEffect(() => {
    sleep(5000);
    console.log('Initializing main speech recognition');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('Speech recognition is not supported in this browser');
      setError('Speech recognition is not supported in your browser. Please try Chrome or Edge.');
      return;
    }
    
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true; // Keep listening
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = settings.language;
    
    recognitionRef.current.onresult = (event) => {
      // Ignore recognition results while the assistant is speaking to avoid self-listening
      // Use ref for immediate check to avoid race conditions with state updates
      if (isSpeakingRef.current) {
        console.log('Ignoring recognition during speech output');
        return;
      }
      
      console.log('Main recognition result:', event);
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        console.log('Transcript result:', transcript, 'isFinal:', event.results[i].isFinal);
        if (event.results[i].isFinal) {
          // Only process non-empty transcripts with minimum length to avoid unnecessary API calls
          const trimmedTranscript = transcript.trim();
          if (trimmedTranscript.length >= 3) { // Minimum 3 characters to avoid noise and short phrases
            setTranscript(trimmedTranscript);
            // Add to command history and update ref
            const newCommand = { id: Date.now(), command: trimmedTranscript, timestamp: Date.now(), role: 'user' };
            setCommandHistory(prev => {
              const updatedCommandHistory = [newCommand, ...prev.slice(0, 99)]; // Keep only last 100 commands
              commandHistoryRef.current = updatedCommandHistory;
              console.log('Updated command history:', updatedCommandHistory);
              return updatedCommandHistory;
            });
            
            // Send to WebSocket API with chat history context
            sendToWebSocketAPI(trimmedTranscript);
          } else {
            // If transcript is too short, just clear it without sending to API
            setTranscript('');
            console.log('Ignored short transcript:', trimmedTranscript);
          }
          
          // Completely stop listening to prevent any self-listening
          setIsListening(false);

          setIsProcessing(false);
          // Keep recognition running continuously without timeout
          // Reset any existing timeout to prevent automatic stopping
          if (mainRecognitionTimeoutRef.current) {
            clearTimeout(mainRecognitionTimeoutRef.current);
            mainRecognitionTimeoutRef.current = null;
          }
        } else {
          interimTranscript += transcript;
        }
      }
      if (interimTranscript) {
        setTranscript(interimTranscript);
      }
      
      // Reset the timeout since we got speech input
      if (mainRecognitionTimeoutRef.current) {
        clearTimeout(mainRecognitionTimeoutRef.current);
      }
      
      // No timeout set for continuous listening - recognition will keep running
      // until explicitly stopped by the user or an error occurs
    };
    
    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      console.log(`Additional information: ${event.message}`);
      let errorMessage = `Speech recognition error: ${event.error}`;
      
      // Provide more specific error messages
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech was detected. Please try again.';
          break;
        case 'audio-capture':
          errorMessage = 'Audio capture failed. Please check your microphone.';
          break;
        case 'not-allowed':
          errorMessage = 'Permission to use microphone was denied. Please allow microphone access.';
          break;
        case 'service-not-allowed':
          errorMessage = 'Speech service not allowed. Please check your browser settings.';
          break;
        case 'bad-grammar':
          errorMessage = 'Grammar error. Please try rephrasing.';
          break;
        case 'language-not-supported':
          errorMessage = 'Selected language is not supported.';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }
      
      setError(errorMessage);
      setIsProcessing(false);
    };
    
    recognitionRef.current.onend = () => {
      console.log('Main recognition ended');
      setIsProcessing(false);
      // Reset wake word detection state
      if (isWakeWordDetected) {
        setIsWakeWordDetected(false);
      }
    };
    
    recognitionRef.current.onstart = () => {
      console.log('Main recognition started');
    };
    
    recognitionRef.current.onspeechstart = () => {
      console.log('Speech detected by main recognition');
    };
    
    recognitionRef.current.onspeechend = () => {
      console.log('Speech ended for main recognition');
    };
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (wakeWordTimeoutRef.current) {
        clearTimeout(wakeWordTimeoutRef.current);
      }
      if (mainRecognitionTimeoutRef.current) {
        clearTimeout(mainRecognitionTimeoutRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [settings.language, isWakeWordDetected]);

  // Update recognition language when settings change
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = settings.language;
    }
  }, [settings.language]);

  // Start main speech recognition
  const startMainRecognition = useCallback(() => {
    console.log('Starting main speech recognition');
    
    // Interrupt any ongoing speech when user starts talking
    if (isSpeaking) {
      console.log('Interrupting ongoing speech');
      if (speechSynthesisRef.current) {
        speechSynthesis.cancel();
        setIsSpeaking(false);
      }
    }
    
    if (!recognitionRef.current) {
      console.error('Speech recognition is not initialized');
      setError('Speech recognition is not initialized');
      return;
    }
    
    try {
      console.log('Attempting to start recognition');
      setIsProcessing(true);
      setTranscript('');
      recognitionRef.current.start();
      setError('');
      console.log('Recognition started successfully');
      
      // Set a timeout to stop recognition after 30 seconds of inactivity for continuous listening
      if (mainRecognitionTimeoutRef.current) {
        clearTimeout(mainRecognitionTimeoutRef.current);
      }
      
      // No timeout set for continuous listening - recognition will keep running
      // until explicitly stopped by the user or an error occurs
    } catch (err) {
      console.error('Error starting speech recognition', err);
      setError('Failed to start speech recognition. Please check your microphone permissions.');
      setIsProcessing(false);
    }
  }, [isSpeaking]);

  // Start listening for wake word or directly start main recognition
  const startListening = useCallback(() => {
    console.log('Start listening button clicked');
    console.log('Checking for SpeechRecognition API availability');
    console.log('window.SpeechRecognition:', window.SpeechRecognition);
    console.log('window.webkitSpeechRecognition:', window.webkitSpeechRecognition);
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    console.log('Selected SpeechRecognition:', SpeechRecognition);
    
    // If wake word detection is disabled, start main recognition directly
    if (!settings.useWakeWord) {
      console.log('Wake word detection disabled, starting main recognition directly');
      try {
        // Check for microphone permissions
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          console.log('Requesting microphone permissions');
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
              // Microphone access granted
              console.log('Microphone access granted');
              // Stop the stream as we don't need it right now
              stream.getTracks().forEach(track => track.stop());
              // Start main recognition directly
              console.log('Calling startMainRecognition directly');
              startMainRecognition();
              setIsListening(true);
              setError('');
              console.log('Main recognition started directly');
            })
            .catch(err => {
              console.error('Microphone access denied:', err);
              setError('Microphone access denied. Please allow microphone permissions in your browser settings.');
            });
        } else {
          console.warn('MediaDevices API not supported');
          // Try to start main recognition anyway
          console.log('MediaDevices API not supported, calling startMainRecognition directly');
          startMainRecognition();
          setIsListening(true);
          setError('');
          console.log('Main recognition started directly (no MediaDevices support check)');
        }
      } catch (err) {
        console.error('Error starting main recognition', err);
        setError('Failed to start speech recognition. Please check your microphone permissions.');
      }
      return;
    }
    
    // If wake word detection is enabled, start wake word detection
    try {
      // Check for microphone permissions
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        console.log('Requesting microphone permissions');
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(stream => {
            // Microphone access granted
            console.log('Microphone access granted');
            // Stop the stream as we don't need it right now
            stream.getTracks().forEach(track => track.stop());
            console.log('Calling startWakeWordDetection');
            startWakeWordDetection();
            setIsListening(true);
            setError('');
            console.log('Listening started');
          })
          .catch(err => {
            console.error('Microphone access denied:', err);
            setError('Microphone access denied. Please allow microphone permissions in your browser settings.');
          });
      } else {
        console.warn('MediaDevices API not supported');
        // Try to start anyway
        console.log('MediaDevices API not supported, calling startWakeWordDetection directly');
        startWakeWordDetection();
        setIsListening(true);
        setError('');
        console.log('Listening started (no MediaDevices support check)');
      }
    } catch (err) {
      console.error('Error starting wake word detection', err);
      setError('Failed to start wake word detection. Please check your microphone permissions.');
    }
  }, [settings.useWakeWord, startMainRecognition, startWakeWordDetection]);

  // Stop listening
  const stopListening = () => {
    stopWakeWordDetection();
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setIsProcessing(false);
    setIsWakeWordDetected(false);
    setTranscript('');
    
    // Also stop any ongoing speech when stopping listening
    if (isSpeaking) {
      if (speechSynthesisRef.current) {
        speechSynthesis.cancel();
        setIsSpeaking(false);
        isSpeakingRef.current = false;
      }
    }
    
    if (wakeWordTimeoutRef.current) {
      clearTimeout(wakeWordTimeoutRef.current);
    }
    if (mainRecognitionTimeoutRef.current) {
      clearTimeout(mainRecognitionTimeoutRef.current);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };


  const updateSettings = (newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  // Text-to-speech function
  const speakText = useCallback((text) => {
    if (!text || typeof speechSynthesis === 'undefined') {
      console.warn('Speech synthesis not supported or no text provided');
      // Reset speaking flags if speech fails
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      return;
    }
    
    // Process text for TTS before speaking
    const processedText = processForTTS(text);
    console.log('Original text:', text);
    console.log('TTS processed text:', processedText);

    // Stop any ongoing speech
    if (speechSynthesisRef.current) {
      speechSynthesis.cancel();
    }
    
    const utterance = new SpeechSynthesisUtterance(processedText);
    utterance.lang = settings.language; // Use the same language as speech recognition
    
    utterance.onend = () => {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      speechSynthesisRef.current = null;
      
      // Restart listening automatically after speech completes
      console.log('Speech completed. Restarting listening...');
      startListening();
    };
    
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      speechSynthesisRef.current = null;
      
      // Restart listening even on error
      console.log('Speech error. Restarting listening...');
      startListening();
    };
    
    speechSynthesisRef.current = utterance;
    speechSynthesis.speak(utterance);
  }, [settings.language, startListening]);

  // WebSocket connection and message sending
  const connectWebSocket = useCallback(() => {
    console.log('Attempting to connect to WebSocket at:', settings.websocketUrl);
    try {
      if (websocketRef.current) {
        console.log('Closing existing WebSocket connection');
        websocketRef.current.close();
      }
      
      const websocket = new WebSocket(settings.websocketUrl);
      websocketRef.current = websocket;
      
      websocket.onopen = () => {
        setIsWebSocketConnected(true);
        console.log('WebSocket connection established successfully');
        setError('');
      };
      
      websocket.onmessage = (event) => {
        console.log('WebSocket message received:', event.data);
        // Set speaking flags immediately to ignore any recognition results
        setIsSpeaking(true);
        isSpeakingRef.current = true;

        // Stop recognition immediately to prevent self-listening
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }

        // Also stop wake word detection if active
        stopWakeWordDetectionRef.current();

        try {
          const response = JSON.parse(event.data);
          console.log('Received response from API:', response);
          
          // Extract the assistant's response
          if (response.choices && response.choices[0] && response.choices[0].message) {
            const assistantMessage = response.choices[0].message.content;
            const newResponse = {
              id: Date.now(),
              response: assistantMessage,
              timestamp: Date.now(),
              role: 'assistant'
            };
            
            setAssistantResponses(prev => {
              const updatedResponses = [newResponse, ...prev.slice(0, 99)];
              assistantResponsesRef.current = updatedResponses;
              console.log('Updated assistant responses:', updatedResponses);
              return updatedResponses;
            });
            setTranscript(assistantMessage); // Show assistant response in transcript
            
            // Completely stop listening to prevent any self-listening
            setIsListening(false);
            
            // Speak the response
            speakText(assistantMessage);
          }
        } catch (error) {
          console.error('Error parsing WebSocket response:', error);
          setError('Failed to parse API response');
          // Reset speaking flags on error
          setIsSpeaking(false);
          isSpeakingRef.current = false;
        }
      };
      
      websocket.onerror = (error) => {
        console.error('WebSocket error details:', error);
        console.error('WebSocket error type:', error.type);
        console.error('WebSocket error target:', error.target);
        console.error('WebSocket readyState:', websocket.readyState);
        console.error('WebSocket URL:', settings.websocketUrl);
        console.error('WebSocket bufferedAmount:', websocket.bufferedAmount);
        
        // Log additional error properties if available
        if (error.target) {
          console.error('Error target URL:', error.target.url);
          console.error('Error target readyState:', error.target.readyState);
        }
        
        let errorMessage = 'WebSocket connection error';
        if (websocket.readyState === 3) { // CLOSED
          errorMessage = 'Failed to connect to WebSocket server. Please check:';
          errorMessage += '\n1. The server is running and accessible';
          errorMessage += '\n2. Your network connection';
          errorMessage += '\n3. The WebSocket URL is correct';
          errorMessage += '\n4. CORS settings on the server';
        }
        
        setError(errorMessage);
        setIsWebSocketConnected(false);
      };
      
      websocket.onclose = (event) => {
        console.log('WebSocket connection closed', event);
        console.log('Close code:', event.code);
        console.log('Close reason:', event.reason);
        setIsWebSocketConnected(false);
        
        // Clear any existing reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        // Reconnect only on abnormal closures (code 1006) with exponential backoff
        if (event.code === 1006) {
          const attempts = reconnectAttempts + 1;
          setReconnectAttempts(attempts);
          
          // Calculate delay with exponential backoff (max 30 seconds)
          const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
          console.log(`Abnormal closure detected. Reconnect attempt ${attempts} in ${delay}ms...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Reconnecting WebSocket...');
            connectWebSocket();
          }, delay);
        } else {
          // Reset reconnect attempts on normal closures
          setReconnectAttempts(0);
        }
      };
      
      return websocket;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setError('Failed to connect to API');
      return null;
    }
  }, [settings.websocketUrl, speakText]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendToWebSocketAPI = (userMessage) => {
    console.log('Checking WebSocket connection state before sending message');
    console.log('WebSocket ref exists:', !!websocketRef.current);
    if (websocketRef.current) {
      console.log('WebSocket readyState:', websocketRef.current.readyState);
      console.log('WebSocket OPEN state:', WebSocket.OPEN);
    }
    
    // If WebSocket is connecting (readyState 0), wait for it to open or reconnect
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket is still connecting. Waiting for connection to open...');
      const checkConnection = () => {
        if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
          console.log('WebSocket connection now open, sending message');
          actuallySendMessage(userMessage);
        } else if (websocketRef.current && websocketRef.current.readyState === WebSocket.CONNECTING) {
          // Still connecting, check again after a short delay
          setTimeout(checkConnection, 100);
        } else {
          console.error('WebSocket failed to connect or closed during wait');
          setError('WebSocket connection failed. Please try again.');
        }
      };
      checkConnection();
      return;
    }
    
    if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected or not in OPEN state. Current state:', websocketRef.current ? websocketRef.current.readyState : 'no websocket');
      setError('WebSocket not connected. Please check API settings.');
      // Attempt to reconnect if not already connected
      if (!websocketRef.current || websocketRef.current.readyState === WebSocket.CLOSED) {
        console.log('Attempting to reconnect WebSocket...');
        connectWebSocket();
        // Queue the message to send after reconnection
        setTimeout(() => sendToWebSocketAPI(userMessage), 1000);
      }
      return;
    }

    actuallySendMessage(userMessage);
  };

  const actuallySendMessage = (userMessage) => {
    // Use refs to get the latest state values
    const currentCommandHistory = commandHistoryRef.current;
    const currentAssistantResponses = assistantResponsesRef.current;

    console.log('Current command history:', currentCommandHistory);
    console.log('Current assistant responses:', currentAssistantResponses);
    console.log('Command history length:', currentCommandHistory.length);
    console.log('Assistant responses length:', currentAssistantResponses.length);

    // Combine user commands and assistant responses for full conversation history
    const allMessages = [...currentCommandHistory, ...currentAssistantResponses];
    console.log('All messages before sort:', allMessages);
    
    // Sort by timestamp ascending (oldest first) - ensure numeric timestamps
    allMessages.sort((a, b) => a.timestamp - b.timestamp);
    console.log('All messages after sort:', allMessages);
    
    // Get the last 5 messages (most recent), but exclude the current message if it's already in history
    // Since the current message was just added to history, we need to filter it out to avoid duplication
    const recentMessages = allMessages.slice(-5);
    console.log('Recent messages (last 5):', recentMessages);
    
    // Map to the required format, and ensure we don't include the current message twice
    const lastFiveMessages = recentMessages.map(msg => ({
      role: msg.role,
      content: msg.role === 'user' ? msg.command : msg.response
    }));

    // Filter out any message that is exactly the current userMessage to avoid duplication
    // This is a safety check since the current message might be in history
    const filteredMessages = lastFiveMessages.filter(msg =>
      !(msg.role === 'user' && msg.content === userMessage)
    );

    // Add current message
    const messages = [
      ...filteredMessages,
      { role: 'user', content: userMessage }
    ];

    const messageData = {
      messages: messages
    };

    try {
      console.log('Attempting to send message to WebSocket API:', messageData);
      websocketRef.current.send(JSON.stringify(messageData));
      console.log('Message sent to WebSocket API successfully');
      setError('');
    } catch (error) {
      console.error('Error sending to WebSocket API:', error);
      setError('Failed to send message to API');
    }
  };

  // Initialize WebSocket connection on component mount only
  useEffect(() => {
    console.log('WebSocket useEffect triggered - connecting to WebSocket');
    // Add a small delay to ensure component is fully mounted
    const connectTimeout = setTimeout(() => {
      connectWebSocket();
    }, 100);
    
    return () => {
      console.log('WebSocket cleanup - closing connection');
      clearTimeout(connectTimeout);
      if (websocketRef.current) {
        websocketRef.current.close();
        websocketRef.current = null;
      }
    };
  }, []); // Empty dependency array to run only on mount

  // Process text for TTS friendliness
  const processForTTS = (text) => {
    if (!text) return '';
    
    let processedText = text;
    
    // Remove markdown formatting
    processedText = processedText
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1')      // Remove italic
      .replace(/`(.*?)`/g, '$1')       // Remove inline code
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links, keep text
      .replace(/#{1,6}\s?/g, '')       // Remove headers
      .replace(/\n{2,}/g, '\n\n')      // Normalize line breaks
      .replace(/```[\s\S]*?```/g, '')  // Remove code blocks
      .replace(/~~(.*?)~~/g, '$1');     // Remove strikethrough
    
    // Convert common abbreviations to full words for better TTS
    processedText = processedText
      .replace(/\b(e\.g\.)\b/gi, 'for example')
      .replace(/\b(i\.e\.)\b/gi, 'that is')
      .replace(/\b(vs\.)\b/gi, 'versus')
      .replace(/\b(etc\.)\b/gi, 'and so on')
      .replace(/\b(approx\.)\b/gi, 'approximately')
      .replace(/\b(no\.)\b/gi, 'number')
      .replace(/\b(Dr\.)\b/gi, 'Doctor')
      .replace(/\b(Mr\.)\b/gi, 'Mister')
      .replace(/\b(Mrs\.)\b/gi, 'Missus')
      .replace(/\b(Ms\.)\b/gi, 'Miss');
    
    // Simplify punctuation for better TTS flow
    processedText = processedText
      .replace(/\.{2,}/g, '.')         // Reduce multiple dots to single
      .replace(/!{2,}/g, '!')          // Reduce multiple exclamations
      .replace(/\?{2,}/g, '?')         // Reduce multiple questions
      .replace(/[,;:]{2,}/g, ',')      // Reduce multiple punctuation
      .replace(/\s+\./g, '. ')          // Ensure space after periods
      .replace(/\s+\?/g, '? ')          // Ensure space after questions
      .replace(/\s+!/g, '! ')           // Ensure space after exclamations
      .replace(/\s+,/g, ', ')           // Ensure space after commas
      .replace(/\s+;/g, '; ')           // Ensure space after semicolons
      .replace(/\s+:/g, ': ');          // Ensure space after colons
    
    // Remove excessive whitespace
    processedText = processedText
      .replace(/\s+/g, ' ')
      .trim();
    
    return processedText;
  };


  // Clean up speech synthesis on component unmount
  useEffect(() => {
    return () => {
      if (speechSynthesisRef.current) {
        speechSynthesis.cancel();
      }
    };
  }, []);

  return (
    <div className="voice-command-app">
      <header className="app-header">
        <h1>Voice Command Assistant</h1>
        <button
          className="settings-toggle"
          onClick={() => setShowSettings(!showSettings)}
          aria-label={showSettings ? "Close settings" : "Open settings"}
        >
          ⚙️
        </button>
      </header>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onUpdateSettings={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      <main className="app-main">
        <div className="status-indicators">
          <div className={`indicator ${isListening ? 'active' : ''}`}>
            <span className="indicator-label">Listening</span>
          </div>
          <div className={`indicator ${isProcessing ? 'active' : ''}`}>
            <span className="indicator-label">Processing</span>
          </div>
          <div className={`indicator ${isWakeWordDetected ? 'active' : ''}`}>
            <span className="indicator-label">Wake Word</span>
          </div>
          <div className={`indicator ${isWebSocketConnected ? 'active' : ''}`}>
            <span className="indicator-label">API Connected</span>
          </div>
          <div className={`indicator ${isSpeaking ? 'active' : ''}`}>
            <span className="indicator-label">Speaking</span>
          </div>
        </div>

        <VoiceVisualizer isListening={isListening || isWakeWordDetected} isProcessing={isProcessing} />

        <div className="transcript-container">
          <div className="transcript-box">
            {transcript || (isListening ?
              (settings.useWakeWord ? "Listening for wake word..." : "Listening... Speak now") :
              "Press Start Listening to begin")}
          </div>
        </div>

        <div className="control-panel">
          <button
            className={`listen-button ${isListening ? 'listening' : ''}`}
            onClick={toggleListening}
          >
            {isListening ? 'Stop Listening' : 'Start Listening'}
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <CommandHistory
          history={[...commandHistory, ...assistantResponses].sort((a, b) => b.timestamp - a.timestamp)}
          onClearHistory={() => {
            setCommandHistory([]);
            setAssistantResponses([]);
          }}
        />
      </main>
    </div>
  );
};

export default VoiceCommandApp;