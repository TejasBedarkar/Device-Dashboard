import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  accentColor?: string;
}

const Visualizer: React.FC<VisualizerProps> = ({ analyser, isActive, accentColor = '#ffffff' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!isActive) {
        return;
      }

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.min(centerX, centerY) - 5;

      ctx.beginPath();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;

      // Draw circular waveform
      for (let i = 0; i < bufferLength; i++) {
        const value = dataArray[i];
        const angle = (i / bufferLength) * Math.PI * 2;
        const amplitude = (value / 255) * 15; // Pulse amount
        
        const r = radius + amplitude;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.stroke();
      
      // Fill logic for pulse effect
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fill();
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyser, isActive, accentColor]);

  return (
    <canvas
      ref={canvasRef}
      width={100}
      height={100}
      style={{
          width: '100%', 
          height: '100%', 
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          borderRadius: '50%'
      }}
    />
  );
};

export default Visualizer;