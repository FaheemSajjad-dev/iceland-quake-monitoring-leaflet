import React, { useEffect, useRef } from 'react';

const CrossSectionView = ({ earthquake, visible, maxDepth = 30 }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  
  useEffect(() => {
    if (!visible || !earthquake || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Animation variables
    let animationPhase = 0;
    
    // Clear any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    // Draw the cross-section
    const drawCrossSection = () => {
      // Clear the canvas
      ctx.clearRect(0, 0, width, height);
      
      // Constants for positioning
      const surfaceY = height * 0.20; // Position of the surface
      const margin = 40; // Left margin for depth labels, increased for more space
      
      // ======== BACKGROUND ========
      // Draw sky gradient
      const skyGradient = ctx.createLinearGradient(0, 0, 0, surfaceY);
      skyGradient.addColorStop(0, '#87CEEB'); // Sky blue
      skyGradient.addColorStop(1, '#B0E0E6'); // Powder blue
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, width, surfaceY);
      
      // ======== EARTH LAYERS ========
      // Draw ground background - gradient from green to darker colors with depth
      const groundGradient = ctx.createLinearGradient(0, surfaceY, 0, height);
      groundGradient.addColorStop(0, '#3A5F39');     // Forest green for surface
      groundGradient.addColorStop(0.2, '#2F4F2F');   // Darker green
      groundGradient.addColorStop(0.4, '#2D4F3F');   // Green-blue transition
      groundGradient.addColorStop(0.6, '#2D3F4F');   // Blue-green
      groundGradient.addColorStop(0.8, '#2D2D3F');   // Dark blue-purple
      groundGradient.addColorStop(1, '#331F1F');     // Dark red-brown (deep crust)
      
      ctx.fillStyle = groundGradient;
      ctx.fillRect(0, surfaceY, width, height - surfaceY);
      
      // ======== SURFACE DETAILS ========
      // Draw the surface line - REMOVED the uneven surface line that was causing shaking
      // Just draw a straight line now
      ctx.beginPath();
      ctx.moveTo(0, surfaceY);
      ctx.lineTo(width, surfaceY);
      ctx.strokeStyle = '#2D4F2F';
      ctx.lineWidth = 1; // Reduced line width to make it less prominent
      ctx.stroke();
      
      // ======== DEPTH MARKERS AND GRID ========
      // Draw horizontal depth lines and labels
      ctx.font = '12px Arial'; // Slightly larger font
      ctx.fillStyle = 'white';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      
      // Depth markers to show (removed 30 km)
      const depthMarkers = [0, 5, 10, 15, 20, 25];
      
      depthMarkers.forEach(depth => {
        if (depth > maxDepth) return;
        
        const y = surfaceY + (depth / maxDepth) * (height - surfaceY);
        
        // Grid line
        ctx.beginPath();
        ctx.moveTo(margin, y);
        ctx.lineTo(width, y);
        ctx.strokeStyle = `rgba(255, 255, 255, ${depth === 0 ? 0.4 : 0.2})`;
        ctx.lineWidth = depth === 0 ? 1.5 : 1;
        ctx.stroke();
        
        // Depth label
        const text = `${depth} km`;
        ctx.fillStyle = 'white';
        ctx.fillText(text, margin - 4, y);
      });
      
      // ======== EARTHQUAKE VISUALIZATION ========
      if (earthquake) {
        const rawDepth = parseFloat(earthquake.Depth);
        // cap any depth >25 km to 25 km for the cross‑section
        const displayDepth = Math.min(rawDepth, 25);
        const magnitude   = parseFloat(earthquake.Mw_mean);
        
        // Center earthquake horizontally
        const quakeX = width / 2 + margin * 0.25;
        
        // Position based on capped at DisplayDepth
        const depthRatio = displayDepth / maxDepth;
        const quakeY = surfaceY + depthRatio * (height - surfaceY);
        
        // Draw seismic waves (circles) emanating from earthquake
        const waveCount = 6; // Number of wave fronts, reduced for clarity
        const maxWaveRadius = Math.min(width, height) * 0.8; // Max radius size
        const waveSpeed = 0.002; // Keep waves moving, but slower
        
        for (let i = 0; i < waveCount; i++) {
          // Calculate wave radius based on animation phase
          const wavePhase = (animationPhase * waveSpeed + i / waveCount) % 1;
          const waveRadius = wavePhase * maxWaveRadius;
          const alpha = 0.8 * (1 - wavePhase); // Fade out as waves expand
          
          ctx.beginPath();
          ctx.arc(quakeX, quakeY, waveRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        
        // Draw vertical dashed line from surface to earthquake
        ctx.beginPath();
        ctx.moveTo(quakeX, surfaceY);
        ctx.lineTo(quakeX, quakeY);
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Epicenter indicator - just a small marker at surface, not a circle
        ctx.beginPath();
        ctx.moveTo(quakeX - 5, surfaceY);
        ctx.lineTo(quakeX + 5, surfaceY);
        ctx.strokeStyle = '#FF6B6B';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw earthquake focal point with subtle pulsing effect
        const pulseSpeed = 0.05;
        const pulseScale = 1 + Math.sin(animationPhase * pulseSpeed) * 0.1; // Reduced pulsing
        
        // Base size on magnitude
        const minRadius = 4;
        const maxRadius = 12;
        const magnitudeScale = (magnitude - 3) / (7 - 3);
        const baseRadius = minRadius + (maxRadius - minRadius) * Math.min(1, Math.max(0, magnitudeScale));
        const currentRadius = baseRadius * pulseScale;
        
        // Outer glow
        const gradient = ctx.createRadialGradient(quakeX, quakeY, 0, quakeX, quakeY, currentRadius * 2);
        gradient.addColorStop(0, 'rgba(255, 0, 0, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 0, 0, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
        
        ctx.beginPath();
        ctx.arc(quakeX, quakeY, currentRadius * 2, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Main earthquake circle
        ctx.beginPath();
        ctx.arc(quakeX, quakeY, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#FF0000';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Add magnitude label - now positioned to the LEFT of the earthquake
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'right'; // Changed from center to right
        ctx.fillStyle = 'white';
        // Position the magnitude text to the left of the circle
        ctx.fillText(`M${magnitude.toFixed(1)}`, quakeX - currentRadius - 8, quakeY);
        
        // Add depth label (capped at 25 km)
        ctx.textAlign = 'left';
        ctx.fillStyle = 'white';
        ctx.fillText(`${displayDepth.toFixed(1)} km`, quakeX + currentRadius + 8, quakeY);
      }
      
      // ======== TITLE AND LEGEND ========
      // Container title
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'white';
      ctx.fillText('Earthquake Cross-Section', width / 2, 18);
      
      // Add legend in bottom right
      const legendX = width - 100;
      const legendY = height - 35; // Bottom right positioning
      
      // Backgrounds for legend items - improved styling
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      
      // First background with rounded corners
      ctx.beginPath();
      if (ctx.roundRect) {
        // Use roundRect if supported
        ctx.roundRect(legendX - 5, legendY - 8, 95, 18, 4);
      } else {
        // Fallback for browsers without roundRect
        ctx.rect(legendX - 5, legendY - 8, 95, 18);
      }
      ctx.fill();
      
      // Second background
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(legendX - 5, legendY + 12, 95, 18, 4);
      } else {
        ctx.rect(legendX - 5, legendY + 12, 95, 18);
      }
      ctx.fill();
      
      // Earthquake symbol
      ctx.beginPath();
      ctx.arc(legendX + 5, legendY, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'red';
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.font = '10px Arial';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'white';
      ctx.fillText('Earthquake', legendX + 14, legendY + 4);
      
      // Seismic wave symbol
      ctx.beginPath();
      ctx.arc(legendX + 5, legendY + 20, 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(legendX + 5, legendY + 20, 6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.fillText('Seismic Waves', legendX + 14, legendY + 24);
      
      // Continue animation
      animationPhase++;
      animationRef.current = requestAnimationFrame(drawCrossSection);
    };
    
    // Start the animation
    drawCrossSection();
    
    // Cleanup function
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [earthquake, visible, maxDepth]);
  
  if (!visible || !earthquake) return null;
  
  return (
    <div className="cross-section-container">
      <canvas 
        ref={canvasRef} 
        width={320} 
        height={240} 
        style={{ width: '100%', height: '100%', borderRadius: '8px' }}
      />
    </div>
  );
};

export default CrossSectionView;