import React, { useEffect, useRef } from 'react';
import './VoiceVisualizer.css';

const VoiceVisualizer = ({ isListening, isProcessing }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    if (!isListening && !isProcessing) {
      // Draw microphone icon when not listening
      drawMicrophone(ctx, width, height);
      return;
    }
    
    // Draw visualization when listening or processing
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Draw circular background
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, Math.min(width, height) / 2 - 10, 0, Math.PI * 2);
      
      // Different background color for processing state
      if (isProcessing) {
        ctx.fillStyle = 'rgba(46, 204, 113, 0.1)'; // Green for processing
      } else {
        ctx.fillStyle = 'rgba(74, 144, 226, 0.1)'; // Blue for listening
      }
      ctx.fill();
      
      // Draw animated bars
      const barCount = 20;
      const barWidth = (Math.PI * 2) / barCount;
      const radius = Math.min(width, height) / 2 - 20;
      
      for (let i = 0; i < barCount; i++) {
        const angle = i * barWidth;
        // Different bar height for processing state
        const barHeight = isProcessing ? 20 + Math.random() * 30 : 10 + Math.random() * 40;
        
        ctx.beginPath();
        const x1 = width / 2 + Math.cos(angle) * radius;
        const y1 = height / 2 + Math.sin(angle) * radius;
        const x2 = width / 2 + Math.cos(angle) * (radius + barHeight);
        const y2 = height / 2 + Math.sin(angle) * (radius + barHeight);
        
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        
        // Different color for processing state
        if (isProcessing) {
          ctx.strokeStyle = `rgba(46, 204, 113, ${0.5 + Math.random() * 0.5})`; // Green for processing
        } else {
          ctx.strokeStyle = `rgba(74, 144, 226, ${0.5 + Math.random() * 0.5})`; // Blue for listening
        }
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      
      animationRef.current = requestAnimationFrame(draw);
    };
    
    draw();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isListening, isProcessing]);
  
  const drawMicrophone = (ctx, width, height) => {
    // Draw microphone stand
    ctx.beginPath();
    ctx.moveTo(width / 2, height / 2 + 20);
    ctx.lineTo(width / 2, height / 2 + 40);
    ctx.strokeStyle = '#4a90e2';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Draw microphone head
    ctx.beginPath();
    ctx.arc(width / 2, height / 2 - 10, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#4a90e2';
    ctx.fill();
    
    // Draw microphone grille
    ctx.beginPath();
    ctx.arc(width / 2, height / 2 - 10, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  };

  return (
    <div className="voice-visualizer">
      <canvas
        ref={canvasRef}
        width="200"
        height="200"
        className="visualizer-canvas"
      />
    </div>
  );
};

export default VoiceVisualizer;